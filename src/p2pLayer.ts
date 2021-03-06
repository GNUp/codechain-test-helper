// Copyright 2018 Kodebox, Inc.
// This file is part of CodeChain.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.
import { Session, PORT } from "./session";
import {
    MessageType,
    SignedMessage,
    HandshakeMessage,
    NegotiationMessage,
    ExtensionMessage
} from "./p2pMessage";
import { NodeId } from "./sessionMessage";
import { BlockSyncMessage } from "./blockSyncMessage";
import { ParcelSyncMessage } from "./parcelSyncMessage";
import { H256 } from "codechain-sdk/lib/core/H256";

const NET = require("net");

export class P2pLayer {
    private ip: string;
    private port: number;
    private session: Session;
    private socket: any;
    private allowedFinish: boolean;
    private arrivedExtensionMessage: Array<
        BlockSyncMessage | ParcelSyncMessage
    >;
    private tcpBuffer: Buffer;
    private genesisHash: H256;
    private recentHeaderNonce: number;
    private recentBodyNonce: number;

    constructor(ip: string, port: number) {
        this.session = new Session(ip, port);
        this.socket = new NET.Socket();
        this.ip = ip;
        this.port = port;
        this.allowedFinish = false;
        this.arrivedExtensionMessage = [];
        this.tcpBuffer = new Buffer([]);
        this.genesisHash = new H256(
            "0000000000000000000000000000000000000000000000000000000000000000"
        );
        this.recentHeaderNonce = 0;
        this.recentBodyNonce = 0;
    }

    getGenesisHash(): H256 {
        return this.genesisHash;
    }

    getArrivedExtensionMessage(): Array<BlockSyncMessage | ParcelSyncMessage> {
        return this.arrivedExtensionMessage;
    }

    getHeaderNonce(): number {
        return this.recentHeaderNonce;
    }

    getBodyNonce(): number {
        return this.recentBodyNonce;
    }

    async connect(): Promise<{}> {
        return new Promise(async (resolve, reject) => {
            try {
                await this.session.connect();
            } catch (err) {
                console.error(err);
                reject(err);
            }

            this.socket.connect(
                { port: this.port, host: this.ip },
                () => {
                    console.log("Start TCP connection");
                    console.log(
                        "   local = %s:%s",
                        this.socket.localAddress,
                        this.socket.localPort
                    );
                    console.log(
                        "   remote = %s:%s",
                        this.socket.remoteAddress,
                        this.socket.remotePort
                    );
                    this.sendP2pMessage(MessageType.SYNC_ID);

                    this.socket.on("data", (data: Buffer) => {
                        try {
                            this.tcpBuffer = Buffer.concat([
                                this.tcpBuffer,
                                data
                            ]);
                            while (this.tcpBuffer.length !== 0) {
                                const len = this.tcpBuffer.readUIntBE(0, 1);
                                if (len >= 0xf8) {
                                    const lenOfLen = len - 0xf7;
                                    const dataLen = this.tcpBuffer
                                        .slice(1, 1 + lenOfLen)
                                        .readUIntBE(0, lenOfLen);
                                    if (
                                        this.tcpBuffer.length >=
                                        dataLen + lenOfLen + 1
                                    ) {
                                        const rlpPacket = this.tcpBuffer.slice(
                                            0,
                                            dataLen + lenOfLen + 1
                                        );
                                        this.tcpBuffer = this.tcpBuffer.slice(
                                            dataLen + lenOfLen + 1,
                                            this.tcpBuffer.length
                                        );
                                        if (
                                            this.onP2pMessage(rlpPacket) ===
                                            true
                                        )
                                            resolve();
                                    } else {
                                        throw Error(
                                            "The rlp data has not arrived yet"
                                        );
                                    }
                                } else if (len >= 0xc0) {
                                    const dataLen = len - 0xc0;
                                    if (this.tcpBuffer.length >= dataLen + 1) {
                                        const rlpPacket = this.tcpBuffer.slice(
                                            0,
                                            dataLen + 1
                                        );
                                        this.tcpBuffer = this.tcpBuffer.slice(
                                            dataLen + 1,
                                            this.tcpBuffer.length
                                        );
                                        if (
                                            this.onP2pMessage(rlpPacket) ===
                                            true
                                        )
                                            resolve();
                                    } else {
                                        throw Error(
                                            "The rlp data has not arrived yet"
                                        );
                                    }
                                } else {
                                    throw Error("Invalid RLP data");
                                }
                            }
                        } catch (err) {
                            console.error(err);
                        }
                    });
                    this.socket.on("end", () => {
                        console.log("TCP disconnected");
                    });
                    this.socket.on("error", (err: any) => {
                        console.log("Socket Error: ", JSON.stringify(err));
                    });
                    this.socket.on("close", () => {
                        console.log("Socket Closed");
                    });
                }
            );
        });
    }

    private sendP2pMessage(messageType: MessageType): void {
        switch (messageType) {
            case MessageType.SYNC_ID: {
                console.log("Send SYNC_ID Message");
                const nodeId = new NodeId(this.socket.localAddress, PORT);
                const msg = new HandshakeMessage({
                    type: "sync",
                    version: 0,
                    port: PORT,
                    nodeId
                });
                const signedMsg = new SignedMessage(
                    msg,
                    this.session.getTargetNonce()
                );
                this.writeData(signedMsg.rlpBytes());
                break;
            }
            case MessageType.REQUEST_ID: {
                console.log("Send REQUEST_ID Message");
                const extensionName = [
                    "block-propagation",
                    "parcel-propagation"
                ];
                let msg = new NegotiationMessage(0, 0, {
                    type: "request",
                    extensionName: extensionName[0],
                    extensionVersion: [0]
                });
                let signedMsg = new SignedMessage(
                    msg,
                    this.session.getTargetNonce()
                );
                this.writeData(signedMsg.rlpBytes());

                msg = new NegotiationMessage(0, 1, {
                    type: "request",
                    extensionName: extensionName[1],
                    extensionVersion: [0]
                });
                signedMsg = new SignedMessage(
                    msg,
                    this.session.getTargetNonce()
                );
                this.writeData(signedMsg.rlpBytes());
                break;
            }
            default:
                throw Error("Unimplemented");
        }
    }

    async sendExtensionMessage(
        extensionName: string,
        extensionVersion: number,
        data: Buffer,
        needEncryption: boolean
    ) {
        const secret = this.session.getSecret();
        if (secret == null) throw Error("Secret is not specified");
        let msg;
        if (needEncryption) {
            msg = new ExtensionMessage(
                0,
                extensionName,
                extensionVersion,
                { type: "encrypted", data },
                secret,
                this.session.getTargetNonce()
            );
        } else {
            msg = new ExtensionMessage(
                0,
                extensionName,
                extensionVersion,
                { type: "unencrypted", data },
                secret,
                this.session.getTargetNonce()
            );
        }
        const signedMsg = new SignedMessage(msg, this.session.getTargetNonce());
        await this.writeData(signedMsg.rlpBytes());
    }

    private async writeData(data: Buffer) {
        const success = await !this.socket.write(data);
        if (!success) {
            (async data => {
                await this.socket.once("drain", () => {
                    this.writeData(data);
                });
            })(data);
        }
    }

    onP2pMessage(data: any): boolean {
        const secret = this.session.getSecret();
        const nonce = this.session.getNonce();
        if (secret == null) throw Error("Secret is not specified");
        if (nonce == null) throw Error("Nonce is not specified");
        try {
            const msg = SignedMessage.fromBytes(data, secret, nonce);

            switch (msg.protocolId()) {
                case MessageType.SYNC_ID: {
                    console.log("Got SYNC_ID message");
                    break;
                }
                case MessageType.ACK_ID: {
                    console.log("Got ACK_ID message");
                    this.sendP2pMessage(MessageType.REQUEST_ID);
                    break;
                }
                case MessageType.REQUEST_ID: {
                    console.log("Got REQUEST_ID message");
                    break;
                }
                case MessageType.ALLOWED_ID: {
                    console.log("Got ALLOWED_ID message");
                    if (this.allowedFinish) return true;
                    this.allowedFinish = true;
                    break;
                }
                case MessageType.DENIED_ID: {
                    console.log("Got DENIED_ID message");
                    break;
                }
                case MessageType.ENCRYPTED_ID: {
                    console.log("Got ENCRYPTED_ID message");
                    this.onExtensionMessage(msg as ExtensionMessage);
                    break;
                }
                case MessageType.UNENCRYPTED_ID: {
                    console.log("Got UNENCRYPTED_ID message");
                    this.onExtensionMessage(msg as ExtensionMessage);
                    break;
                }
                default:
                    throw Error("Unreachable");
            }
        } catch (err) {
            console.error(err);
        }

        return false;
    }

    onExtensionMessage(msg: ExtensionMessage) {
        switch (msg.getName()) {
            case "block-propagation": {
                const extensionMsg = BlockSyncMessage.fromBytes(
                    msg.getData().data
                );
                this.arrivedExtensionMessage.push(extensionMsg);
                const body = extensionMsg.getBody();
                if (body.type === "status") {
                    this.genesisHash = body.genesisHash;
                } else if (body.type === "request") {
                    const msg = body.message.getBody();
                    if (msg.type === "headers")
                        this.recentHeaderNonce = body.id;
                    else if (msg.type === "bodies") {
                        this.recentBodyNonce = body.id;
                        console.log(msg.data);
                    }
                }
                console.log(extensionMsg);
                console.log(extensionMsg.getBody());

                break;
            }
            case "parcel-propagation": {
                const extensionMsg = ParcelSyncMessage.fromBytes(
                    msg.getData().data
                );
                this.arrivedExtensionMessage.push(extensionMsg);
                console.log(extensionMsg);
                break;
            }
            default:
                throw Error("Not implemented");
        }
    }

    async close() {
        await this.socket.end();
    }
}

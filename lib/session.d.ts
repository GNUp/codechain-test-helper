import { H128 } from "codechain-primitives";
import { H512 } from "codechain-primitives";
import { H256 } from "codechain-primitives";
export declare const PORT = 6602;
export declare class Session {
    private static idCounter;
    private port;
    private targetIp;
    private targetPort;
    private socket;
    private key;
    private nonce;
    private secret;
    private encodedSecret;
    private targetNonce;
    private targetPubkey;
    private log;
    constructor(ip: string, port: number);
    setLog(): void;
    setKey(key: any): void;
    setNonce(nonce: H128): void;
    setTargetNonce(nonce: H128): void;
    setTargetPubkey(pub: H512): void;
    getPort(): number;
    getKey(): any;
    getNonce(): H128;
    getTargetNonce(): H128;
    getTargetPubkey(): H512 | null;
    getSocket(): any;
    getSecret(): H256 | null;
    connect(): Promise<{}>;
    listen(): Promise<{}>;
    private onConnectionMessage;
    private onLiteningMessage;
    private sendSessionMessage;
}

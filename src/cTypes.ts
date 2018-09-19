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
import { H160 } from "codechain-sdk/lib/core/H160";
import { H256 } from "codechain-sdk/lib/core/H256";
import { U256 } from "codechain-sdk/lib/core/U256";
import { SignedParcel } from "codechain-sdk/lib/core/SignedParcel";
import { Parcel } from "codechain-sdk/lib/core/Parcel";
import { Action } from "codechain-sdk/lib/core/classes";

const RLP = require("rlp");
const BLAKE_NULL_RLP: H256 = new H256(
    "45b0cfc220ceec5b7c1c62c4d4193d38e4eba48e8815729ce75f9cab0e4c1c0"
);

export class Header {
    public parentHash: H256;
    public timestamp: number;
    public number: number;
    public author: H160;
    public extraData: Buffer;
    public parcelsRoot: H256;
    public stateRoot: H256;
    public invoiceRoot: H256;
    public score: U256;
    public seal: Array<Buffer>;
    public hash: null | H256;
    public bareHash: null | H256;

    constructor(
        parentHash: H256,
        timestamp: number,
        number: number,
        author: H160,
        extraData: Buffer,
        parcelsRoot: H256,
        stateRoot: H256,
        invoiceRoot: H256,
        score: U256,
        seal: Array<Buffer>,
        hash?: H256,
        bareHash?: H256
    ) {
        this.parentHash = parentHash;
        this.timestamp = timestamp;
        this.number = number;
        this.author = author;
        this.extraData = extraData;
        this.parcelsRoot = parcelsRoot;
        this.stateRoot = stateRoot;
        this.invoiceRoot = invoiceRoot;
        this.score = score;
        this.seal = seal;
        this.hash = hash == undefined ? null : hash;
        this.bareHash = bareHash == undefined ? null : bareHash;
    }

    default(): Header {
        return new Header(
            new H256(
                "0000000000000000000000000000000000000000000000000000000000000000"
            ),
            0,
            0,
            new H160("0000000000000000000000000000000000000000"),
            Buffer.alloc(0),
            BLAKE_NULL_RLP,
            BLAKE_NULL_RLP,
            BLAKE_NULL_RLP,
            new U256(
                "0000000000000000000000000000000000000000000000000000000000000000"
            ),
            []
        );
    }

    toencodeObject(): Array<any> {
        return [
            this.parentHash.toEncodeObject(),
            this.author.toEncodeObject(),
            this.stateRoot.toEncodeObject(),
            this.parcelsRoot.toEncodeObject(),
            this.invoiceRoot.toEncodeObject(),
            this.score.toEncodeObject(),
            this.number,
            this.timestamp,
            this.extraData.toString("hex")
        ].concat(
            this.seal.map(buf => {
                return buf.toString("hex");
            })
        );
    }

    rlpBytes(): Buffer {
        return RLP.encode(this.toencodeObject());
    }

    static fromBytes(bytes: Buffer): Header {
        const decodedmsg = RLP.decode(bytes);

        const header = new Header(
            new H256(decodedmsg[0].toString("hex")),
            decodedmsg[7],
            decodedmsg[6],
            decodedmsg[1],
            decodedmsg[8],
            decodedmsg[3],
            decodedmsg[2],
            decodedmsg[4],
            decodedmsg[5],
            []
        );

        for (let i = 9; i < decodedmsg.getLength(); i++) {
            header.seal.push(decodedmsg[i]);
        }

        return header;
    }
}

export class UnverifiedParcel {
    private signedParcel: SignedParcel;

    constructor(
        unsigned: UnsignedParcel,
        sig: string,
        blockNumber?: number,
        blockHash?: H256,
        parcelIndex?: number
    ) {
        this.signedParcel = new SignedParcel(
            unsigned.getParcel(),
            sig,
            blockNumber,
            blockHash,
            parcelIndex
        );
    }

    toEncodeObject(): Array<any> {
        return this.signedParcel.toEncodeObject();
    }

    rlpBytes(): Buffer {
        return this.signedParcel.rlpBytes();
    }
}

export class UnsignedParcel {
    private parcel: Parcel;

    constructor(networkID: string, action: Action) {
        this.parcel = new Parcel(networkID, action);
    }

    getParcel(): Parcel {
        return this.parcel;
    }

    toEncodeObject(): Array<any> {
        return this.parcel.toEncodeObject();
    }

    rlpBytes(): Buffer {
        return this.parcel.rlpBytes();
    }
}

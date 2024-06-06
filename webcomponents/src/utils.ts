import {DeliveryNotice, DeliveryZvm} from "@ddd-qc/delivery";
import {encodeHashToBase64, EntryHashB64} from "@holochain/client";
import _sodium from 'libsodium-wrappers-sumo';

/** */
export function prettyFileSize(size: number): string {
    const kib = Math.ceil(size / 1024);
    const mib = Math.ceil(kib / 1024 * 10) / 10;
    if (mib >= 1) {
        return `${mib} MB`; // MiB
    } else {
        return `${kib} KB`; // KiB
    }
}


/** Make a pretty data string from a holochain timestamp */
export function prettyTimestamp(ts: number): string {
    if (ts <= 0) {
        return "N/A";
    }
    const date = new Date(ts / 1000); // Holochain timestamp is in micro-seconds, Date wants milliseconds
    const date_str = date.toLocaleString('en-US', {hour12: false});
    return date_str;
}


/** */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa( binary );
}


/** */
export function base64ToArrayBuffer(base64: string): ArrayBufferLike {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}

export type FileHashB64 = string;

/** */
export async function sha256(message: string): Promise<FileHashB64> {
    const utf8 = new TextEncoder().encode(message);
    await _sodium.ready;
    const sodium = _sodium;
    let hashArray = await sodium.crypto_hash_sha256(utf8);
    console.log("sha256", encodeHashToBase64(hashArray));
    //const hashBuffer0 = await crypto.subtle.digest('SHA-256', utf8);
    //const hashArray0 = Array.from(new Uint8Array(hashBuffer0));
    //console.log("hash compare", hashArray, hashArray0);
    // const hashHex = hashArray
    //     .map((bytes) => bytes.toString(16).padStart(2, '0'))
    //     .join('');
    return encodeHashToBase64(hashArray);
}


/** */
function chunkSubstr(str: string, size: number): Array<string> {
    const numChunks = Math.ceil(str.length / size);
    const chunks = new Array<string>(numChunks);
    for (let i = 0, y = 0; i < numChunks; ++i, y += size) {
        chunks[i] = str.substring(y, y + size);
    }
    return chunks;
}


/** */
export interface SplitObject {
    dataHash: FileHashB64,
    numChunks: number,
    chunks: string[],
}


/** */
export async function splitFile(file: File, chunkMaxSize: number): Promise<SplitObject> {
    // /** Causes stack error on big files */
    // if (!base64regex.test(file.content)) {
    //   const invalid_hash = sha256(file.content);
    //   console.error("File '" + file.name + "' is invalid base64. hash is: " + invalid_hash);
    // }
    const content = await file.arrayBuffer();
    const contentB64 = arrayBufferToBase64(content);
    const splitObj = await splitData(contentB64, chunkMaxSize);
    console.log("splitObj: ", splitObj);
    return splitObj;
}


/** */
export async function splitData(full_data_string: string, chunkMaxSize: number): Promise<SplitObject> {
    const hash = await sha256(full_data_string);
    console.log('file hash: ' + hash);
    console.log('splitFile()', chunkMaxSize);
    const chunks = chunkSubstr(full_data_string, chunkMaxSize);
    return {
        dataHash: hash,
        numChunks: chunks.length,
        chunks: chunks,
    };
}



export function getCompletionPct(deliveryZvm: DeliveryZvm, notice: DeliveryNotice, missingChunks: Set<EntryHashB64>): number {
    const manifest = deliveryZvm.perspective.privateManifests[encodeHashToBase64(notice.summary.parcel_reference.parcel_eh)]
    if (!manifest) {
        return 0;
    }
    const pct = Math.ceil((manifest[0].chunks.length - missingChunks.size) / manifest[0].chunks.length * 100);
    console.log(`getCompletionPct() ${missingChunks.size}/${manifest[0].chunks.length} = ${pct}%`);
    return pct;
}

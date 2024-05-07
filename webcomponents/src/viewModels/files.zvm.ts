import {
    ActionHashB64,
    AgentPubKeyB64,
    decodeHashFromBase64,
    encodeHashToBase64,
    EntryHash, EntryHashB64
} from '@holochain/client';
import {ZomeViewModel} from "@ddd-qc/lit-happ";
import {FilesProxy} from "../bindings/files.proxy";
import {SendFileInput} from "../bindings/files.types";

//import WebWorker from 'web-worker:./commitPrivateFile.ts';


/** */
export class FilesZvm extends ZomeViewModel {

    static readonly ZOME_PROXY = FilesProxy;

    private _allAppletIds: EntryHashB64[] = [];

    //private _worker = new Worker("./commitPrivateFile.ts");

    get zomeProxy(): FilesProxy {
        return this._zomeProxy as FilesProxy;
    }


    /** -- ViewModel -- */


    /* */
    get perspective(): unknown {
        return {};
    }


    /* */
    protected hasChanged(): boolean {
        // TODO
        return true;
    }


    /** */
    async initializePerspectiveOffline(): Promise<void> {
        // N/A
        this._dvmParent.dumpLogs();
    }


    /** */
    async initializePerspectiveOnline(): Promise<void> {
        // N/A
    }


    // /** -- Signals -- */
    //
    // signalHandler?: AppSignalCb = this.mySignalHandler;
    //
    // /** */
    // mySignalHandler(signal: AppSignal): void {
    //
    // }


    /** -- Methods -- */


    /** */
    async commitPrivateManifest(file: File, dataHash: string, chunks: EntryHash[]): Promise<EntryHashB64> {
        const params = {
            filename: file.name,
            filetype: file.type,
            data_hash: dataHash,
            orig_filesize: file.size,
            chunks,
        }
        const [manifest_eh, _description] =  await this.zomeProxy.commitPrivateFile(params);
        const ehb64 = encodeHashToBase64(manifest_eh);
        /** Done */
        this.notifySubscribers();
        return ehb64;
    }


    /** */
    async publishFileManifest(file: File, dataHash: string, chunks: EntryHash[]): Promise<EntryHashB64> {
        const params = {
            filename: file.name,
            filetype: file.type,
            data_hash: dataHash,
            orig_filesize: file.size,
            chunks,
        }
        const [manifest_eh, _description] =  await this.zomeProxy.publishFileManifest(params);
        const ehb64 = encodeHashToBase64(manifest_eh);
        /** Store new manifest */
        /** Done */
        this.notifySubscribers();
        return ehb64;
    }


    // /** */
    // async commitPrivateFile(file: File, splitObj: SplitObject): Promise<EntryHashB64> {
    //   /** Commit each chunk */
    //   const chunksToSend: EntryHash[] = [];
    //   for (let i = 0; i < splitObj.numChunks; ++i) {
    //     const eh = await this.zomeProxy.writePrivateFileChunk({data_hash: splitObj.dataHash, data: splitObj.chunks[i]});
    //     chunksToSend.push(eh);
    //     //await delay(splitObj.numChunks);
    //     await delay(40);
    //   }
    //   /** Commit file manifest */
    //   const params = {
    //     filename: file.name,
    //     filetype: file.type,
    //     data_hash: splitObj.dataHash,
    //     orig_filesize: file.size,
    //     chunks: chunksToSend,
    //   }
    //   const [manifest_eh, _description] =  await this.zomeProxy.commitPrivateFile(params);
    //   const ehb64 = encodeHashToBase64(manifest_eh);
    //   /** Done */
    //   this.notifySubscribers();
    //   return ehb64;
    // }


    // /** */
    // async publishFile(file: File, splitObj: SplitObject): Promise<EntryHashB64> {
    //     console.log('zvm.commitPublicFile: ', splitObj)
    //     /** Commit each chunk */
    //     const chunksToSend: EntryHash[] = [];
    //     for (let i = 0; i < splitObj.numChunks; ++i) {
    //         const eh = await this.zomeProxy.writePublicFileChunk({data_hash: splitObj.dataHash, data: splitObj.chunks[i]});
    //         chunksToSend.push(eh);
    //     }
    //     /** Commit file manifest */
    //     const params = {
    //         filename: file.name,
    //         filetype: file.type,
    //         data_hash: splitObj.dataHash,
    //         orig_filesize: file.size,
    //         chunks: chunksToSend,
    //     }
    //     const [manifest_eh, _description] = await this.zomeProxy.publishFileManifest(params);
    //     const ehb64 = encodeHashToBase64(manifest_eh);
    //     /** Done */
    //     this.notifySubscribers();
    //     return ehb64;
    // }


    /** */
    async sendFile(manifestEh: EntryHashB64, recipientB64s: AgentPubKeyB64[]): Promise<ActionHashB64> {
        const recipients = recipientB64s.map((b64) => decodeHashFromBase64(b64));
        const input: SendFileInput = {
            manifest_eh: decodeHashFromBase64(manifestEh),
            strategy: { NORMAL: null },
            recipients,
        };
        console.log('sending file:', input);
        /* Send File */
        const ah = await this.zomeProxy.sendFile(input);
        return encodeHashToBase64(ah);
    }
}

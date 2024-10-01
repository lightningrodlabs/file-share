import {ZomeViewModel, EntryId, AgentId, ActionId} from "@ddd-qc/lit-happ";
import {FilesProxy} from "../bindings/files.proxy";
import {SendFileInput} from "../bindings/files.types";
import {DistributionStrategy} from "@ddd-qc/delivery/dist/bindings/delivery.types";

//import WebWorker from 'web-worker:./commitPrivateFile.ts';


/** */
export class FilesZvm extends ZomeViewModel {

    static override readonly ZOME_PROXY = FilesProxy;

    //private _allAppletIds: EntryHashB64[] = [];

    //private _worker = new Worker("./commitPrivateFile.ts");

    get zomeProxy(): FilesProxy {
        return this._zomeProxy as FilesProxy;
    }


    /** -- ViewModel -- */


    /* */
    get perspective(): Object {
        return {};
    }


    /** */
    override async initializePerspectiveOffline(): Promise<void> {
        // N/A
        this._dvmParent.dumpCallLogs();
    }


    /** */
    override async initializePerspectiveOnline(): Promise<void> {
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
    async commitPrivateManifest(file: File, dataHash: string, chunks: EntryId[]): Promise<EntryId> {
        const params = {
            filename: file.name,
            filetype: file.type,
            data_hash: dataHash,
            orig_filesize: file.size,
            chunks: chunks.map(id => id.hash),
        }
        const [manifest_eh, _description] =  await this.zomeProxy.commitPrivateFile(params);
        /** Done */
        this.notifySubscribers();
        return new EntryId(manifest_eh);
    }


    /** */
    async publishFileManifest(file: File, dataHash: string, chunks: EntryId[]): Promise<EntryId> {
        console.log("filesZvm.publishFileManifest()", file.name);
        const params = {
            filename: file.name,
            filetype: file.type,
            data_hash: dataHash,
            orig_filesize: file.size,
            chunks: chunks.map(id => id.hash),
        }
        const [manifest_eh, _description] =  await this.zomeProxy.publishFileManifest(params);
        /** Done */
        this.notifySubscribers();
        return new EntryId(manifest_eh);
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
    async sendFile(manifestEh: EntryId, recipientIds: AgentId[]): Promise<ActionId> {
        const recipients = recipientIds.map(id => id.hash);
        const input: SendFileInput = {
            manifest_eh: manifestEh.hash,
            strategy: DistributionStrategy.Normal,
            recipients,
        };
        console.log('sending file:', input);
        /* Send File */
        const ah = await this.zomeProxy.sendFile(input);
        return new ActionId(ah);
    }
}

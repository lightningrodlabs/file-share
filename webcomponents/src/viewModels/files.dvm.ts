import {AppProxy, delay, DnaViewModel, HCL, ZvmDef} from "@ddd-qc/lit-happ";
import {
    DELIVERY_ZOME_NAME,
    DeliveryProperties,
    DeliveryZvm, ParcelChunk, ParcelKindVariantManifest,
    ParcelManifest, ParcelReference,
    SignalProtocol,
    SignalProtocolType
} from "@ddd-qc/delivery";
import {
    AgentPubKeyB64,
    AppSignalCb, decodeHashFromBase64,
    encodeHashToBase64,
    EntryHashB64,
} from "@holochain/client";
import {AppSignal} from "@holochain/client/lib/api/app/types";

import {FilesZvm} from "./files.zvm";
import {
    arrayBufferToBase64,
    base64ToArrayBuffer,
    FileHashB64,
    prettyFileSize,
    sha256,
    splitFile,
    SplitObject
} from "../utils";
import { decode } from "@msgpack/msgpack";
import {
    FilesCb,
    FilesDvmPerspective,
    FilesNotificationType,
    FilesNotificationVariantDistributionToRecipientComplete,
    FilesNotificationVariantNewNoticeReceived,
    FilesNotificationVariantPublicSharingComplete,
    FilesNotificationVariantReceptionComplete, FilesNotificationVariantReplyReceived
} from "./files.perspective";
import {TaggingZvm} from "./tagging.zvm";
import {FILES_DEFAULT_ROLE_NAME} from "../bindings/files.types";
import {NotificationsZvm} from "@ddd-qc/notifications-dvm/dist/viewModels/notifications.zvm";
import {ProfilesAltZvm, ProfilesZvm} from "@ddd-qc/profiles-dvm";


/**
 *
 */
export class FilesDvm extends DnaViewModel {

    /** For commit & send follow-up */
    private _mustSendTo?: AgentPubKeyB64[];
    /** For publish / send follow-up */
    private _mustAddTags?;

    /** -- DnaViewModel Interface -- */

    static readonly DEFAULT_BASE_ROLE_NAME = FILES_DEFAULT_ROLE_NAME;
    static readonly ZVM_DEFS: ZvmDef[] = [
        FilesZvm,
        TaggingZvm,
        [DeliveryZvm, "zDelivery"],
        //[NotificationsZvm, "notifications"],
        [ProfilesAltZvm, "profiles"],
    ];

    readonly signalHandler?: AppSignalCb = this.mySignalHandler;


    /** QoL Helpers */
    get filesZvm(): FilesZvm {return this.getZomeViewModel(FilesZvm.DEFAULT_ZOME_NAME) as FilesZvm}
    get deliveryZvm(): DeliveryZvm {return this.getZomeViewModel("zDelivery") as DeliveryZvm}

    get taggingZvm(): TaggingZvm {return this.getZomeViewModel("zTagging") as TaggingZvm}

    //get notificationsZvm(): NotificationsZvm {return this.getZomeViewModel("notifications") as NotificationsZvm}

    get profilesZvm(): ProfilesAltZvm {return this.getZomeViewModel("profiles") as ProfilesAltZvm}

    /** -- ViewModel Interface -- */

    private _perspective: FilesDvmPerspective = {notificationLogs: []};


    /** */
    protected hasChanged(): boolean {
        return true;
        // //console.log("filesDvm.hasChanged()");
        // if (!this._previousPerspective) {
        //     return true;
        // }
        // const prev = this._previousPerspective as FilesDvmPerspective;
        // if (Object.values(this._perspective.unrepliedOutbounds).length != Object.values(prev.unrepliedOutbounds).length) {
        //     return true;
        // }
        // if (Object.values(this._perspective.unrepliedInbounds).length != Object.values(prev.unrepliedInbounds).length) {
        //     return true;
        // }
        // // TODO implement faster deep compare
        // return JSON.stringify(this._perspective) == JSON.stringify(prev);
        // //return false;
    }


    /** */
    get perspective(): FilesDvmPerspective { return this._perspective }


    /** */
    get dnaProperties(): DeliveryProperties {
        console.log('dnaProperties() dnaModifiers', this.cell.dnaModifiers);
        const properties = decode(this.cell.dnaModifiers.properties as Uint8Array) as DeliveryProperties;
        console.log('dnaProperties() properties', properties);
        return properties;
    }


    /** -- Methods -- */

    private _sendFile(manifestEh: EntryHashB64, manifest: ParcelManifest) {
        const recipients = this._mustSendTo.map((agent) => (' ' + agent).slice(1)); // deep copy string for promise
        console.log("sendFile follow up", manifestEh, this._mustSendTo);
        this.filesZvm.sendFile(manifestEh, this._mustSendTo).then((distribAh) => {
            /** Into Notification */
            const now = Date.now();
            console.log("File delivery request sent", recipients, this._mustAddTags);
            this._perspective.notificationLogs.push([now, FilesNotificationType.DeliveryRequestSent, {distribAh, manifestEh, recipients}]);
            if (this._mustAddTags && this._mustAddTags.isPrivate) {
                /*await*/ this.taggingZvm.tagPrivateEntry(manifestEh, this._mustAddTags.tags, manifest.description.name);
                this._mustAddTags = undefined;
            }
            this.notifySubscribers();
        });
        this._mustSendTo = undefined;
    }



    /** */
    async downloadFile(manifestEh: EntryHashB64): Promise<void> {
        console.log("FilesDvm.downloadFile()", manifestEh);
        const [manifest, _ts] = await this.deliveryZvm.getManifest(manifestEh);
        const maybeCachedData = this.getFileFromCache(manifest.data_hash);
        let file;
        if (maybeCachedData == null) {
            file = await this.parcel2File(manifestEh);
            await this.cacheFile(file);
        } else {
            file = this.data2File(manifest, maybeCachedData);
        }
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name || 'download';
        a.addEventListener('click', () => {}, false);
        a.click();
    }


    /** */
    async cacheFile(file: File) {
        const content = await file.arrayBuffer();
        const contentB64 = arrayBufferToBase64(content);
        if (contentB64.length > 1 * 1024 * 1024) {
            console.log("FilesDvm.cacheFile() Aborted. File is too big for caching", contentB64.length);
            return;
        }
        const hash = await sha256(contentB64);
        console.log("FilesDvm.cacheFile() caching:", hash, prettyFileSize(file.size));
        try {
            localStorage.setItem("filesDvm/" + hash, contentB64);
        } catch(e) {
            console.warn("Failed to store in localStorage", "filesDvm/" + hash, e);
        }
    }


    // /** */
    // cacheSplitObj(splitObj: SplitObject): void {
    //     let dataB64 = "";
    //     for (const chunk of splitObj.chunks) {
    //         dataB64 += chunk;
    //     }
    //     localStorage.setItem("filesDvm/" + splitObj.dataHash, dataB64);
    // }


    /** */
    getFileFromCache(dataHash: FileHashB64): string | null {
        const dataB64 = localStorage.getItem("filesDvm/" + dataHash);
        if (dataB64) {
            console.log("FilesDvm.getFileFromCache() Found file in cache:", dataHash);
        }
        return dataB64;
    }


    /** */
    private async loopUntilFound(pr: ParcelReference){
        let maybeParcel;
        do  {
            await delay(3000)
            await this.probeAll();
            maybeParcel = this.deliveryZvm.perspective.publicParcels[encodeHashToBase64(pr.eh)];
            //console.log("loopUntilFound()", maybeParcel);
        } while (maybeParcel === undefined)
    }

    /** */
    private async loopUntilRemoved(pr: ParcelReference){
        let maybeParcel;
        do  {
            await delay(3000)
            await this.probeAll();
            maybeParcel = this.deliveryZvm.perspective.publicParcels[encodeHashToBase64(pr.eh)];
            //console.log("loopUntilRemoved()", maybeParcel);
        } while (maybeParcel && !maybeParcel.deleteInfo)
    }

    /** */
    mySignalHandler(signal: AppSignal): void {
        const now = Date.now();
        if (signal.zome_name != DELIVERY_ZOME_NAME) {
            return;
        }
        console.log("FilesDvm received signal", signal);
        const deliverySignal = signal.payload as SignalProtocol;
        /** */
        if (SignalProtocolType.NewLocalManifest in deliverySignal) {
            const manifest = deliverySignal.NewLocalManifest[2];
            const manifestEh = encodeHashToBase64(deliverySignal.NewLocalManifest[0])
            /** Follow-up send if requested */
            if (this._mustSendTo && this._mustSendTo.length > 0) {
                this._sendFile(manifestEh, manifest);
            }
            /** Add Public tags if any */
            if (this._mustAddTags) {
                if (this._mustAddTags.isPrivate) {
                    /*await*/ this.taggingZvm.tagPrivateEntry(manifestEh, this._mustAddTags.tags, manifest.description.name);
                } else {
                    /*await*/ this.taggingZvm.tagPublicEntry(manifestEh, this._mustAddTags.tags, manifest.description.name);
                }
                this._mustAddTags = undefined;
            }
            /** Done */
            if (this._perspective.uploadState.callback) this._perspective.uploadState.callback(manifestEh);
            /*await*/this.cacheFile(this._perspective.uploadState.file);
            this._perspective.uploadState = undefined;
            this.notifySubscribers();
        }
        if (SignalProtocolType.NewLocalChunk in deliverySignal) {
            console.log("signal NewLocalChunk", deliverySignal.NewLocalChunk);
            //this._perspective.notificationLogs.push([now, SignalProtocolType.NewChunk, deliverySignal]);
            const chunk = deliverySignal.NewLocalChunk[1];
            const manifestPair = this.deliveryZvm.perspective.localManifestByData[chunk.data_hash];
            if (!manifestPair && this._perspective.uploadState) {
                /** We are the original creator of this file */
                if (!this._perspective.uploadState.chunks) {
                    this._perspective.uploadState.chunks = [];
                }
                this._perspective.uploadState.chunks.push(deliverySignal.NewLocalChunk[0]);
                const index = this._perspective.uploadState.chunks.length;
                /** Commit manifest if it was the last chunk */
                if (this._perspective.uploadState.chunks.length == this._perspective.uploadState.splitObj.numChunks) {
                    if (this._perspective.uploadState.isPrivate) {
                        this.filesZvm.commitPrivateManifest(this._perspective.uploadState.file, this._perspective.uploadState.splitObj.dataHash, this._perspective.uploadState.chunks)
                    } else {
                        this.filesZvm.publishFileManifest(this._perspective.uploadState.file, this._perspective.uploadState.splitObj.dataHash, this._perspective.uploadState.chunks);
                    }
                } else {
                    /** Otherwise commit next batch */
                    if (this._perspective.uploadState.chunks.length == this._perspective.uploadState.written_chunks) {
                        this.writeChunks();
                    }
                }
                this.notifySubscribers();
            }
        }
        if (SignalProtocolType.NewReceptionProof in deliverySignal) {
            console.log("signal NewReceptionProof", deliverySignal.NewReceptionProof);
            this.filesZvm.zomeProxy.getPrivateFiles().then(() => {
                /** Into Notification */
                const notif = {
                    noticeEh: encodeHashToBase64(deliverySignal.NewReceptionProof[2].notice_eh),
                    manifestEh: encodeHashToBase64(deliverySignal.NewReceptionProof[2].parcel_eh),
                } as FilesNotificationVariantReceptionComplete;
                this._perspective.notificationLogs.push([now, FilesNotificationType.ReceptionComplete, notif]);
                this.notifySubscribers();
            })
        }
        if (SignalProtocolType.RemovedPublicParcel in deliverySignal) {
            console.log("signal RemovedPublicParcel dvm", deliverySignal.RemovedPublicParcel);
            const author = encodeHashToBase64(deliverySignal.RemovedPublicParcel[3]);
            const pr = deliverySignal.RemovedPublicParcel[2];
            //const timestamp = deliverySignal.RemovedPublicParcel[1];
            //const ppEh = encodeHashToBase64(pr.eh);
            if (author != this.cell.agentPubKey) {
                this.loopUntilRemoved(pr);
            }
        }

        if (SignalProtocolType.NewPublicParcel in deliverySignal) {
            console.log("signal NewPublicParcel dvm", deliverySignal.NewPublicParcel);
            const author = encodeHashToBase64(deliverySignal.NewPublicParcel[3]);
            const pr = deliverySignal.NewPublicParcel[2];
            //const timestamp = deliverySignal.NewPublicParcel[1];
            const ppEh = encodeHashToBase64(pr.eh);
            if (author != this.cell.agentPubKey) {
                // FIXME: getManifest() fails because it gets received via gossip. Might be best to requestManifest instead?
                //this.deliveryZvm.zomeProxy.getManifest(decodeHashFromBase64(ppEh)).then((manifest) => this._perspective.publicFiles[manifest.data_hash] = ppEh);
                //this.probePublicFiles();
                //this._latestPublic.push(ppEh);
                /** Have DeliveryZvm perform probePublicParcels */
                this.loopUntilFound(pr);
            } else {
                /** Notify UI that we finished publishing something */
                const notif = {
                    manifestEh: ppEh,
                } as FilesNotificationVariantPublicSharingComplete;
                this._perspective.notificationLogs.push([now, FilesNotificationType.PublicSharingComplete, notif]);
                this._perspective.uploadState = undefined;

                this.notifySubscribers();

                /** Notify peers that we published something */
                //const peers = this._profilesZvm.getAgents().map((peer) => decodeHashFromBase64(peer));
                //this._dvm.deliveryZvm.zomeProxy.notifyNewPublicParcel({peers, timestamp, pr});
            }
        }
        if (SignalProtocolType.NewReplyAck in deliverySignal) {
            console.log("signal NewReplyAck", deliverySignal.NewReplyAck);
            /** Into Notification */
            const notif = {
                distribAh: encodeHashToBase64(deliverySignal.NewReplyAck[2].distribution_ah),
                recipient: encodeHashToBase64(deliverySignal.NewReplyAck[2].recipient),
                hasAccepted: deliverySignal.NewReplyAck[2].has_accepted,
            } as FilesNotificationVariantReplyReceived;
            this._perspective.notificationLogs.push([now, FilesNotificationType.ReplyReceived, notif]);
            this.notifySubscribers();
        }
        if (SignalProtocolType.NewNotice in deliverySignal) {
            console.log("signal NewNotice", deliverySignal.NewNotice);
            /** Into Notification */
            const notif = {
                noticeEh: encodeHashToBase64(deliverySignal.NewNotice[0]),
                manifestEh: encodeHashToBase64(deliverySignal.NewNotice[2].summary.parcel_reference.eh),
                description: deliverySignal.NewNotice[2].summary.parcel_reference.description,
                sender: encodeHashToBase64(deliverySignal.NewNotice[2].sender),
            } as FilesNotificationVariantNewNoticeReceived;
            this._perspective.notificationLogs.push([now, FilesNotificationType.NewNoticeReceived, notif]);
            this.notifySubscribers();
        }
        if (SignalProtocolType.NewReceptionAck in deliverySignal) {
            console.log("signal NewReceptionAck", deliverySignal.NewReceptionAck);
            /** Into Notification */
            const notif = {
                distribAh: encodeHashToBase64(deliverySignal.NewReceptionAck[2].distribution_ah),
                recipient: encodeHashToBase64(deliverySignal.NewReceptionAck[2].recipient),
            } as FilesNotificationVariantDistributionToRecipientComplete;
            this._perspective.notificationLogs.push([now, FilesNotificationType.DistributionToRecipientComplete, notif]);
            this.notifySubscribers();
        }
    }



    // /** */
    // shouldProbePublic(): boolean {
    //     return this._latestPublic.length > 0;
    // };


    // /** */
    // protected postProbeAll(): void {
    //     console.log("postProbeAll() PublicParcels START");
    //     this.updatePublicFiles();
    // }


    // /** */
    // private async updatePublicFiles(): Promise<Dictionary<string>> {
    //     let publicFiles: Dictionary<string> = {};
    //     const pds = Object.entries(this.deliveryZvm.perspective.publicParcels);
    //     console.log("probeAllInner() PublicParcels count", Object.entries(pds).length);
    //     for (const [ppEh, [pd, _ts, _author]] of pds) {
    //         if (pd.zome_origin == "files_integrity") {
    //             try {
    //                 const manifest = await this.deliveryZvm.zomeProxy.getManifest(decodeHashFromBase64(ppEh));
    //                 publicFiles[manifest.data_hash] = ppEh;
    //                 if (this._latestPublic.includes(ppEh)) {
    //                     this._latestPublic = this._latestPublic.filter(item => item != ppEh);
    //                 }
    //             } catch(e) {
    //                 console.warn("getManifest() failed. Probably did need to wait for gossip");
    //             }
    //         }
    //     }
    //     this._perspective.publicFiles = publicFiles;
    //     this.notifySubscribers();
    //     return publicFiles;
    // }



    /** Return list of ParcelEh that holds a file with a name that matches filter */
    searchParcel(filter: string): EntryHashB64[] {
        if (filter.length < 2) {
            return [];
        }
        const pps = Object.entries(this.deliveryZvm.perspective.publicParcels)
            .filter(([_ppEh, pprm]) => !pprm.deleteInfo)
            .filter(([_ppEh, pprm]) => pprm.description.name.toLowerCase().includes(filter))
            .map(([ppEh, _tuple]) => ppEh);


        const pms = Object.entries(this.deliveryZvm.perspective.privateManifests)
            .filter(([ppEh, [manifest, _ts]]) => manifest.description.name.toLowerCase().includes(filter))
            .map(([ppEh, _tuple]) => ppEh);

        return pps.concat(pms);
    }


    /** */
    async removePublicParcel(eh: EntryHashB64) {
        const pprm = this.deliveryZvm.perspective.publicParcels[eh];
        if (!pprm) {
            return Promise.reject("No Public File found at address");
        }
        /** Remove PublicParcel */
        await this.deliveryZvm.zomeProxy.removePublicParcel(decodeHashFromBase64(pprm.prEh));
        /** Remove tags */
        const tags = this.taggingZvm.getTargetPublicTags(eh);
        console.log("removePublicParcel()", tags);
        await this.taggingZvm.untagPublicEntryAll(eh);

        /** Notify  peer */
        const pr = {eh: decodeHashFromBase64(pprm.ppEh), description: pprm.description};
        const peers = this.profilesZvm.getAgents().map((peer) => decodeHashFromBase64(peer));
        this.deliveryZvm.zomeProxy.notifyPublicParcel({peers, timestamp: pprm.creationTs /* fixme */, pr, removed: true});
        await this.deliveryZvm.probeDht();
    }


    /** Can't send to self */
    async startCommitPrivateAndSendFile(file: File, recipients: AgentPubKeyB64[], tags: string[]): Promise<SplitObject | undefined> {
        const mustSentTo = recipients
            .filter((agent) => agent != this.cell.agentPubKey);
        console.log("startCommitPrivateAndSendFile()", recipients, mustSentTo);
        if (mustSentTo.length == 0) {
            return undefined;
        }
        this._mustSendTo = mustSentTo;
        return this.startCommitPrivateFile(file, tags);
    }


    /** */
    async startCommitPrivateFile(file: File, tags: string[]): Promise<SplitObject> {
        console.log('dvm.startCommitPrivateFile: ', file, tags);
        if (this._perspective.uploadState) {
            return Promise.reject("File commit already in progress");
        }
        const splitObj = await splitFile(file, this.dnaProperties.maxChunkSize);

        /** Check if file already present */
        const maybeManifest = this.deliveryZvm.perspective.localManifestByData[splitObj.dataHash]
        if (maybeManifest) {
            console.warn("File already stored locally");
            const manifestEh = maybeManifest[0];
            if (this._mustSendTo) {
                this._sendFile(manifestEh, this.deliveryZvm.perspective.privateManifests[manifestEh][0]);
            }
            return;
        }
        this._perspective.uploadState = {
            splitObj,
            file,
            isPrivate: true,
            chunks: [],
            index: 0,
            written_chunks: 0,
        };
        this.notifySubscribers();

        /** Initiate write chunk loop */
        /* await */ this.writeChunks();
        this._mustAddTags = {isPrivate: true, tags};
        /* Done */
        return splitObj;
    }



    /** */
    async startPublishFile(file: File, tags: string[], callback?: FilesCb): Promise<SplitObject> {
        console.log('dvm.startPublishFile: ', file, tags);
        if (this._perspective.uploadState) {
            return Promise.reject("File commit already in progress");
        }
        const splitObj = await splitFile(file, this.dnaProperties.maxChunkSize);
        /** Check if file already present */
        const maybeExist = this.deliveryZvm.perspective.localManifestByData[splitObj.dataHash];
        if (maybeExist) {
            console.warn("File already stored locally");
            if (maybeExist[1]) {
                console.warn("Can't publish private file");
            } else {
                if (callback) {
                    callback(maybeExist[0]);
                }
            }
            return;
        }
        this._perspective.uploadState = {
            splitObj,
            file,
            isPrivate: false,
            chunks: [],
            index: 0,
            written_chunks: 0,
            callback,
        };
        this.notifySubscribers();

        /** Initial write chunk loop */
        /*await */ this.writeChunks();
        // this.filesZvm.zomeProxy.writePublicFileChunks([{data_hash: splitObj.dataHash, data: splitObj.chunks[0]}]);
        this._mustAddTags = {isPrivate: false, tags};
        /** Done */
        return splitObj;
    }


    /** */
    async writeChunks(): Promise<void> {
        const MAX_WEBSOCKET_PAYLOAD = 8 * 1024 * 1024;
        const num_chunks = Math.floor(MAX_WEBSOCKET_PAYLOAD / this.dnaProperties.maxChunkSize);
        const splitObj = this._perspective.uploadState.splitObj;
        const index = this._perspective.uploadState.index;
        /** Form chunks from splitObj */
        const chunks = [];
        for (let i = index; i < index + num_chunks && i < splitObj.numChunks; i += 1) {
            chunks.push({data_hash: splitObj.dataHash, data: splitObj.chunks[i]} as ParcelChunk)
        }
        this._perspective.uploadState.written_chunks += chunks.length;
        this._perspective.uploadState.index += chunks.length;
        console.log("writeChunks()", chunks.length, this._perspective.uploadState.written_chunks)
        /** Write */
        if (this._perspective.uploadState.isPrivate) {
            await this.filesZvm.zomeProxy.writePrivateFileChunks(chunks);
        } else {
            await this.filesZvm.zomeProxy.writePublicFileChunks(chunks);
        }
    }


    /** */
    async resumeInbounds() {
        const [_unreplieds, inbounds] = this.deliveryZvm.inbounds();
        for (const [noticeEh, [notice, _ts, pct]] of Object.entries(inbounds)) {
            await this.deliveryZvm.requestMissingChunks(noticeEh);
        }
    }



    // /** */
    // async publishFile(file: File): Promise<EntryHashB64> {
    //     console.log('dvm.commitPublicFile: ', file);
    //     const splitObj = await splitFile(file, this.dnaProperties.maxChunkSize);
    //     /** Check if file already present */
    //     if (this.deliveryZvm.perspective.localManifestByData[splitObj.dataHash]) {
    //         console.warn("File already stored locally");
    //         return this.deliveryZvm.perspective.localManifestByData[splitObj.dataHash];
    //     }
    //     const ehb64 = await this.filesZvm.publishFile(file, splitObj);
    //     return ehb64;
    // }


    /** */
    async getFile(ppEh: EntryHashB64): Promise<[ParcelManifest, string]> {
        const [manifest, ts] = await this.deliveryZvm.getManifest(ppEh);
        //this.deliveryZvm.perspective.chunkCounts[manifest.data_hash] = 0;
        const dataB64 = await this.deliveryZvm.getParcelData(ppEh);
        return [manifest, dataB64];
    }


    /** */
    async parcel2FileData(manifestEh: EntryHashB64): Promise<string> {
        const [_manifest, data] = await this.getFile(manifestEh);
        return data;
    }


    /** */
    data2File(manifest: ParcelManifest, data: string): File {
        let filetype = (manifest.description.kind_info as ParcelKindVariantManifest).Manifest;
        console.log("data2File()", filetype);
        const fields = filetype.split(':');
        if (fields.length > 1) {
            const types = fields[1].split(';');
            filetype = types[0];
        }
        const byteArray = base64ToArrayBuffer(data)
        const blob = new Blob([byteArray], { type: filetype});
        const file = new File([blob], manifest.description.name);
        return file;
    }


    /** */
    async parcel2File(manifestEh: EntryHashB64): Promise<File> {
        const [manifest, data] = await this.getFile(manifestEh);
        /** DEBUG - check if content is valid base64 */
        // if (!base64regex.test(data)) {
        //   const invalid_hash = sha256(data);
        //   console.error("File '" + manifest.filename + "' is invalid base64. hash is: " + invalid_hash);
        // }
        return this.data2File(manifest, data);
    }


    /** -- Import & Export -- */

    /** Dump perspective as JSON */
    async exportPerspective(): Promise<string> {
        //console.log("Dvm.exportPerspective()", name)
        const dvmExport = {};

        await this.deliveryZvm.getAllPublicManifest();
        const dJson = this.deliveryZvm.exportPerspective();
        dvmExport[DeliveryZvm.DEFAULT_ZOME_NAME] = JSON.parse(dJson);

        const pJson = this.profilesZvm.exportPerspective(/*this.originalsZvm*/);
        dvmExport[ProfilesZvm.DEFAULT_ZOME_NAME] = JSON.parse(pJson);

        // TODO
        //const tJson = this.taggingZvm.exportPerspective();
        //dvmExport[TaggingZvm.DEFAULT_ZOME_NAME] = JSON.parse(tJson);

        // const oJson = this.originalsZvm.exportPerspective();
        // dvmExport[AuthorshipZvm.DEFAULT_ZOME_NAME] = JSON.parse(oJson);

        return JSON.stringify(dvmExport, null, 2);
    }


}

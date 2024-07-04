import {delay, DnaViewModel, prettyDate, ZvmDef, ActionId, EntryId, AgentId, EntryIdMap,
    ZomeSignal, ZomeSignalProtocolType, TipProtocol, EntryPulse, LinkPulse, materializeEntryPulse, materializeLinkPulse,
    ZomeSignalProtocol, ZomeSignalProtocolVariantEntry, TipProtocolVariantEntry, StateChangeType,
} from "@ddd-qc/lit-happ";
import {
    DELIVERY_ZOME_NAME,
    DeliveryEntryType, DeliveryNotice,
    DeliveryProperties,
    DeliveryZvm,
    ParcelChunk,
    ParcelKindVariantManifest,
    ParcelManifest,
    ParcelReference,
    PublicParcelRecordMat, ReceptionAck,
    ReceptionProof, ReplyAck,
} from "@ddd-qc/delivery";
import {AppSignalCb} from "@holochain/client";
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
    FilesNotificationVariantPublicSharingComplete, FilesNotificationVariantPublicSharingRemoved,
    FilesNotificationVariantReceptionComplete, FilesNotificationVariantReplyReceived
} from "./files.perspective";
import {TaggingZvm} from "./tagging.zvm";
import {FILES_DEFAULT_ROLE_NAME} from "../bindings/files.types";
//import {NotificationsZvm} from "@ddd-qc/notifications-dvm/dist/viewModels/notifications.zvm";
import {ProfilesAltZvm, ProfilesZvm} from "@ddd-qc/profiles-dvm";



/**
 *
 */
export class FilesDvm extends DnaViewModel {

    /** For commit & send follow-up */
    /** dataHash -> recipients[] */
    private _mustSendTo: EntryIdMap<AgentId[]> = new EntryIdMap();
    /** For publish or send follow-up */
    /** dataHash -> {isPrivate, tags} */
    private _mustAddTags: EntryIdMap<Object> = new EntryIdMap();

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

    private _perspective: FilesDvmPerspective = {uploadStates: {}, notificationLogs: []};


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


    /** Store probeLog timestamp upon first load of app */
    async initializePerspectiveOnline(): Promise<void> {
        console.log("filessDvm.initializePerspectiveOffline() override")
        await super.initializePerspectiveOnline();
        this._livePeers = this.profilesZvm.getAgents(); // TODO: implement real presence logic
        console.log("filessDvm.initializePerspectiveOffline() override persp =", this.perspective)
    }


    /** -- Methods -- */

    /** */
    private _sendFile(manifestEh: EntryId, manifest: ParcelManifest) {
        const sendTo = this._mustSendTo[manifest.data_hash];
        const recipients = sendTo.map((agent) => (' ' + agent).slice(1)); // deep copy string for promise
        console.log("sendFile follow up", manifestEh, sendTo);
        this.filesZvm.sendFile(manifestEh, sendTo).then((distribAh) => {
            /** Into Notification */
            const now = Date.now();
            const addTags = this._mustAddTags[manifest.data_hash] as any;
            console.log("File delivery request sent", recipients, addTags);
            this._perspective.notificationLogs.push([now, FilesNotificationType.DeliveryRequestSent, {distribAh, manifestEh, recipients}]);
            if (addTags && addTags.isPrivate) {
                /*await*/ this.taggingZvm.tagPrivateEntry(manifestEh, addTags.tags, manifest.description.name);
                delete this._mustAddTags[manifest.data_hash];
            }
            this.notifySubscribers();
        });
        delete this._mustSendTo[manifest.data_hash];
    }


    /** */
    async downloadFile(manifestEh: EntryId): Promise<void> {
        console.log("FilesDvm.downloadFile()", manifestEh);
        const [manifest, _ts, _author] = await this.deliveryZvm.fetchPublicManifest(manifestEh);

        console.log("FilesDvm.downloadFile() manifest", manifest);
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
        let maybeParcel: PublicParcelRecordMat;
        do  {
            await delay(1000)
            await this.probeAll();
            maybeParcel = this.deliveryZvm.perspective.publicParcels.get(new EntryId(pr.parcel_eh));
            //console.log("loopUntilFound()", maybeParcel);
        } while (maybeParcel === undefined);
        /* Into Notification */
        const notif = {manifestEh: maybeParcel.parcelEh} as FilesNotificationVariantPublicSharingComplete;
        this._perspective.notificationLogs.push([maybeParcel.creationTs, FilesNotificationType.PublicSharingComplete, notif]);
        this.notifySubscribers();
    }


    /** */
    private async loopUntilRemoved(pr: ParcelReference){
        let maybeParcel: PublicParcelRecordMat;
        do  {
            await delay(1000)
            await this.probeAll();
            maybeParcel = this.deliveryZvm.perspective.publicParcels.get(new EntryId(pr.parcel_eh));
            //console.log("loopUntilRemoved()", maybeParcel);
        } while (maybeParcel && !maybeParcel.deleteInfo);
        /* Into Notification */
        const notif = {manifestEh: maybeParcel.parcelEh} as FilesNotificationVariantPublicSharingRemoved;
        this._perspective.notificationLogs.push([maybeParcel.deleteInfo[0], FilesNotificationType.PublicSharingRemoved, notif]);
        this.notifySubscribers();
    }


    /** */
    mySignalHandler(appSignal: AppSignal): void {
        console.log("FilesDvm.mySignalHandler()", appSignal);
        if (appSignal.zome_name != DELIVERY_ZOME_NAME) {
            return;
        }
        const deliverySignal = appSignal.payload as ZomeSignal;
        if (!("pulses" in deliverySignal)) {
            return;
        }
        const from = new AgentId(deliverySignal.from);
        let all = [];
        for (let pulse of deliverySignal.pulses) {
            /** -- Handle Signal according to type -- */
            /** Change tip to Entry or Link signal */
            if (ZomeSignalProtocolType.Tip in pulse) {
                pulse = this.handleTip(pulse.Tip as TipProtocol, from)!;
                if (!pulse) {
                    continue;
                }
            }
            if (ZomeSignalProtocolType.Entry in pulse) {
                all.push(this.handleEntryPulse(pulse.Entry as EntryPulse, from));
                continue;
            }
        }
        /*await */ Promise.all(all);
        console.log("FilesDvm.mySignalHandler() notifySubscribers");
        this.notifySubscribers();
    }


    /** */
    async handleEntryPulse(entryPulse: EntryPulse, from: AgentId): Promise<void> {
        const pulse = materializeEntryPulse(entryPulse, Object.values(DeliveryEntryType));
        const now = Date.now();
        switch(pulse.entryType) {
            case DeliveryEntryType.PrivateManifest:
            case DeliveryEntryType.PublicManifest: {
                const manifest = decode(pulse.bytes) as ParcelManifest;
                console.log("filesDvm received PublicManifest", pulse.eh, manifest);
                /** Follow-up send if requested */
                if (this._mustSendTo[manifest.data_hash] && this._mustSendTo[manifest.data_hash].length > 0) {
                    this._sendFile(pulse.eh, manifest);
                }
                /** Add Public tags if any */
                if (this._mustAddTags[manifest.data_hash]) {
                    const addTags = this._mustAddTags[manifest.data_hash] as any;
                    if (addTags.isPrivate) {
                        /*await*/
                        this.taggingZvm.tagPrivateEntry(pulse.eh, addTags.tags, manifest.description.name);
                    } else {
                        /*await*/
                        this.taggingZvm.tagPublicEntry(pulse.eh, addTags.tags, manifest.description.name);
                    }
                    delete this._mustAddTags[manifest.data_hash];
                }
                /** cleanup uploadState if any */
                if (this._perspective.uploadStates[manifest.data_hash]) {
                    if (this._perspective.uploadStates[manifest.data_hash].callback) {
                        this._perspective.uploadStates[manifest.data_hash].callback(pulse.eh);
                    }
                    /*await*/
                    this.cacheFile(this._perspective.uploadStates[manifest.data_hash].file);
                    delete this._perspective.uploadStates[manifest.data_hash];
                }
            }
            break;
            case DeliveryEntryType.PrivateChunk:
            case DeliveryEntryType.PublicChunk: {
                const chunk = decode(pulse.bytes) as ParcelChunk;
                const manifestPair = this.deliveryZvm.perspective.localManifestByData[chunk.data_hash];
                const uploadState = this._perspective.uploadStates[chunk.data_hash];
                console.log("ParcelChunk signal", uploadState, manifestPair);
                if (!manifestPair && uploadState) {
                    /** We are the original creator of this file */
                    if (!uploadState.chunks) {
                        uploadState.chunks = [];
                    }
                    uploadState.chunks.push(pulse.eh); // FIXME
                    //const index = uploadState.chunks.length;
                    /** Commit manifest if it was the last chunk */
                    if (uploadState.chunks.length == uploadState.splitObj.numChunks) {
                        if (uploadState.isPrivate) {
                            this.filesZvm.commitPrivateManifest(uploadState.file, uploadState.splitObj.dataHash, uploadState.chunks)
                        } else {
                            this.filesZvm.publishFileManifest(uploadState.file, uploadState.splitObj.dataHash, uploadState.chunks);
                        }
                    } else {
                        /** Otherwise commit next batch */
                        if (uploadState.chunks.length == uploadState.written_chunks) {
                            this.writeChunks(chunk.data_hash);
                        }
                    }
                    this._perspective.uploadStates[chunk.data_hash] = uploadState;
                }
            }
            break;
            case DeliveryEntryType.ReceptionProof: {
                const receptionProof = decode(pulse.bytes) as ReceptionProof;
                /** Into Notification */
                if (pulse.state == StateChangeType.Create && pulse.isNew) {
                    //this.deliveryZvm.zomeProxy.queryAllPrivateManifests().then(() => {
                    const notif = {
                        noticeEh: new EntryId(receptionProof.notice_eh),
                        manifestEh: new EntryId(receptionProof.parcel_eh),
                    } as FilesNotificationVariantReceptionComplete;
                    this._perspective.notificationLogs.push([now, FilesNotificationType.ReceptionComplete, notif]);
                    // })
                }
            }
            break;
            case DeliveryEntryType.ReplyAck: {
                const replyAck = decode(pulse.bytes) as ReplyAck;
                /** Into Notification */
                if (pulse.state == StateChangeType.Create && pulse.isNew) {
                    const notif = {
                        distribAh: new ActionId(replyAck.distribution_ah),
                        recipient: new AgentId(replyAck.recipient),
                        hasAccepted: replyAck.has_accepted,
                    } as FilesNotificationVariantReplyReceived;
                    this._perspective.notificationLogs.push([now, FilesNotificationType.ReplyReceived, notif]);
                }
            }
            break;
            case DeliveryEntryType.DeliveryNotice: {
                const notice = decode(pulse.bytes) as DeliveryNotice;
                /** Into Notification */
                if (pulse.state == StateChangeType.Create && pulse.isNew) {
                    const notif = {
                        noticeEh: pulse.eh,
                        manifestEh: new EntryId(notice.summary.parcel_reference.parcel_eh),
                        description: notice.summary.parcel_reference.description,
                        sender: new AgentId(notice.sender),
                    } as FilesNotificationVariantNewNoticeReceived;
                    this._perspective.notificationLogs.push([now, FilesNotificationType.NewNoticeReceived, notif]);
                }
            }
            break;
            case DeliveryEntryType.ReceptionAck: {
                const receptionAck = decode(pulse.bytes) as ReceptionAck;
                /** Into Notification */
                if (pulse.state == StateChangeType.Create && pulse.isNew) {
                    const notif = {
                        distribAh: new ActionId(receptionAck.distribution_ah),
                        recipient: new AgentId(receptionAck.recipient),
                    } as FilesNotificationVariantDistributionToRecipientComplete;
                    this._perspective.notificationLogs.push([now, FilesNotificationType.DistributionToRecipientComplete, notif]);
                }
            }
            break;
        }
        // /** */
        // if (tip) {
        //     await this.broadcastTip(tip);
        // }
    }


    /** */
    handleTip(tip: TipProtocol, from: AgentId): ZomeSignalProtocol | undefined {
        const type = Object.keys(tip)[0];
        console.log("handleTip()", type, from, tip);
        /* Handle tip according to its type */
        switch (type) {
            case "Ping":
            case "Pong":
                break;
            case "Entry": {
                return {Entry: (tip as TipProtocolVariantEntry).Entry} as ZomeSignalProtocolVariantEntry;
            } break;
            case "Link": //return {Link: (tip as TipProtocolVariantLink).Link} as ZomeSignalProtocolVariantLink; break;
            case "App":
                break;
        }
    }


    // /** */
    // handleTipOld() {
    //         if (DeliveryGossipProtocolType.PublicParcelPublished in gossip) {
    //             console.log("Gossip signal PublicParcelPublished dvm", gossip.PublicParcelPublished);
    //             const pr = gossip.PublicParcelPublished[2];
    //             //const ts = gossip.PublicParcelPublished[1];
    //             //const prEh = encodeHashToBase64(gossip.PublicParcelPublished[0]);
    //             const parcelEh = encodeHashToBase64(pr.parcel_eh);
    //             if (from != this.cell.agentPubKey) {
    //                 // FIXME: getManifest() fails because it gets received via gossip. Might be best to requestManifest instead?
    //                 //this.deliveryZvm.zomeProxy.getManifest(decodeHashFromBase64(ppEh)).then((manifest) => this._perspective.publicFiles[manifest.data_hash] = ppEh);
    //                 //this.probePublicFiles();
    //                 //this._latestPublic.push(ppEh);
    //                 /** Have DeliveryZvm perform probePublicParcels */
    //                 this.loopUntilFound(pr);
    //             } else {
    //                 /** Alert self that we finished publishing something */
    //                 const manifestPair = this.deliveryZvm.perspective.localPublicManifests[parcelEh];
    //                 const notif = {manifestEh: parcelEh} as FilesNotificationVariantPublicSharingComplete;
    //                 this._perspective.notificationLogs.push([now, FilesNotificationType.PublicSharingComplete, notif]);
    //                 delete this._perspective.uploadStates[manifestPair[0].data_hash];
    //                 this.notifySubscribers();
    //                 /** Notify peers that we published something */
    //                 const peers = this._peersToSignal.map((peer) => decodeHashFromBase64(peer));
    //                 console.log("PublicSharingComplete. broadcasting", peers.map((p) => encodeHashToBase64(p)));
    //                 this.deliveryZvm.zomeProxy.broadcastPublicParcelGossip({peers, timestamp: now, pr, removed: false});
    //             }
    //         }
    //         if (DeliveryGossipProtocolType.PublicParcelUnpublished in gossip) {
    //             console.log("Gossip signal PublicParcelUnpublished dvm", gossip.PublicParcelUnpublished);
    //             const pr = gossip.PublicParcelUnpublished[2];
    //             if (from != this.cell.agentPubKey) {
    //                 this.loopUntilRemoved(pr);
    //             } else {
    //                 /* Alert self */
    //                 const notif = {manifestEh: encodeHashToBase64(pr.parcel_eh)} as FilesNotificationVariantPublicSharingRemoved;
    //                 this._perspective.notificationLogs.push([now, FilesNotificationType.PublicSharingRemoved, notif]);
    //             }
    //         }
    //     }


    /** Return list of ParcelEh that holds a file with a name that matches filter */
    searchParcel(filter: string): EntryId[] {
        if (filter.length < 2) {
            return [];
        }
        const pps = Array.from(this.deliveryZvm.perspective.publicParcels.entries())
            .filter(([_ppEh, pprm]) => !pprm.deleteInfo)
            .filter(([_ppEh, pprm]) => pprm.description.name.toLowerCase().includes(filter))
            .map(([ppEh, _tuple]) => ppEh);


        const pms = Array.from(this.deliveryZvm.perspective.privateManifests.entries())
            .filter(([ppEh, [manifest, _ts]]) => manifest.description.name.toLowerCase().includes(filter))
            .map(([ppEh, _tuple]) => ppEh);

        return pps.concat(pms);
    }


    /** */
    async removePublicParcel(eh: EntryId) {
        const pprm = this.deliveryZvm.perspective.publicParcels.get(eh);
        if (!pprm) {
            return Promise.reject("No Public File found at address");
        }
        /** Remove PublicParcel */
        await this.deliveryZvm.zomeProxy.unpublishPublicParcel(pprm.prEh.hash);
        /** Remove tags */
        const tags = this.taggingZvm.getTargetPublicTags(eh);
        console.log("removePublicParcel()", tags);
        if (tags.length > 0) {
            await this.taggingZvm.untagPublicEntryAll(eh);
        }
        /** */
        await this.deliveryZvm.probeDht();
    }


    /** Can't send to self */
    async startCommitPrivateAndSendFile(file: File, recipients: AgentId[], tags: string[]): Promise<SplitObject | undefined> {
        const agents = recipients
            .filter((agent) => agent.b64 != this.cell.agentId.b64)
        console.log("startCommitPrivateAndSendFile()", recipients, agents);
        if (agents.length == 0) {
            return undefined;
        }
        return this.startCommitPrivateFile(file, tags, agents);
    }


    /** */
    async startCommitPrivateFile(file: File, tags: string[], recipients?: AgentId[]): Promise<SplitObject> {
        console.log('dvm.startCommitPrivateFile: ', file, tags);
        const splitObj = await splitFile(file, this.dnaProperties.maxChunkSize);
        if (this._perspective.uploadStates[splitObj.dataHash]) {
            return Promise.reject("File commit already in progress");
        }
        if (recipients) {
            this._mustSendTo[splitObj.dataHash] = recipients;
        }
        /** Check if file already present */
        const maybeManifest = this.deliveryZvm.perspective.localManifestByData[splitObj.dataHash]
        if (maybeManifest) {
            console.warn("File already stored locally");
            const manifestEh = maybeManifest[0];
            if (this._mustSendTo[splitObj.dataHash]) {
                this._sendFile(manifestEh, this.deliveryZvm.perspective.privateManifests.get(manifestEh)[0]);
            }
            return;
        }
        this._perspective.uploadStates[splitObj.dataHash] = {
            splitObj,
            file,
            isPrivate: true,
            chunks: [],
            index: 0,
            written_chunks: 0,
        };
        this.notifySubscribers();

        /** Initiate write chunk loop */
        /* await */ this.writeChunks(splitObj.dataHash);
        this._mustAddTags[splitObj.dataHash] = {isPrivate: true, tags};
        /* Done */
        return splitObj;
    }



    private _peersToSignal: AgentId[] = [];
    /** */
    async startPublishFile(file: File, tags: string[], peersToSignal: AgentId[], callback?: FilesCb): Promise<SplitObject> {
        console.log('dvm.startPublishFile: ', file, tags);
        const splitObj = await splitFile(file, this.dnaProperties.maxChunkSize);
        if (this._perspective.uploadStates[splitObj.dataHash]) {
            return Promise.reject("File commit already in progress");
        }
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
        this._peersToSignal = peersToSignal;
        this._perspective.uploadStates[splitObj.dataHash] = {
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
        /*await */ this.writeChunks(splitObj.dataHash);
        // this.filesZvm.zomeProxy.writePublicFileChunks([{data_hash: splitObj.dataHash, data: splitObj.chunks[0]}]);
        this._mustAddTags[splitObj.dataHash] = {isPrivate: false, tags};
        /** Done */
        return splitObj;
    }


    /** */
    async writeChunks(dataHash: string): Promise<void> {
        const MAX_WEBSOCKET_PAYLOAD = 8 * 1024 * 1024;
        const num_chunks = Math.floor(MAX_WEBSOCKET_PAYLOAD / this.dnaProperties.maxChunkSize);
        const splitObj = this._perspective.uploadStates[dataHash].splitObj;
        const index = this._perspective.uploadStates[dataHash].index;
        /** Form chunks from splitObj */
        const chunks = [];
        for (let i = index; i < index + num_chunks && i < splitObj.numChunks; i += 1) {
            chunks.push({data_hash: splitObj.dataHash, data: splitObj.chunks[i]} as ParcelChunk)
        }
        this._perspective.uploadStates[dataHash].written_chunks += chunks.length;
        this._perspective.uploadStates[dataHash].index += chunks.length;
        console.log("writeChunks()", chunks.length, this._perspective.uploadStates[dataHash].written_chunks)
        /** Write */
        if (this._perspective.uploadStates[dataHash].isPrivate) {
            await this.filesZvm.zomeProxy.writePrivateFileChunks(chunks);
        } else {
            await this.filesZvm.zomeProxy.writePublicFileChunks(chunks);
        }
    }


    /** */
    async resumeInbounds() {
        const [_unreplieds, inbounds] = this.deliveryZvm.inbounds();
        for (const noticeEh of inbounds.keys()) {
            await this.deliveryZvm.requestMissingChunks(noticeEh);
        }
    }


    /** */
    async fetchFile(ppEh: EntryId): Promise<[ParcelManifest, string]> {
        const [manifest, _ts] = await this.deliveryZvm.fetchPublicManifest(ppEh);
        //this.deliveryZvm.perspective.chunkCounts[manifest.data_hash] = 0;
        const dataB64 = await this.deliveryZvm.fetchParcelData(ppEh);
        return [manifest, dataB64];
    }


    /** */
    async parcel2FileData(manifestEh: EntryId): Promise<string> {
        const [_manifest, data] = await this.fetchFile(manifestEh);
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
    async parcel2File(manifestEh: EntryId): Promise<File> {
        const [manifest, data] = await this.fetchFile(manifestEh);
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

        //await this.deliveryZvm.probeDht();
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

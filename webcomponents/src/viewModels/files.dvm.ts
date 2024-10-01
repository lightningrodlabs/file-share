import {
    DnaViewModel,
    ZvmDef,
    ActionId,
    EntryId,
    AgentId,
    ZomeSignal,
    ZomeSignalProtocolType,
    TipProtocol,
    EntryPulse,
    LinkPulse,
    materializeEntryPulse,
    materializeLinkPulse,
    ZomeSignalProtocol,
    ZomeSignalProtocolVariantEntry,
    TipProtocolVariantEntry,
    StateChangeType,
    TipProtocolVariantLink, ZomeSignalProtocolVariantLink, assertIsDefined, EntryIdMap,
} from "@ddd-qc/lit-happ";
import {
    DELIVERY_ZOME_NAME,
    DeliveryEntryType, DeliveryNotice,
    DeliveryProperties,
    DeliveryZvm,
    ParcelChunk,
    ParcelKindVariantManifest,
    ParcelManifest,
    ReceptionAck,
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
    FilesNotificationVariantReceptionComplete, FilesNotificationVariantReplyReceived, UploadState
} from "./files.perspective";
import {TaggingZvm} from "./tagging.zvm";
import {FILES_DEFAULT_ROLE_NAME} from "../bindings/files.types";
//import {NotificationsZvm} from "@ddd-qc/notifications-dvm/dist/viewModels/notifications.zvm";
import {ProfilesAltZvm, ProfilesZvm} from "@ddd-qc/profiles-dvm";
import {ProfilesAltLinkType} from "@ddd-qc/profiles-dvm/dist/bindings/profilesAlt.integrity";
import {Dictionary} from "@ddd-qc/cell-proxy";



/**
 *
 */
export class FilesDvm extends DnaViewModel {

    /** For commit & send follow-up */
    /** dataHash -> recipients[] */
    private _mustSendTo: Dictionary<AgentId[]> = {}
    /** For publish or send follow-up */
    /** dataHash -> {isPrivate, tags} */
    private _mustAddTags: Dictionary<Object> = {}

    /** -- DnaViewModel Interface -- */

    static override readonly DEFAULT_BASE_ROLE_NAME = FILES_DEFAULT_ROLE_NAME;
    static override readonly ZVM_DEFS: ZvmDef[] = [
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

    private _perspective: FilesDvmPerspective = {fileCache: new EntryIdMap(), uploadStates: {}, notificationLogs: []};


    /** */
    get perspective(): FilesDvmPerspective { return this._perspective }


    /** */
    get dnaProperties(): DeliveryProperties {
        console.log('dnaProperties() dnaModifiers', this.cell.dnaModifiers);
        const properties = decode(this.cell.dnaModifiers.properties as Uint8Array) as DeliveryProperties;
        console.log('dnaProperties() properties', properties);
        return properties;
    }


    // /** Store probeLog timestamp upon first load of app */
    // async initializePerspectiveOnline(): Promise<void> {
    //     console.log("filessDvm.initializePerspectiveOffline() override")
    //     await super.initializePerspectiveOnline();
    //     //this._livePeers = this.profilesZvm.getAgents(); // TODO: implement real presence logic
    //     //console.log("filessDvm.initializePerspectiveOffline() livePeers", this._livePeers);
    //     console.log("filessDvm.initializePerspectiveOffline() override persp =", this.perspective)
    // }


    /** -- Methods -- */

    /** */
    private _sendFile(manifestEh: EntryId, manifest: ParcelManifest) {
        const sendTo = this._mustSendTo[manifest.data_hash];
        if (!sendTo) {
            throw Error("Unknown recipient");
        }
        //const recipients = sendTo.map((agent) => (' ' + agent).slice(1)); // deep copy string for promise
        const recipients = sendTo.map((agent) => new AgentId(agent.b64)); // deep copy string for promise
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
            file = (await this.fetchFile(manifestEh))[1];
            await this.cacheFileLocalStorage(file);
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
    async cacheFileLocalStorage(file: File) {
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
        } catch(e:any) {
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


    // /** */
    // private async loopUntilFound(pr: ParcelReference){
    //     let maybeParcel: PublicParcelRecordMat;
    //     do  {
    //         await delay(1000)
    //         await this.probeAll();
    //         maybeParcel = this.deliveryZvm.perspective.publicParcels.get(new EntryId(pr.parcel_eh));
    //         //console.log("loopUntilFound()", maybeParcel);
    //     } while (maybeParcel === undefined);
    //     /* Into Notification */
    //     const notif = {manifestEh: maybeParcel.parcelEh} as FilesNotificationVariantPublicSharingComplete;
    //     this._perspective.notificationLogs.push([maybeParcel.creationTs, FilesNotificationType.PublicSharingComplete, notif]);
    //     this.notifySubscribers();
    // }


    // /** */
    // private async loopUntilRemoved(pr: ParcelReference){
    //     let maybeParcel: PublicParcelRecordMat;
    //     do  {
    //         await delay(1000)
    //         await this.probeAll();
    //         maybeParcel = this.deliveryZvm.perspective.publicParcels.get(new EntryId(pr.parcel_eh));
    //         //console.log("loopUntilRemoved()", maybeParcel);
    //     } while (maybeParcel && !maybeParcel.deleteInfo);
    //     /* Into Notification */
    //     const notif = {manifestEh: maybeParcel.parcelEh} as FilesNotificationVariantPublicSharingRemoved;
    //     this._perspective.notificationLogs.push([maybeParcel.deleteInfo[0], FilesNotificationType.PublicSharingRemoved, notif]);
    //     this.notifySubscribers();
    // }


    /** */
    mySignalHandler(appSignal: AppSignal): void {
        console.log("FilesDvm.mySignalHandler()", appSignal);
        const zomeSignal = appSignal.payload as ZomeSignal;
        if (!("pulses" in zomeSignal)) {
            return;
        }
        const from = new AgentId(zomeSignal.from);
        if (appSignal.zome_name == DELIVERY_ZOME_NAME) {
            /*await */ this.handleDeliverySignal(zomeSignal, from);
            return;
        }
        if (appSignal.zome_name == ProfilesAltZvm.DEFAULT_ZOME_NAME) {
            /*await */ this.handleProfilesSignal(zomeSignal, from);
            return;
        }
    }

    /** */
    async handleProfilesSignal(zomeSignal: ZomeSignal, from: AgentId) {
        let all: any[] = [];
        for (let pulse of zomeSignal.pulses) {
            /** -- Handle Signal according to type -- */
            /** Change tip to Entry or Link signal */
            if (ZomeSignalProtocolType.Tip in pulse) {
                pulse = this.convertTip(pulse.Tip as TipProtocol, from)!;
                if (!pulse) {
                    continue;
                }
            }
            if (ZomeSignalProtocolType.Link in pulse) {
                const linkPulse = materializeLinkPulse(pulse.Link as LinkPulse, Object.values(ProfilesAltLinkType));
                switch(linkPulse.link_type) {
                    case ProfilesAltLinkType.PathToAgent: {
                        const peer = AgentId.from(linkPulse.target);
                        if (!this._livePeers.map(id => id.b64).includes(peer.b64)) {
                            console.log("Adding livePeer", peer.short);
                            this._livePeers.push(peer);
                        }
                    }
                    break;
                    default:
                    break;
                }
                continue;
            }
        }
        await Promise.all(all);
        console.log("FilesDvm.handleDeliverySignal() notifySubscribers");
        this.notifySubscribers();
    }


    /** */
    async handleDeliverySignal(zomeSignal: ZomeSignal, from: AgentId) {
        let all = [];
        for (let pulse of zomeSignal.pulses) {
            /** -- Handle Signal according to type -- */
            /** Change tip to Entry or Link signal */
            if (ZomeSignalProtocolType.Tip in pulse) {
                pulse = this.convertTip(pulse.Tip as TipProtocol, from)!;
                if (!pulse) {
                    continue;
                }
            }
            if (ZomeSignalProtocolType.Entry in pulse) {
                all.push(this.handleDeliveryEntryPulse(pulse.Entry as EntryPulse, from));
                continue;
            }
        }
        await Promise.all(all);
        console.log("FilesDvm.handleDeliverySignal() notifySubscribers");
        this.notifySubscribers();
    }

    /** */
    async handleDeliveryEntryPulse(entryPulse: EntryPulse, _from: AgentId): Promise<void> {
        const pulse = materializeEntryPulse(entryPulse, Object.values(DeliveryEntryType));
        const now = Date.now();
        switch(pulse.entryType) {
            case DeliveryEntryType.PrivateManifest:
            case DeliveryEntryType.PublicManifest: {
                const manifest = decode(pulse.bytes) as ParcelManifest;
                console.log("filesDvm received PublicManifest", pulse.eh, manifest);
                /** Follow-up send if requested */
                if (this._mustSendTo[manifest.data_hash] && this._mustSendTo[manifest.data_hash]!.length > 0) {
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
                    if (this._perspective.uploadStates[manifest.data_hash]!.callback) {
                        this._perspective.uploadStates[manifest.data_hash]!.callback!(pulse.eh);
                    }
                    /*await*/
                    this.cacheFileLocalStorage(this._perspective.uploadStates[manifest.data_hash]!.file);
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
                    uploadState.chunks.push(pulse.eh); // FIXME ?
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
    }


    /** */
    convertTip(tip: TipProtocol, from: AgentId): ZomeSignalProtocol | undefined {
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
            case "Link": {
                return {Link: (tip as TipProtocolVariantLink).Link} as ZomeSignalProtocolVariantLink; break;
            }
            case "App":
                break;
        }
        return undefined;
    }


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
            .filter(([_ppEh, [manifest, _ts]]) => manifest.description.name.toLowerCase().includes(filter))
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
        const tags = this.taggingZvm.perspective.getTargetPublicTags(eh);
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
            .filter((agent) => !agent.equals(this.cell.address.agentId))
        console.log("startCommitPrivateAndSendFile()", recipients, agents);
        if (agents.length == 0) {
            return undefined;
        }
        return this.startCommitPrivateFile(file, tags, agents);
    }


    /** */
    async startCommitPrivateFile(file: File, tags: string[], recipients?: AgentId[]): Promise<SplitObject | undefined> {
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
                this._sendFile(manifestEh, this.deliveryZvm.perspective.privateManifests.get(manifestEh)![0]);
            }
            return undefined;
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



    //private _peersToSignal: AgentId[] = [];
    /** */
    async startPublishFile(file: File, tags: string[], _peersToSignal: AgentId[], callback?: FilesCb): Promise<SplitObject | undefined> {
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
            return undefined;
        }
        //this._peersToSignal = peersToSignal;
        this._perspective.uploadStates[splitObj.dataHash] = {
            splitObj,
            file,
            isPrivate: false,
            chunks: [],
            index: 0,
            written_chunks: 0,
            callback,
        } as UploadState;
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
        if (!this._perspective.uploadStates[dataHash]) {
            throw Promise.reject("Missing uploadState");
        }
        const MAX_WEBSOCKET_PAYLOAD = 8 * 1024 * 1024;
        const num_chunks = Math.floor(MAX_WEBSOCKET_PAYLOAD / this.dnaProperties.maxChunkSize);
        const splitObj = this._perspective.uploadStates[dataHash]!.splitObj;
        const index = this._perspective.uploadStates[dataHash]!.index;
        /** Form chunks from splitObj */
        const chunks = [];
        for (let i = index; i < index + num_chunks && i < splitObj.numChunks; i += 1) {
            chunks.push({data_hash: splitObj.dataHash, data: splitObj.chunks[i]} as ParcelChunk)
        }
        this._perspective.uploadStates[dataHash]!.written_chunks += chunks.length;
        this._perspective.uploadStates[dataHash]!.index += chunks.length;
        console.log("writeChunks()", chunks.length, this._perspective.uploadStates[dataHash]!.written_chunks)
        /** Write */
        if (this._perspective.uploadStates[dataHash]!.isPrivate) {
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
    async fetchFileInfo(eh: EntryId): Promise<ParcelManifest> {
        const maybe = this.deliveryZvm.perspective.privateManifests.get(eh);
        if (maybe) {
            return maybe[0];
        }
        const maybePublic = this.deliveryZvm.perspective.localPublicManifests.get(eh);
        if (maybePublic) {
            return maybePublic[0];
        }
        const [manifest, _ts] = await this.deliveryZvm.fetchPublicManifest(eh);
        return manifest;
    }


    /** */
    async fetchFile(ppEh: EntryId): Promise<[ParcelManifest, File]> {
        assertIsDefined(ppEh);
        const [manifest, _ts] = await this.deliveryZvm.fetchPublicManifest(ppEh);
        const maybeData = this._perspective.fileCache.get(ppEh);
        if (maybeData) {
            return [manifest, maybeData];
        }
        //this.deliveryZvm.perspective.chunkCounts[manifest.data_hash] = 0;
        const dataB64 = await this.deliveryZvm.fetchParcelData(ppEh);
        const file = this.data2File(manifest, dataB64);
        this._perspective.fileCache.set(ppEh, file);
        return [manifest, file];
    }


    /** */
    data2File(manifest: ParcelManifest, data: string): File {
        let filetype = (manifest.description.kind_info as ParcelKindVariantManifest).Manifest;
        console.log("data2File()", filetype);
        const fields = filetype.split(':');
        if (fields.length > 1) {
            const types = fields[1]!.split(';');
            filetype = types[0]!;
        }
        /** DEBUG - check if content is valid base64 */
        // if (!base64regex.test(data)) {
        //   const invalid_hash = sha256(data);
        //   console.error("File '" + manifest.filename + "' is invalid base64. hash is: " + invalid_hash);
        // }
        /** */
        const byteArray = base64ToArrayBuffer(data)
        const blob = new Blob([byteArray], { type: filetype});
        const file = new File([blob], manifest.description.name);
        return file;
    }


    /** -- Import & Export -- */

    /** Dump perspective as JSON */
    async exportPerspective(): Promise<string> {
        //console.log("Dvm.exportPerspective()", name)
        const dvmExport: any = {};

        //await this.deliveryZvm.probeDht();

        const dJson = this.deliveryZvm.export();
        dvmExport[DeliveryZvm.DEFAULT_ZOME_NAME] = JSON.parse(dJson);

        const pJson = this.profilesZvm.export(/*this.originalsZvm*/);
        dvmExport[ProfilesZvm.DEFAULT_ZOME_NAME] = JSON.parse(pJson);

        const tJson = this.taggingZvm.export();
        dvmExport[TaggingZvm.DEFAULT_ZOME_NAME] = JSON.parse(tJson);

        // const oJson = this.originalsZvm.exportPerspective();
        // dvmExport[AuthorshipZvm.DEFAULT_ZOME_NAME] = JSON.parse(oJson);

        return JSON.stringify(dvmExport, null, 2);
    }


}

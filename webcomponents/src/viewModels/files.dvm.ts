import {AppProxy, delay, DnaViewModel, HCL, ZvmDef} from "@ddd-qc/lit-happ";
import {
    DELIVERY_ZOME_NAME,
    DeliveryProperties,
    DeliveryZvm,
    ParcelChunk,
    ParcelKindVariantManifest,
    ParcelManifest,
    ParcelReference,
    DeliverySignalProtocol,
    DeliverySignalProtocolType,
    DeliverySignal,
    DeliveryGossipProtocolType,
    DeliveryEntryKindType,
    EntryStateChange,
    PublicParcelRecordMat,
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
    private _mustSendTo: Record<EntryHashB64, AgentPubKeyB64[]> = {};
    /** For publish or send follow-up */
    /** dataHash -> {isPrivate, tags} */
    private _mustAddTags: Record<EntryHashB64, Object> = {};

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


    /** -- Methods -- */

    /** */
    private _sendFile(manifestEh: EntryHashB64, manifest: ParcelManifest) {
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
    async downloadFile(manifestEh: EntryHashB64): Promise<void> {
        console.log("FilesDvm.downloadFile()", manifestEh);
        const [manifest, _ts] = await this.deliveryZvm.fetchManifest(manifestEh);
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
            await delay(3000)
            await this.probeAll();
            maybeParcel = this.deliveryZvm.perspective.publicParcels[encodeHashToBase64(pr.parcel_eh)];
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
            await delay(3000)
            await this.probeAll();
            maybeParcel = this.deliveryZvm.perspective.publicParcels[encodeHashToBase64(pr.parcel_eh)];
            //console.log("loopUntilRemoved()", maybeParcel);
        } while (maybeParcel && !maybeParcel.deleteInfo);
        /* Into Notification */
        const notif = {manifestEh: maybeParcel.parcelEh} as FilesNotificationVariantPublicSharingRemoved;
        this._perspective.notificationLogs.push([maybeParcel.deleteInfo[0], FilesNotificationType.PublicSharingRemoved, notif]);
        this.notifySubscribers();
    }


    /** */
    mySignalHandler(signal: AppSignal): void {
        if (signal.zome_name != DELIVERY_ZOME_NAME) {
            return;
        }
        console.log("FilesDvm received signal", signal);
        if (!("pulses" in (signal.payload as Object))) {
            return;
        }

        const sig = signal.payload as DeliverySignal;
        for (const pulse of sig.pulses) {
            /*await*/ this.handleDeliverySignal(pulse, encodeHashToBase64(sig.from));
        }
    }


    /** */
    async handleDeliverySignal(deliverySignal: DeliverySignalProtocol, from: AgentPubKeyB64): Promise<void> {
        const now = Date.now();
        if (DeliverySignalProtocolType.Entry in deliverySignal) {
            const [entryInfo, entryKind] = deliverySignal.Entry;
            const hash = encodeHashToBase64(entryInfo.hash);
            const author = encodeHashToBase64(entryInfo.author);
            if (DeliveryEntryKindType.ParcelManifest in entryKind) {
                console.log("signal ParcelManifest dvm", entryKind.ParcelManifest);
                const manifest: ParcelManifest = entryKind.ParcelManifest;
                /** Follow-up send if requested */
                if (this._mustSendTo[manifest.data_hash] && this._mustSendTo[manifest.data_hash].length > 0) {
                    this._sendFile(hash, manifest);
                }
                /** Add Public tags if any */
                if (this._mustAddTags[manifest.data_hash]) {
                    const addTags = this._mustAddTags[manifest.data_hash] as any;
                    if (addTags.isPrivate) {
                        /*await*/
                        this.taggingZvm.tagPrivateEntry(hash, addTags.tags, manifest.description.name);
                    } else {
                        /*await*/
                        this.taggingZvm.tagPublicEntry(hash, addTags.tags, manifest.description.name);
                    }
                    delete this._mustAddTags[manifest.data_hash];
                }
                /** cleanup uploadState if any */
                if (this._perspective.uploadStates[manifest.data_hash]) {
                    if (this._perspective.uploadStates[manifest.data_hash].callback) {
                        this._perspective.uploadStates[manifest.data_hash].callback(hash);
                    }
                    /*await*/
                    this.cacheFile(this._perspective.uploadStates[manifest.data_hash].file);
                    delete this._perspective.uploadStates[manifest.data_hash];
                }
                /** Done */
                this.notifySubscribers();
            }
            if (DeliveryEntryKindType.ParcelChunk in entryKind) {
                console.log("signal ParcelChunk dvm", entryKind.ParcelChunk);
                //this._perspective.notificationLogs.push([now, SignalProtocolType.NewChunk, deliverySignal]);
                const chunk = entryKind.ParcelChunk;
                const manifestPair = this.deliveryZvm.perspective.localManifestByData[chunk.data_hash];
                const uploadState = this._perspective.uploadStates[chunk.data_hash];
                if (!manifestPair && uploadState) {
                    /** We are the original creator of this file */
                    if (!uploadState.chunks) {
                        uploadState.chunks = [];
                    }
                    uploadState.chunks.push(entryInfo.hash);
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
                    this.notifySubscribers();
                }
            }
            if (DeliveryEntryKindType.ReceptionProof in entryKind) {
                console.log("signal ReceptionProof dvm", entryKind.ReceptionProof);
                /** Into Notification */
                if (entryInfo.state == EntryStateChange.Created) {
                    //this.deliveryZvm.zomeProxy.queryAllPrivateManifests().then(() => {
                        const notif = {
                            noticeEh: encodeHashToBase64(entryKind.ReceptionProof.notice_eh),
                            manifestEh: encodeHashToBase64(entryKind.ReceptionProof.parcel_eh),
                        } as FilesNotificationVariantReceptionComplete;
                        this._perspective.notificationLogs.push([now, FilesNotificationType.ReceptionComplete, notif]);
                        this.notifySubscribers();
                   // })
                }
            }
            // if (DeliveryEntryKindType.DeletedPublicParcel in deliverySignal) {
            //     console.log("signal RemovedPublicParcel dvm", deliverySignal.DeletedPublicParcel);
            //     const author = encodeHashToBase64(deliverySignal.DeletedPublicParcel[3]);
            //     const pr = deliverySignal.DeletedPublicParcel[2];
            //     const timestamp = deliverySignal.DeletedPublicParcel[1];
            //     const ppEh = encodeHashToBase64(pr.parcel_eh);
            // }
            // if (DeliveryEntryKindType.PublicParcel in entryKind) {
            //     console.log("signal PublicParcel dvm", entryKind.PublicParcel);
            //     const pr = entryKind.PublicParcel;
            // }
            if (DeliveryEntryKindType.ReplyAck in entryKind) {
                console.log("signal ReplyAck", entryKind.ReplyAck);
                /** Into Notification */
                if (entryInfo.state == EntryStateChange.Created) {
                    const notif = {
                        distribAh: encodeHashToBase64(entryKind.ReplyAck.distribution_ah),
                        recipient: encodeHashToBase64(entryKind.ReplyAck.recipient),
                        hasAccepted: entryKind.ReplyAck.has_accepted,
                    } as FilesNotificationVariantReplyReceived;
                    this._perspective.notificationLogs.push([now, FilesNotificationType.ReplyReceived, notif]);
                    this.notifySubscribers();
                }
            }
            if (DeliveryEntryKindType.DeliveryNotice in entryKind) {
                console.log("signal DeliveryNotice", entryKind.DeliveryNotice);
                /** Into Notification */
                if (entryInfo.state == EntryStateChange.Created) {
                    const notif = {
                        noticeEh: hash,
                        manifestEh: encodeHashToBase64(entryKind.DeliveryNotice.summary.parcel_reference.parcel_eh),
                        description: entryKind.DeliveryNotice.summary.parcel_reference.description,
                        sender: encodeHashToBase64(entryKind.DeliveryNotice.sender),
                    } as FilesNotificationVariantNewNoticeReceived;
                    this._perspective.notificationLogs.push([now, FilesNotificationType.NewNoticeReceived, notif]);
                    this.notifySubscribers();
                }
            }
            if (DeliveryEntryKindType.ReceptionAck in entryKind) {
                console.log("signal ReceptionAck", entryKind.ReceptionAck);
                /** Into Notification */
                if (entryInfo.state == EntryStateChange.Created) {
                    const notif = {
                        distribAh: encodeHashToBase64(entryKind.ReceptionAck.distribution_ah),
                        recipient: encodeHashToBase64(entryKind.ReceptionAck.recipient),
                    } as FilesNotificationVariantDistributionToRecipientComplete;
                    this._perspective.notificationLogs.push([now, FilesNotificationType.DistributionToRecipientComplete, notif]);
                    this.notifySubscribers();
                }
            }
        }
        if (DeliverySignalProtocolType.Gossip in deliverySignal) {
            console.log("signal Gossip dvm", deliverySignal.Gossip);
            const gossip = deliverySignal.Gossip;

            if (DeliveryGossipProtocolType.PublicParcelPublished in gossip) {
                console.log("Gossip signal PublicParcelPublished dvm", gossip.PublicParcelPublished);
                const pr = gossip.PublicParcelPublished[2];
                //const ts = gossip.PublicParcelPublished[1];
                //const prEh = encodeHashToBase64(gossip.PublicParcelPublished[0]);
                const parcelEh = encodeHashToBase64(pr.parcel_eh);
                if (from != this.cell.agentPubKey) {
                    // FIXME: getManifest() fails because it gets received via gossip. Might be best to requestManifest instead?
                    //this.deliveryZvm.zomeProxy.getManifest(decodeHashFromBase64(ppEh)).then((manifest) => this._perspective.publicFiles[manifest.data_hash] = ppEh);
                    //this.probePublicFiles();
                    //this._latestPublic.push(ppEh);
                    /** Have DeliveryZvm perform probePublicParcels */
                    this.loopUntilFound(pr);
                } else {
                    /** Alert self that we finished publishing something */
                    const manifestPair = this.deliveryZvm.perspective.localPublicManifests[parcelEh];
                    const notif = {manifestEh: parcelEh} as FilesNotificationVariantPublicSharingComplete;
                    this._perspective.notificationLogs.push([now, FilesNotificationType.PublicSharingComplete, notif]);
                    delete this._perspective.uploadStates[manifestPair[0].data_hash];
                    this.notifySubscribers();
                    /** Notify peers that we published something */
                    const peers = this._peersToSignal.map((peer) => decodeHashFromBase64(peer));
                    console.log("PublicSharingComplete. broadcasting", peers.map((p) => encodeHashToBase64(p)));
                    this.deliveryZvm.zomeProxy.broadcastPublicParcelGossip({peers, timestamp: now, pr, removed: false});
                }
            }
            if (DeliveryGossipProtocolType.PublicParcelUnpublished in gossip) {
                console.log("Gossip signal PublicParcelUnpublished dvm", gossip.PublicParcelUnpublished);
                const pr = gossip.PublicParcelUnpublished[2];
                if (from != this.cell.agentPubKey) {
                    this.loopUntilRemoved(pr);
                } else {
                    /* Alert self */
                    const notif = {manifestEh: encodeHashToBase64(pr.parcel_eh)} as FilesNotificationVariantPublicSharingRemoved;
                    this._perspective.notificationLogs.push([now, FilesNotificationType.PublicSharingRemoved, notif]);
                }
            }
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
    async removePublicParcel(eh: EntryHashB64, peersToSignal: AgentPubKeyB64[]) {
        const pprm = this.deliveryZvm.perspective.publicParcels[eh];
        if (!pprm) {
            return Promise.reject("No Public File found at address");
        }
        /** Remove PublicParcel */
        await this.deliveryZvm.zomeProxy.unpublishPublicParcel(decodeHashFromBase64(pprm.prEh));
        /** Remove tags */
        const tags = this.taggingZvm.getTargetPublicTags(eh);
        console.log("removePublicParcel()", tags);
        if (tags.length > 0) {
            await this.taggingZvm.untagPublicEntryAll(eh);
        }
        /** Signal peers */
        const pr: ParcelReference = {parcel_eh: decodeHashFromBase64(pprm.parcelEh), description: pprm.description};
        const peers = peersToSignal.map((peer) => decodeHashFromBase64(peer));
        this.deliveryZvm.zomeProxy.broadcastPublicParcelGossip({peers, timestamp: pprm.creationTs /* fixme */, pr, removed: true});
        await this.deliveryZvm.probeDht();
    }


    /** Can't send to self */
    async startCommitPrivateAndSendFile(file: File, recipients: AgentPubKeyB64[], tags: string[]): Promise<SplitObject | undefined> {
        const agents = recipients
            .filter((agent) => agent != this.cell.agentPubKey);
        console.log("startCommitPrivateAndSendFile()", recipients, agents);
        if (agents.length == 0) {
            return undefined;
        }
        return this.startCommitPrivateFile(file, tags, agents);
    }


    /** */
    async startCommitPrivateFile(file: File, tags: string[], recipients?: AgentPubKeyB64[]): Promise<SplitObject> {
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
                this._sendFile(manifestEh, this.deliveryZvm.perspective.privateManifests[manifestEh][0]);
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



    private _peersToSignal: AgentPubKeyB64[] = [];
    /** */
    async startPublishFile(file: File, tags: string[], peersToSignal: AgentPubKeyB64[], callback?: FilesCb): Promise<SplitObject> {
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
    async fetchFile(ppEh: EntryHashB64): Promise<[ParcelManifest, string]> {
        const [manifest, ts] = await this.deliveryZvm.fetchManifest(ppEh);
        //this.deliveryZvm.perspective.chunkCounts[manifest.data_hash] = 0;
        const dataB64 = await this.deliveryZvm.getParcelData(ppEh);
        return [manifest, dataB64];
    }


    /** */
    async parcel2FileData(manifestEh: EntryHashB64): Promise<string> {
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
    async parcel2File(manifestEh: EntryHashB64): Promise<File> {
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

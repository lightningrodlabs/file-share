import {
    ActionHashB64,
    decodeHashFromBase64,
    encodeHashToBase64,
    EntryHash, EntryHashB64
} from '@holochain/client';
import {delay, ZomeViewModel} from "@ddd-qc/lit-happ";
import {TaggingProxy} from "../bindings/tagging.proxy";
import {Dictionary} from "@ddd-qc/cell-proxy";
import {TaggingInput, UntagInput} from "../bindings/tagging.types";


/** */
export interface TaggingPerspective {
    /** tag string -> [target eh, target link tag][] */
    publicTags: Dictionary<[EntryHashB64, string][]>,
    /** tag string -> [target eh, target link tag][] */
    privateTags: Dictionary<[EntryHashB64, string][]>,
    /** Any EntryHash -> tags */
    publicTagsByTarget: Dictionary<string[]>,
    /** Any EntryHash -> tags */
    privateTagsByTarget: Dictionary<string[]>,
}


/** */
export function createTaggingPerspective(): TaggingPerspective {
    return { publicTags: {}, privateTags: {}, publicTagsByTarget: {}, privateTagsByTarget: {}}
}


/** */
export class TaggingZvm extends ZomeViewModel {

    static readonly ZOME_PROXY = TaggingProxy;

    get zomeProxy(): TaggingProxy {
        return this._zomeProxy as TaggingProxy;
    }


    /** -- ViewModel -- */

    private _perspective: TaggingPerspective = createTaggingPerspective();


    /* */
    get perspective(): TaggingPerspective {
        return this._perspective;
    }


    /* */
    protected hasChanged(): boolean {
        // TODO
        return true;
    }


    /** */
    async initializePerspectiveOffline(): Promise<void> {
        const tuples = await this.zomeProxy.queryAllPrivateTags();
        console.log("tagging tuples", tuples);
        for (const [_eh, _ts, tag] of tuples) {
            await this.getPrivateEntriesWithTag(tag);
        }
    }


    /** */
    async initializePerspectiveOnline(): Promise<void> {
        const tuples = await this.zomeProxy.getAllPublicTags();
        for (const [_eh, tag] of tuples) {
            await this.probePublicEntriesWithTag(tag);
        }
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

    get allPublicTags(): string[] {return Object.keys(this._perspective.publicTags) }
    get allPrivateTags(): string[] {return Object.keys(this._perspective.privateTags) }


    /** */
    async getPrivateEntriesWithTag(tag: string): Promise<[EntryHashB64, string][]> {
        const targets: [EntryHashB64, string][] = (await this.zomeProxy.getPrivateEntriesWithTag(tag))
            .map(([eh, lt]) => [encodeHashToBase64(eh), lt]);
        this._perspective.privateTags[tag] = targets;
        for (const[target, _lt] of targets) {
            if (!this._perspective.privateTagsByTarget[target]) {
                this._perspective.privateTagsByTarget[target] = []
            }
            this._perspective.privateTagsByTarget[target].push(tag);
        }
        this.notifySubscribers();
        return targets;
    }


    /** */
    async probePublicEntriesWithTag(tag: string): Promise<[EntryHashB64, string][]> {
        const targets: [EntryHashB64, string][] = (await this.zomeProxy.getPublicEntriesWithTag(tag))
            .map(([eh, lt]) => [encodeHashToBase64(eh), lt]);
        this._perspective.publicTags[tag] = targets;
        for (const[target, _lt] of targets) {
            if (!this._perspective.publicTagsByTarget[target]) {
                this._perspective.publicTagsByTarget[target] = []
            }
            this._perspective.publicTagsByTarget[target].push(tag);
        }
        this.notifySubscribers();
        return targets;
    }


    /** */
    getTargetPrivateTags(eh: EntryHashB64): string[] {
        if (!this._perspective.privateTagsByTarget[eh]) {
            return [];
        }
        return this._perspective.privateTagsByTarget[eh];
    }


    /** */
    getTargetPublicTags(eh: EntryHashB64): string[] {
        if (!this._perspective.publicTagsByTarget[eh]) {
            return [];
        }
        return this._perspective.publicTagsByTarget[eh];
    }

    /** */
    async probeTargetPublicTags(eh: EntryHashB64): Promise<string[]> {
        const tags = await this.zomeProxy.getPublicTags(decodeHashFromBase64(eh));
        this._perspective.publicTagsByTarget[eh] = tags;
        for (const tag of tags) {
            if (this._perspective.publicTags[tag]) {
                continue;
            }
            /** new tag discovered, so get all its targets */
            await this.probePublicEntriesWithTag(tag);
        }
        this.notifySubscribers();
        return tags;
    }



    /** */
    async addPrivateTag(tag: string) {
        console.log("taggingZvm.addPrivateTag()", tag);
        if (!tag || tag == "") {
            return;
        }
        let _eh = await this.zomeProxy.createPrivateTag(tag);
        this._perspective.privateTags[tag] = [];
        this.notifySubscribers();
    }


    /** */
    async addPublicTag(tag: string) {
        if (!tag || tag == "") {
            return;
        }
        let _eh = await this.zomeProxy.createPublicTag(tag);
        this._perspective.publicTags[tag] = [];
        this.notifySubscribers();
    }


    /** */
    async untagPrivateEntry(eh: EntryHashB64, tag: string) {
        const input = {
            target: decodeHashFromBase64(eh),
            tag,
        } as UntagInput;
        await this.zomeProxy.untagPrivateEntry(input);
        /** update perspective */
        const isSameEh = (pair) => eh == pair[0];
        const i = this._perspective.privateTags[tag].findIndex(isSameEh);
        if (i > -1) {
            this._perspective.privateTags[tag].splice(i, 1);
        }
        /** */
        const index = this._perspective.privateTagsByTarget[eh].indexOf(tag);
        if (index > -1) {
            this._perspective.privateTagsByTarget[eh].splice(index, 1);
        }
        /** Done */
        this.notifySubscribers();
    }


    /** */
    async tagPrivateEntry(eh: EntryHashB64, tags: string[], targetInfo: string) {
        console.log("tagPrivateEntry", eh, tags)
        const input = {
            target: decodeHashFromBase64(eh),
            tags,
            link_tag_to_entry: targetInfo,
        } as TaggingInput;
        await this.zomeProxy.tagPrivateEntry(input);
        /** update perspective */
        for (const tag of tags) {
            if (!this._perspective.privateTags[tag]) {
                this._perspective.privateTags[tag] = [];
            }
            this._perspective.privateTags[tag].push([eh, targetInfo])
            if (!this._perspective.privateTagsByTarget[eh]) {
                this._perspective.privateTagsByTarget[eh] = [];
            }
            this._perspective.privateTagsByTarget[eh].push(tag);
        }
        this.notifySubscribers();
    }


    /** */
    async tagPublicEntry(eh: EntryHashB64, tags: string[], targetInfo: string) {
        //console.log("taggingZvm.tagPublicEntry()", targetInfo, tags, eh);
        const input = {
            target: decodeHashFromBase64(eh),
            tags,
            link_tag_to_entry: targetInfo,
        } as TaggingInput;
        await this.zomeProxy.tagPublicEntry(input);
        /** update perspective */
        for (const tag of tags) {
            if (!this._perspective.publicTags[tag]) {
                this._perspective.publicTags[tag] = [];
            }
            this._perspective.publicTags[tag].push([eh, targetInfo])
            if (!this._perspective.publicTagsByTarget[eh]) {
                this._perspective.publicTagsByTarget[eh] = [];
            }
            this._perspective.publicTagsByTarget[eh].push(tag);
        }
        this.notifySubscribers();
    }
}

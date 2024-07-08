import {
    delay,
    ZomeViewModel,
    ActionId,
    EntryId,
    EntryIdMap,
    ZomeViewModelWithSignals,
    EntryPulseMat, AgentId, LinkPulseMat, StateChangeType
} from "@ddd-qc/lit-happ";
import {TaggingProxy} from "../bindings/tagging.proxy";
import {Dictionary} from "@ddd-qc/cell-proxy";
import {PrivateTag, TaggingInput, UntagInput} from "../bindings/tagging.types";
import {TaggingLinkType, TaggingUnitEnum} from "../bindings/tagging.integrity";
import {decode} from "@msgpack/msgpack";


/** */
export interface TaggingPerspective {
    /** tag string -> [link_ah, target eh, target link tag][] */
    publicTags: Dictionary<[ActionId, EntryId, string][]>,
    /** tag string -> [target eh, target link tag][] */
    privateTags: Dictionary<[ActionId, EntryId, string][]>,
    /** Any EntryHash -> tags */
    publicTagsByTarget: EntryIdMap<string[]>,
    /** Any EntryHash -> tags */
    privateTagsByTarget: EntryIdMap<string[]>,
}


/** */
export function createTaggingPerspective(): TaggingPerspective {
    return { publicTags: {}, privateTags: {}, publicTagsByTarget: new EntryIdMap(), privateTagsByTarget: new EntryIdMap()}
}


/** */
export class TaggingZvm extends ZomeViewModelWithSignals {

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

    /** -- Getters -- */

    get allPublicTags(): string[] {return Object.keys(this._perspective.publicTags) }
    get allPrivateTags(): string[] {return Object.keys(this._perspective.privateTags) }

    /** */
    getTargetPrivateTags(eh: EntryId): string[] {
        if (!this._perspective.privateTagsByTarget.get(eh)) {
            return [];
        }
        return this._perspective.privateTagsByTarget.get(eh);
    }

    /** */
    getTargetPublicTags(eh: EntryId): string[] {
        if (!this._perspective.publicTagsByTarget.get(eh)) {
            return [];
        }
        return this._perspective.publicTagsByTarget.get(eh);
    }


    /** -- Init -- */

    /** */
    async initializePerspectiveOffline(): Promise<void> {
        const tuples = await this.zomeProxy.queryAllPrivateTag();
        console.log("tagging tuples", tuples);
        for (const [_eh, _ts, tag] of tuples) {
            await this.findPrivateEntriesWithTag(tag);
        }
    }


    /** */
    async initializePerspectiveOnline(): Promise<void> {
        const tuples = await this.zomeProxy.probePublicTags();
        for (const [_eh, tag] of tuples) {
            await this.findPublicEntriesWithTag(tag);
        }
    }


    /** -- Signals -- */

    /** */
    async handleLinkPulse(pulse: LinkPulseMat, from: AgentId): Promise<void> {
        /** */
        switch (pulse.link_type) {
            case TaggingLinkType.PrivateEntry: break;
            case TaggingLinkType.PublicEntry: break;
            case TaggingLinkType.PublicTags: break;
            case TaggingLinkType.PrivateTags: {
                const profileAh = ActionId.from(pulse.target);
                if (pulse.state != StateChangeType.Delete) {

                }
            }
            break;
        }
    }


    /** */
    async handleEntryPulse(pulse: EntryPulseMat, from: AgentId) {
        switch (pulse.entryType) {
            case TaggingUnitEnum.PrivateTag:
                const privateTag = decode(pulse.bytes) as PrivateTag;
                if (pulse.state != StateChangeType.Delete) {
                    this._perspective.privateTags[privateTag.value] = [];
                } else {

                }
                break;
        }
    }


    /** -- Methods -- */

    /** */
    async findPrivateEntriesWithTag(tag: string): Promise<[ActionId, EntryId, string][]> {
        const targets: [ActionId, EntryId, string][] = (await this.zomeProxy.findPrivateEntriesWithTag(tag))
            .map(([eh, lt]) => [undefined, new EntryId(eh), lt]);
        console.log("findPrivateEntriesWithTag()", tag, targets);
        // this._perspective.privateTags[tag] = targets;
        // for (const[_ah, target, _lt] of targets) {
        //     if (!this._perspective.privateTagsByTarget.get(target)) {
        //         this._perspective.privateTagsByTarget.set(target, []);
        //     }
        //     this._perspective.privateTagsByTarget.get(target).push(tag);
        // }
        // this.notifySubscribers();
        return targets;
    }


    /** */
    async findPublicEntriesWithTag(tag: string): Promise<[ActionId, EntryId, string][]> {
        const targets: [ActionId, EntryId, string][] = (await this.zomeProxy.findPublicEntriesWithTag(tag))
            .map(([ah, eh, lt]) => [new ActionId(ah), new EntryId(eh), lt]);
        console.log("findPublicEntriesWithTag()", tag, targets);
        // this._perspective.publicTags[tag] = targets;
        // for (const[linkAh, target, _lt] of targets) {
        //     if (!this._perspective.publicTagsByTarget.get(target)) {
        //         this._perspective.publicTagsByTarget.set(target, []);
        //     }
        //     this._perspective.publicTagsByTarget.get(target).push(tag);
        // }
        // this.notifySubscribers();
        return targets;
    }




    /** */
    async findPublicTagsForTarget(eh: EntryId): Promise<string[]> {
        const tags = await this.zomeProxy.findPublicTagsForEntry(eh.hash);
        //this._perspective.publicTagsByTarget.set(eh, tags);
        for (const tag of tags) {
            if (this._perspective.publicTags[tag]) {
                continue;
            }
            /** new tag discovered, so get all its targets */
            await this.findPublicEntriesWithTag(tag);
        }
        //this.notifySubscribers();
        return tags;
    }



    /** */
    async commitPrivateTag(tag: string) {
        console.log("taggingZvm.commitPrivateTag()", tag);
        if (!tag || tag == "") {
            return;
        }
        let eh = await this.zomeProxy.commitPrivateTag(tag);
        return new EntryId(eh);
    }


    /** */
    async publishPublicTag(tag: string) {
        if (!tag || tag == "") {
            return;
        }
        let eh = await this.zomeProxy.publishPublicTag(tag);
        return new EntryId(eh);
    }


    /** */
    async untagPrivateEntry(eh: EntryId, tag: string) {
        console.log("taggingZvm.untagPrivateEntry()", eh, tag);
        const input = {
            target: eh.hash,
            tag,
        } as UntagInput;
        await this.zomeProxy.untagPrivateEntry(input);
        // /** update perspective */
        // const isSameEh = (pair) => eh == pair[0];
        // const i = this._perspective.privateTags[tag].findIndex(isSameEh);
        // if (i > -1) {
        //     this._perspective.privateTags[tag].splice(i, 1);
        // }
        // /** */
        // const index = this._perspective.privateTagsByTarget.get(eh).indexOf(tag);
        // if (index > -1) {
        //     this._perspective.privateTagsByTarget.get(eh).splice(index, 1);
        // }
        // /** Done */
        // this.notifySubscribers();
    }


    /** */
    async untagPublicEntryAll(eh: EntryId) {
        const tags = this._perspective.publicTagsByTarget.get(eh);
        console.log("taggingZvm.untagPublicEntryAll()", eh);
        if (!tags) {
            return Promise.reject("Target PublicEntry not found");
        }
        for (const tag of tags) {
            const index = this._perspective.publicTags[tag].findIndex((tuple) => tuple[1] == eh);
            console.log("untagPublicEntryAll() tag ", tag, index);
            const tuple = this._perspective.publicTags[tag][index];
            await this.zomeProxy.untagPublicEntry(tuple[0].hash);
            //this._perspective.publicTags[tag].splice(index, 1);
        }
        // /** update perspective */
        // this._perspective.publicTagsByTarget.delete(eh);
        // /** Done */
        // this.notifySubscribers();
    }


    /** */
    async tagPrivateEntry(eh: EntryId, tags: string[], targetInfo: string) {
        console.log("taggingZvm.tagPrivateEntry()", eh, tags);
        if (tags.length == 0) {
            return;
        }
        const input = {
            target: eh.hash,
            tags,
            link_tag_to_entry: targetInfo,
        } as TaggingInput;
        await this.zomeProxy.tagPrivateEntry(input);
        // /** update perspective */
        // for (const tag of tags) {
        //     if (!this._perspective.privateTags[tag]) {
        //         this._perspective.privateTags[tag] = [];
        //     }
        //     this._perspective.privateTags[tag].push([undefined, eh, targetInfo])
        //     if (!this._perspective.privateTagsByTarget.get(eh)) {
        //         this._perspective.privateTagsByTarget.set(eh, []);
        //     }
        //     this._perspective.privateTagsByTarget.get(eh).push(tag);
        // }
        // this.notifySubscribers();
    }


    /** */
    async tagPublicEntry(eh: EntryId, tags: string[], targetInfo: string) {
        console.log("taggingZvm.tagPublicEntry()", targetInfo, tags, eh);
        if (tags.length == 0) {
            return;
        }
        const input = {
            target: eh.hash,
            tags,
            link_tag_to_entry: targetInfo,
        } as TaggingInput;
        const _link_ahs = await this.zomeProxy.tagPublicEntry(input);
        //let i = 0;
        // /** update perspective */
        // for (const tag of tags) {
        //     if (!this._perspective.publicTags[tag]) {
        //         this._perspective.publicTags[tag] = [];
        //     }
        //     this._perspective.publicTags[tag].push([new ActionId(link_ahs[i]), eh, targetInfo])
        //     if (!this._perspective.publicTagsByTarget.get(eh)) {
        //         this._perspective.publicTagsByTarget.set(eh, []);
        //     }
        //     this._perspective.publicTagsByTarget.get(eh).push(tag);
        //     i += 1;
        // }
        // this.notifySubscribers();
    }
}

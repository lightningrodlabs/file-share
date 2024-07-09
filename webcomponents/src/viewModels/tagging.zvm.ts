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
import {PrivateTag, PUBLIC_TAG_ROOT, TaggingInput, UntagInput} from "../bindings/tagging.types";
import {TaggingLinkType, TaggingUnitEnum} from "../bindings/tagging.integrity";
import {decode} from "@msgpack/msgpack";
import {decodeComponentUtf32} from "../utils";


export type TaggingPerspective = TaggingPerspectiveCore & TaggingPerspectiveLive;


/** */
export interface TaggingPerspectiveCore {
    /** tagEh -> tag string */
    publicEhs: EntryIdMap<string>,
    /** tag string -> (target_eh -> link_ah) */
    publicTags: Dictionary<EntryIdMap<ActionId | null>>,
    /** tag string -> (target_eh -> link_ah) */
    privateTags: Dictionary<EntryIdMap<ActionId>>,
    /** tagEh -> tag string */
    privateEhs: EntryIdMap<string>,
}


export interface TaggingPerspectiveLive {
    /** Any EntryHash -> tags */
    publicTagsByTarget: EntryIdMap<string[]>,
    /** Any EntryHash -> tags */
    privateTagsByTarget: EntryIdMap<string[]>,
}


/** */
export function createTaggingPerspective(): TaggingPerspective {
    return {
        publicEhs: new EntryIdMap(),
        publicTags: {},
        privateTags: {},
        privateEhs: new EntryIdMap(),
        /** */
        publicTagsByTarget: new EntryIdMap(),
        privateTagsByTarget: new EntryIdMap()
    }
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
        console.log("taggingZvm.initializePerspectiveOnline()", tuples);
        for (const [_eh, tag] of tuples) {
            await this.findPublicEntriesWithTag(tag);
        }
    }


    /** -- Signals -- */

    /** */
    async handleEntryPulse(pulse: EntryPulseMat, from: AgentId) {
        switch (pulse.entryType) {
            case TaggingUnitEnum.PrivateTag:
                const privateTag = decode(pulse.bytes) as PrivateTag;
                console.log("TaggingZvm.handleEntryPulse() PrivateTag", privateTag.value, pulse.eh);
                if (pulse.state != StateChangeType.Delete && !this._perspective.privateTags[privateTag.value]) {
                    //this._perspective.privateTags[privateTag.value] = new EntryIdMap();
                    this._perspective.privateEhs.set(pulse.eh, privateTag.value);
                } else {
                    this._perspective.privateEhs.delete(pulse.eh);
                }
                break;
        }
    }


    /** */
    async handleLinkPulse(pulse: LinkPulseMat, from: AgentId): Promise<void> {
        //console.log("TaggingZvm.handleLinkPulse()", pulse, from);
        /** */
        switch (pulse.link_type) {
            case TaggingLinkType.PublicPath: {
                const tagEh = EntryId.from(pulse.target);
                const tag = decodeComponentUtf32(pulse.tag);
                console.log("TaggingZvm.handleLinkPulse() PublicPath", tag, pulse.tag);
                if (tag == PUBLIC_TAG_ROOT) {
                    return;
                }
                if (pulse.state != StateChangeType.Delete) {
                    if (!this._perspective.publicTags[tag]) {
                        this._perspective.publicTags[tag] = new EntryIdMap();
                    }
                    this._perspective.publicEhs.set(tagEh, tag);
                }
            }
            break;
            case TaggingLinkType.PublicEntry: {
                const tagEh = EntryId.from(pulse.base);
                const targetEh = EntryId.from(pulse.target);
                const tag = this._perspective.publicEhs.get(tagEh);
                console.log("TaggingZvm.handleLinkPulse() PublicEntry", tag, tagEh);
                if (!tag) {
                    console.warn("Unknown Public tagEh", tagEh);
                    return;
                }
                if (pulse.state != StateChangeType.Delete) {
                    this.storePublicTagging(tag, targetEh, pulse.create_link_hash);
                } else {
                    this.unstorePublicTagging(tag, targetEh)
                }
            }
            break;
            case TaggingLinkType.PublicTags: {
                const targetEh = EntryId.from(pulse.base);
                const decoder = new TextDecoder('utf-8');
                const tag = decoder.decode(pulse.tag);
                console.log("TaggingZvm.handleLinkPulse() PublicTags", tag, pulse.tag, targetEh);
                if (pulse.state != StateChangeType.Delete) {
                    this.storePublicTagging(tag, targetEh, null/*pulse.create_link_hash*/);
                } else {
                    this.unstorePublicTagging(tag, targetEh);
                }
            }
            break;
            /** -- Private -- */
            case TaggingLinkType.PrivateTags: break;
            case TaggingLinkType.PrivateEntry: {
                const tagEh = EntryId.from(pulse.base);
                const targetEh = EntryId.from(pulse.target);
                //const decoder = new TextDecoder('utf-8');
                //const tag = decoder.decode(pulse.tag);
                const tag = this._perspective.privateEhs.get(tagEh);
                console.log("TaggingZvm.handleLinkPulse() PrivateTags", tag, targetEh, tagEh);
                if (!tag) {
                    console.warn("Unknown Private tagEh", tagEh);
                    return;
                }
                if (pulse.state != StateChangeType.Delete) {
                    if (!this._perspective.privateTags[tag]) {
                        this._perspective.privateTags[tag] = new EntryIdMap();
                    }
                    this._perspective.privateTags[tag].set(targetEh, pulse.create_link_hash);
                    if (!this._perspective.privateTagsByTarget.get(targetEh)) {
                        this._perspective.privateTagsByTarget.set(targetEh, []);
                    }
                    this._perspective.privateTagsByTarget.get(targetEh).push(tag);
                } else {
                    /** Delete */
                    const targets = this._perspective.privateTags[tag];
                    if (targets && targets.has(targetEh)) {
                        targets.delete(targetEh);
                    }
                    const tags = this._perspective.privateTagsByTarget.get(targetEh);
                    if (tags) {
                        const i = tags.findIndex((taggy) => taggy == tag);
                        if (i > -1) {
                            tags.splice(i, 1)
                            this._perspective.privateTagsByTarget.set(targetEh, tags);
                        }
                    }
                }
            }
            break;
        }
    }


    /** */
    storePublicTagging(tag: string, targetEh: EntryId, linkAh: ActionId | null) {
        if (!this._perspective.publicTags[tag]) {
            this._perspective.publicTags[tag] = new EntryIdMap();
        }
        const maybeLinkAh = this._perspective.publicTags[tag].get(targetEh);
        if (!maybeLinkAh || maybeLinkAh == null) {
            this._perspective.publicTags[tag].set(targetEh, linkAh);
        }
        /** publicTagsByTarget */
        if (!this._perspective.publicTagsByTarget.get(targetEh)) {
            this._perspective.publicTagsByTarget.set(targetEh, []);
        }
        if (!this._perspective.publicTagsByTarget.get(targetEh).includes(tag)) {
            this._perspective.publicTagsByTarget.get(targetEh).push(tag);
        }
    }

    /** */
    unstorePublicTagging(tag: string, targetEh: EntryId) {
        const targets = this._perspective.publicTags[tag];
        if (targets && targets.has(targetEh)) {
            targets.delete(targetEh);
        }
        const tags = this._perspective.publicTagsByTarget.get(targetEh);
        if (tags) {
            const i = tags.findIndex((taggy) => taggy == tag);
            if (i > -1) {
                tags.splice(i, 1);
                this._perspective.publicTagsByTarget.set(targetEh, tags);
            }
        }
    }


    /** -- Methods -- */

    /** */
    async findPrivateEntriesWithTag(tag: string): Promise<void> {
        if (!tag || tag == "") {
            return Promise.reject("tag argument is empty");
        }
        await this.zomeProxy.findPrivateEntriesWithTag(tag);
    }


    /** */
    async findPublicEntriesWithTag(tag: string): Promise<void> {
        if (!tag || tag == "") {
            return Promise.reject("tag argument is empty");
        }
        const _res = await this.zomeProxy.findPublicEntriesWithTag(tag);
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
    async untagPrivateEntry(targetEh: EntryId, tag: string) {
        console.log("taggingZvm.untagPrivateEntry()", targetEh, tag);
        const input = {
            target: targetEh.hash,
            tag,
        } as UntagInput;
        await this.zomeProxy.untagPrivateEntry(input);
    }


    /** */
    async untagPublicEntryAll(targetEh: EntryId) {
        console.log("taggingZvm.untagPublicEntryAll()", targetEh);
        const tags = this._perspective.publicTagsByTarget.get(targetEh);
        if (!tags) {
            return Promise.reject("Not tags found for Target");
        }
        for (const tag of tags) {
            const linkAh = this._perspective.publicTags[tag].get(targetEh);
            if (linkAh && linkAh != null) {
                await this.zomeProxy.untagPublicEntry(linkAh.hash);
            } else {
                console.warn("PublicEntry linkAh is missing", linkAh, targetEh, tag);
            }
        }
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
    }
}

import {
    EntryId,
    ZomeViewModelWithSignals,
    EntryPulseMat, AgentId, LinkPulseMat, StateChangeType, holoIdReviver
} from "@ddd-qc/lit-happ";
import {TaggingProxy} from "../bindings/tagging.proxy";
import {PrivateTag, PUBLIC_TAG_ROOT, TaggingInput, UntagInput} from "../bindings/tagging.types";
import {TaggingLinkType, TaggingUnitEnum} from "../bindings/tagging.integrity";
import {decode} from "@msgpack/msgpack";
import {decodeComponentUtf32} from "../utils";
import {TaggingPerspective, TaggingPerspectiveMutable, TaggingSnapshot} from "./tagging.perspective";



/** */
export class TaggingZvm extends ZomeViewModelWithSignals {

    static override readonly ZOME_PROXY = TaggingProxy;

    get zomeProxy(): TaggingProxy {
        return this._zomeProxy as TaggingProxy;
    }


    /** -- ViewModel -- */

    private _perspective: TaggingPerspectiveMutable = new TaggingPerspectiveMutable();


    /* */
    get perspective(): TaggingPerspective {
        return this._perspective.readonly;
    }

    
    /** Dump perspective as JSON  (caller should call getAllPublicManifest() first) */
    export(/*originalsZvm: AuthorshipZvm*/): string {
        const snapshot = this._perspective.makeSnapshot();
        return JSON.stringify(snapshot, null, 2);
    }

    /** */
    import(json: string, _canPublish: boolean) {
        const snapshot = JSON.parse(json, holoIdReviver) as TaggingSnapshot;
        // if (canPublish) {
        // }
        this._perspective.restore(snapshot)
    }


    /** -- Init -- */

    /** */
    override async initializePerspectiveOffline(): Promise<void> {
        const tuples = await this.zomeProxy.queryAllPrivateTag();
        console.log("tagging tuples", tuples);
        for (const [_eh, _ts, tag] of tuples) {
            await this.findPrivateEntriesWithTag(tag);
        }
    }


    /** */
    override async initializePerspectiveOnline(): Promise<void> {
        const tuples = await this.zomeProxy.probePublicTags();
        console.log("taggingZvm.initializePerspectiveOnline()", tuples);
        for (const [_eh, tag] of tuples) {
            await this.findPublicEntriesWithTag(tag);
        }
    }


    /** -- Signals -- */

    /** */
    override async handleEntryPulse(pulse: EntryPulseMat, _from: AgentId) {
        switch (pulse.entryType) {
            case TaggingUnitEnum.PrivateTag:
                const privateTag = decode(pulse.bytes) as PrivateTag;
                if (pulse.state != StateChangeType.Delete) {
                    console.log("TaggingZvm.handleEntryPulse() PrivateTag", privateTag.value, pulse.eh);
                    this._perspective.storePrivateTag(pulse.eh, privateTag.value);
                } else {
                    this._perspective.unstorePrivateTag(pulse.eh);
                }
            break;
        }
    }


    /** */
    override async handleLinkPulse(pulse: LinkPulseMat, _from: AgentId): Promise<void> {
        //console.log("TaggingZvm.handleLinkPulse()", pulse);
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
                    this._perspective.storePublicTag(tagEh, tag);
                }
            }
            break;
            case TaggingLinkType.PublicEntry: {
                const tagEh = EntryId.from(pulse.base);
                const targetEh = EntryId.from(pulse.target);
                const tag = this._perspective.readonly.publicTags.get(tagEh);
                console.log("TaggingZvm.handleLinkPulse() PublicEntry", tag, tagEh);
                if (!tag) {
                    console.warn("Unknown Public tagEh", tagEh);
                    return;
                }
                if (pulse.state != StateChangeType.Delete) {
                    this._perspective.storePublicTagging(tag, targetEh, pulse.create_link_hash);
                } else {
                    this._perspective.unstorePublicTagging(tag, targetEh)
                }
            }
            break;
            case TaggingLinkType.PublicTags: {
                const targetEh = EntryId.from(pulse.base);
                const decoder = new TextDecoder('utf-8');
                const tag = decoder.decode(pulse.tag);
                console.log("TaggingZvm.handleLinkPulse() PublicTags", tag, pulse.tag, targetEh);
                if (pulse.state != StateChangeType.Delete) {
                    this._perspective.storePublicTagging(tag, targetEh, undefined/*pulse.create_link_hash*/);
                } else {
                    this._perspective.unstorePublicTagging(tag, targetEh);
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
                const tag = this._perspective.readonly.privateTags.get(tagEh);
                console.log("TaggingZvm.handleLinkPulse() PrivateTags", tag, targetEh, tagEh);
                if (!tag) {
                    console.warn("Unknown Private tagEh", tagEh);
                    return;
                }
                if (pulse.state != StateChangeType.Delete) {
                    this._perspective.storePrivateTagging(tag, targetEh, pulse.create_link_hash);
                } else {
                    this._perspective.unstorePrivateTagging(tag, targetEh);
                }
            }
            break;
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
        await this.zomeProxy.findPublicEntriesWithTag(tag);
    }


    /** */
    async findPublicTagsForTarget(eh: EntryId): Promise<string[]> {
        const tags = await this.zomeProxy.findPublicTagsForEntry(eh.hash);
        //this._perspective.publicTagsByTarget.set(eh, tags);
        for (const tag of tags) {
            if (this._perspective.publicTargetsByTag[tag]) {
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
        const tags = this._perspective.getTargetPublicTags(targetEh);
        if (!tags) {
            return Promise.reject("Not tags found for Target");
        }
        for (const tag of tags) {
            const linkAh = this._perspective.publicTargetsByTag[tag]!.get(targetEh);
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
        await this.zomeProxy.tagPublicEntry(input);
    }

}

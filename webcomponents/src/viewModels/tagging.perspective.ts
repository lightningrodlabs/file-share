import {ActionId, EntryId, EntryIdMap} from "@ddd-qc/lit-happ";
import {Dictionary} from "@ddd-qc/cell-proxy";
import {ActionHashB64, EntryHashB64} from "@holochain/client";


/** Snapshot is the condensed data form */
export interface TaggingSnapshot {
  /** tagEh, tag string, TargetEhs */
  publicTags: [EntryHashB64, string, EntryHashB64[]][];
  /** TargetEh, CreateLinkAh */
  publicTargetLinks: [EntryHashB64, ActionHashB64][];
  privateTags: [EntryHashB64, string, EntryHashB64[]][];
  privateTargetLinks: [EntryHashB64, ActionHashB64][];
}


/** Read-only perspective */
export class TaggingPerspective {
  /** tagEh -> tag string */
  publicTags: EntryIdMap<string> = new EntryIdMap();
  /** tag string -> (target_eh -> link_ah) */
  publicTargetsByTag: Dictionary<EntryIdMap<ActionId | null>> = {};
  /** tagEh -> tag string */
  privateTags: EntryIdMap<string> = new EntryIdMap();
  /** tag string -> (target_eh -> link_ah) */
  privateTargetsByTag: Dictionary<EntryIdMap<ActionId>> = {};

  /** */
  publicTagsByTarget: EntryIdMap<string[]> = new EntryIdMap();
  privateTagsByTarget: EntryIdMap<string[]> = new EntryIdMap();


  /** API */

  get allPublicTags(): string[] {return Object.keys(this.publicTargetsByTag) }
  get allPrivateTags(): string[] {return Object.keys(this.privateTargetsByTag) }


  /** */
  getTargetPrivateTags(eh: EntryId): string[] {
    if (!this.privateTagsByTarget.get(eh)) {
      return [];
    }
    return this.privateTagsByTarget.get(eh);
  }
  /** */
  getTargetPublicTags(eh: EntryId): string[] {
    if (!this.publicTagsByTarget.get(eh)) {
      return [];
    }
    return this.publicTagsByTarget.get(eh);
  }


  /** -- Memento -- */

  /** TODO: deep copy */
  makeSnapshot(): TaggingSnapshot {
    console.log("Tagging.makeSnapshot()", this);
    const publicTags: [EntryHashB64, string, EntryHashB64[]][] = [];
    const publicTargetLinks: [EntryHashB64, ActionHashB64][] = [];
    const privateTags: [EntryHashB64, string, EntryHashB64[]][] = [];
    const privateTargetLinks: [EntryHashB64, ActionHashB64][] = [];
    /** Public */
    for (const [tagEh, tag] of (this.publicTags.entries())) {
      const map = this.publicTargetsByTag[tag];
      const targets: EntryHashB64[] = Array.from(map.keys()).map((id) => id.b64);
      publicTags.push([tagEh.b64, tag, targets]);
      for (const [targetEh, linkAh] of map.entries()) {
        if (linkAh) {
          publicTargetLinks.push([targetEh.b64, linkAh.b64]);
        }
      }
    }
    /** Private */
    for (const [tagEh, tag] of (this.privateTags.entries())) {
      const map = this.privateTargetsByTag[tag];
      const targets: EntryHashB64[] = Array.from(map.keys()).map((id) => id.b64);
      privateTags.push([tagEh.b64, tag, targets]);
      for (const [targetEh, linkAh] of map.entries()) {
        privateTargetLinks.push([targetEh.b64, linkAh.b64]);
      }
    }
    /** */
    return {publicTags, publicTargetLinks, privateTags, privateTargetLinks}
  }

}



/** Live app form */
export class TaggingPerspectiveMutable extends TaggingPerspective  {

  /** -- Getters -- */

  get readonly(): TaggingPerspective {
    return this;
  }


  /** -- Store -- */

  /** */
  storePublicTag(tagEh: EntryId, tag: string) {
    if (!this.publicTargetsByTag[tag]) {
      this.publicTargetsByTag[tag] = new EntryIdMap();
    }
    this.publicTags.set(tagEh, tag);
  }


  /** */
  storePrivateTag(tagEh: EntryId, tag: string) {
    if (!this.privateTargetsByTag[tag]) {
      //this._perspective.privateTags[privateTag.value] = new EntryIdMap();
      this.privateTags.set(tagEh, tag);
    }
  }
  unstorePrivateTag(tagEh: EntryId) {
    this.privateTags.delete(tagEh);
  }


  /** */
  storePublicTagging(tag: string, targetEh: EntryId, linkAh: ActionId | null) {
    console.debug("Tagging.storePublicTagging()", tag, targetEh.short, this);
    if (!this.publicTargetsByTag[tag]) {
      this.publicTargetsByTag[tag] = new EntryIdMap();
    }
    const maybeLinkAh = this.publicTargetsByTag[tag].get(targetEh);
    if (!maybeLinkAh || maybeLinkAh == null) {
      this.publicTargetsByTag[tag].set(targetEh, linkAh);
    }
    /** publicTagsByTarget */
    if (!this.publicTagsByTarget.get(targetEh)) {
      this.publicTagsByTarget.set(targetEh, []);
    }
    if (!this.publicTagsByTarget.get(targetEh).includes(tag)) {
      this.publicTagsByTarget.get(targetEh).push(tag);
    }
  }
  /** */
  unstorePublicTagging(tag: string, targetEh: EntryId) {
    const targets = this.publicTargetsByTag[tag];
    if (targets && targets.has(targetEh)) {
      targets.delete(targetEh);
    }
    const tags = this.publicTagsByTarget.get(targetEh);
    if (tags) {
      const i = tags.findIndex((taggy) => taggy == tag);
      if (i > -1) {
        tags.splice(i, 1);
        this.publicTagsByTarget.set(targetEh, tags);
      }
    }
  }


  /** */
  storePrivateTagging(tag: string, targetEh: EntryId, linkAh: ActionId) {
    if (!this.privateTargetsByTag[tag]) {
      this.privateTargetsByTag[tag] = new EntryIdMap();
    }
    this.privateTargetsByTag[tag].set(targetEh, linkAh);
    if (!this.privateTagsByTarget.get(targetEh)) {
      this.privateTagsByTarget.set(targetEh, []);
    }
    this.privateTagsByTarget.get(targetEh).push(tag);
  }


  /** */
  unstorePrivateTagging(tag: string, targetEh: EntryId) {
    const targets = this.privateTargetsByTag[tag];
    if (targets && targets.has(targetEh)) {
      targets.delete(targetEh);
    }
    const tags = this.privateTagsByTarget.get(targetEh);
    if (tags) {
      const i = tags.findIndex((taggy) => taggy == tag);
      if (i > -1) {
        tags.splice(i, 1)
        this.privateTagsByTarget.set(targetEh, tags);
      }
    }
  }


  /** -- Memento -- */
  /** */
  restore(snapshot: TaggingSnapshot) {
    /** Clear */
    this.publicTags.clear();
    this.publicTargetsByTag = {};
    this.privateTargetsByTag = {};
    this.privateTags.clear();
    /** */
    this.publicTagsByTarget.clear();
    this.privateTagsByTarget.clear();
    /** Store */
    const publicLinkMap: EntryIdMap<ActionId> = new EntryIdMap();
    for (const [targetEh, linkAh] of Object.values(snapshot.publicTargetLinks)) {
      publicLinkMap.set(new EntryId(targetEh), new ActionId(linkAh));
    }
    const privateLinkMap: EntryIdMap<ActionId> = new EntryIdMap();
    for (const [targetEh, linkAh] of Object.values(snapshot.privateTargetLinks)) {
      privateLinkMap.set(new EntryId(targetEh), new ActionId(linkAh));
    }
    for (const[tagEh, tag, targets] of Object.values(snapshot.publicTags)) {
      const tagId = new EntryId(tagEh);
      this.storePublicTag(tagId, tag);
      for (const targetEh of targets) {
        const targetId = new EntryId(targetEh);
        this.storePublicTagging(tag, targetId, publicLinkMap.get(targetId));
      }
    }
    for (const[tagEh, tag, targets] of Object.values(snapshot.privateTags)) {
      const tagId = new EntryId(tagEh);
      this.storePrivateTag(tagId, tag);
      for (const targetEh of targets) {
        const targetId = new EntryId(targetEh);
        this.storePrivateTagging(tag, targetId, privateLinkMap.get(targetId));
      }
    }
  }
}

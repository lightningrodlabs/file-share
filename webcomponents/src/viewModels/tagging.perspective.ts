import {ActionId, EntryId, EntryIdMap} from "@ddd-qc/lit-happ";
import {Dictionary} from "@ddd-qc/cell-proxy";
import {ActionHashB64, EntryHashB64} from "@holochain/client";


/** */
export interface TaggingSnapshot {
  publicTags: [EntryHashB64, string, EntryHashB64[]][];
  publicTargetLinks: [EntryHashB64, ActionHashB64][];
  privateTags: [EntryHashB64, string, EntryHashB64[]][];
  privateTargetLinks: [EntryHashB64, ActionHashB64][];
}


/** */
export class TaggingPerspectiveCore {
  /** tagEh -> tag string */
  protected _publicTags = new EntryIdMap<string>();
  /** tag string -> (target_eh -> link_ah) */
  protected _publicTargetsByTag: Dictionary<EntryIdMap<ActionId | null>> = {};
  /** tagEh -> tag string */
  protected _privateTags = new EntryIdMap<string> ();
  /** tag string -> (target_eh -> link_ah) */
  protected _privateTargetsByTag: Dictionary<EntryIdMap<ActionId>> = {};

  /** */
  protected _publicTagsByTarget = new EntryIdMap<string[]>();
  protected _privateTagsByTarget = new EntryIdMap<string[]>();


  /** API */

  get publicTags(): EntryIdMap<string> {return this._privateTags}
  get publicTargetsByTag(): Dictionary<EntryIdMap<ActionId | null>> {return this._publicTargetsByTag}
  get privateTargetsByTag(): Dictionary<EntryIdMap<ActionId>> {return this._privateTargetsByTag}
  get privateTags(): EntryIdMap<string> {return this._privateTags}


  get allPublicTags(): string[] {return Object.keys(this._publicTargetsByTag) }
  get allPrivateTags(): string[] {return Object.keys(this._privateTargetsByTag) }


  /** */
  getTargetPrivateTags(eh: EntryId): string[] {
    if (!this._privateTagsByTarget.get(eh)) {
      return [];
    }
    return this._privateTagsByTarget.get(eh);
  }
  /** */
  getTargetPublicTags(eh: EntryId): string[] {
    if (!this._publicTagsByTarget.get(eh)) {
      return [];
    }
    return this._publicTagsByTarget.get(eh);
  }
}


/** */
export class TaggingPerspective extends TaggingPerspectiveCore  {


  /** -- Getters -- */

  get core(): TaggingPerspectiveCore {
    return this;
  }



  /** -- Store -- */

  /** */
  storePublicTag(tagEh: EntryId, tag: string) {
    if (!this._publicTargetsByTag[tag]) {
      this._publicTargetsByTag[tag] = new EntryIdMap();
    }
    this._publicTags.set(tagEh, tag);
  }


  /** */
  storePrivateTag(tagEh: EntryId, tag: string) {
    if (!this._privateTargetsByTag[tag]) {
      //this._perspective.privateTags[privateTag.value] = new EntryIdMap();
      this._privateTags.set(tagEh, tag);
    }
  }
  unstorePrivateTag(tagEh: EntryId) {
    this._privateTags.delete(tagEh);
  }


  /** */
  storePublicTagging(tag: string, targetEh: EntryId, linkAh: ActionId | null) {
    console.debug("Tagging.storePublicTagging()", tag, targetEh.short, this);
    if (!this._publicTargetsByTag[tag]) {
      this._publicTargetsByTag[tag] = new EntryIdMap();
    }
    const maybeLinkAh = this._publicTargetsByTag[tag].get(targetEh);
    if (!maybeLinkAh || maybeLinkAh == null) {
      this._publicTargetsByTag[tag].set(targetEh, linkAh);
    }
    /** publicTagsByTarget */
    if (!this._publicTagsByTarget.get(targetEh)) {
      this._publicTagsByTarget.set(targetEh, []);
    }
    if (!this._publicTagsByTarget.get(targetEh).includes(tag)) {
      this._publicTagsByTarget.get(targetEh).push(tag);
    }
  }
  /** */
  unstorePublicTagging(tag: string, targetEh: EntryId) {
    const targets = this._publicTargetsByTag[tag];
    if (targets && targets.has(targetEh)) {
      targets.delete(targetEh);
    }
    const tags = this._publicTagsByTarget.get(targetEh);
    if (tags) {
      const i = tags.findIndex((taggy) => taggy == tag);
      if (i > -1) {
        tags.splice(i, 1);
        this._publicTagsByTarget.set(targetEh, tags);
      }
    }
  }


  /** */
  storePrivateTagging(tag: string, targetEh: EntryId, linkAh: ActionId) {
    if (!this._privateTargetsByTag[tag]) {
      this._privateTargetsByTag[tag] = new EntryIdMap();
    }
    this._privateTargetsByTag[tag].set(targetEh, linkAh);
    if (!this._privateTagsByTarget.get(targetEh)) {
      this._privateTagsByTarget.set(targetEh, []);
    }
    this._privateTagsByTarget.get(targetEh).push(tag);
  }


  /** */
  unstorePrivateTagging(tag: string, targetEh: EntryId) {
    const targets = this._privateTargetsByTag[tag];
    if (targets && targets.has(targetEh)) {
      targets.delete(targetEh);
    }
    const tags = this._privateTagsByTarget.get(targetEh);
    if (tags) {
      const i = tags.findIndex((taggy) => taggy == tag);
      if (i > -1) {
        tags.splice(i, 1)
        this._privateTagsByTarget.set(targetEh, tags);
      }
    }
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
    for (const [tagEh, tag] of (this._publicTags.entries())) {
      const map = this._publicTargetsByTag[tag];
      const targets: EntryHashB64[] = Array.from(map.keys()).map((id) => id.b64);
      publicTags.push([tagEh.b64, tag, targets]);
      for (const [targetEh, linkAh] of map.entries()) {
        if (linkAh) {
          publicTargetLinks.push([targetEh.b64, linkAh.b64]);
        }
      }
    }
    /** Private */
    for (const [tagEh, tag] of (this._privateTags.entries())) {
      const map = this._privateTargetsByTag[tag];
      const targets: EntryHashB64[] = Array.from(map.keys()).map((id) => id.b64);
      privateTags.push([tagEh.b64, tag, targets]);
      for (const [targetEh, linkAh] of map.entries()) {
        privateTargetLinks.push([targetEh.b64, linkAh.b64]);
      }
    }
    /** */
    return {publicTags, publicTargetLinks, privateTags, privateTargetLinks}
  }


  /** */
  restore(snapshot: TaggingSnapshot) {
    /** Clear */
    this._publicTags.clear();
    this._publicTargetsByTag = {};
    this._privateTargetsByTag = {};
    this._privateTags.clear();
    /** */
    this._publicTagsByTarget.clear();
    this._privateTagsByTarget.clear();
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

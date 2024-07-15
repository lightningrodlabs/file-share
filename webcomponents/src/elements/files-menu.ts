import {css, html, PropertyValues} from "lit";
import {property, state, customElement} from "lit/decorators.js";
import {ActionId, DnaElement, EntryIdMap} from "@ddd-qc/lit-happ";
import {FilesDvm} from "../viewModels/files.dvm";
import {FilesDvmPerspective} from "../viewModels/files.perspective";
import {DeliveryPerspective} from "@ddd-qc/delivery";
import {filesSharedStyles} from "../sharedStyles";
import {SlMenu} from "@shoelace-style/shoelace";
import {msg} from "@lit/localize";
import {Dictionary} from "@ddd-qc/cell-proxy";
import {TaggingPerspective} from "../viewModels/tagging.perspective";


/** */
export enum SelectedType {
    Home = 'Home',
    AllFiles = 'All Files',
    GroupFiles = 'Group Files',
    PersonalFiles = 'Personal Files',
    Inbox = 'Inbox',
    Sent = 'Sent',
    InProgress = 'In Progress',
    PublicTag = 'PublicTag',
    PrivateTag = 'PrivateTag',
}


export interface SelectedEvent {
    type: string,
    tag?: string;
}

/**
 * @element
 */
@customElement("files-menu")
export class FilesMenu extends DnaElement<FilesDvmPerspective, FilesDvm> {

    /** Observed perspective from zvm */
    @property({type: Object, attribute: false, hasChanged: (_v, _old) => true})
    deliveryPerspective!: DeliveryPerspective;

    @property({type: Object, attribute: false, hasChanged: (_v, _old) => true})
    taggingPerspective!: TaggingPerspective;


    @state() private _initialized = false;


    /**
     * In dvmUpdated() this._dvm is not already set!
     * Subscribe to ZVMs
     */
    protected async dvmUpdated(newDvm: FilesDvm, oldDvm?: FilesDvm): Promise<void> {
        console.log("<files-menu>.dvmUpdated()");
        if (oldDvm) {
            console.log("\t Unsubscribed to Zvms roleName = ", oldDvm.deliveryZvm.cell.name)
            oldDvm.taggingZvm.unsubscribe(this);
            oldDvm.deliveryZvm.unsubscribe(this);
        }
        newDvm.deliveryZvm.subscribe(this, 'deliveryPerspective');
        newDvm.taggingZvm.subscribe(this, 'taggingPerspective');
        console.log("\t Subscribed Zvms roleName = ", newDvm.deliveryZvm.cell.name)
        this._initialized = true;
    }


    /** */
    updated() {
        //const menu = this.shadowRoot.querySelector("sl-menu") as SlMenu;
        //console.log("SlMenu", menu);
    }


    // /** Set "selectedItem" class */
    // setSelected(selectedItem) {
    //     const menu = this.shadowRoot.getElementById("lhs-menu") as SlMenu;
    //     const items = menu.getAllItems();
    //     for (const item  of items) {
    //         item.classList.remove("selectedItem");
    //         console.log("SlMenuItem", item.innerText, item);
    //     }
    //     selectedItem.classList.add("selectedItem");
    // }


    setSelected(text: string) {
        console.log("SlMenuItem setSelected()", text)
        const menu = this.shadowRoot.getElementById("lhs-menu") as SlMenu;
        const items = menu.getAllItems();
        for (const item  of items) {
            //console.log("SlMenuItem", item.innerText, item);
            const curText = item.innerText.split('\n')[0];
            //console.log("SlMenuItem split", curText);
            if (curText == text) {
                item.classList.add("selectedItem");
                continue;
            }
            item.classList.remove("selectedItem");
        }
    }


    /** */
    onSelected(e) {
        console.log("<files-menu> onSelected", e.detail.item);
        //console.log("<files-menu> onSelected", e.detail.item.getTextLabel().trim());

        /** Set "selectedItem" class */
        this.setSelected(e.detail.item.innerText.split('\n')[0]);

        const isPrivate = e.detail.item.getAttribute("isPrivate");
        const isTag = e.detail.item.getAttribute("isTag");
        console.log("<files-menu> attrs", isPrivate, isTag);


        const event = isTag
            ? {
                type: isPrivate == "true" ? SelectedType.PrivateTag : SelectedType.PublicTag,
                tag: e.detail.item.getTextLabel().trim()
            } as SelectedEvent
            : { type: e.detail.item.value } as SelectedEvent;
        console.log("<files-menu> event", event);

        /** Dispatch to main page */
        this.dispatchEvent(new CustomEvent<SelectedEvent>('selected', {detail: event, bubbles: true, composed: true}));
    }


    /** */
    renderTags(isPrivate: boolean) {
        if (!this._initialized) {
            return html`
                <sl-skeleton effect="sheen"></sl-skeleton>
                <sl-skeleton effect="sheen"></sl-skeleton>
                <sl-skeleton effect="sheen"></sl-skeleton>
            `;
        }
        console.log("renderTags()", this.taggingPerspective.publicTargetsByTag, this.taggingPerspective.privateTargetsByTag);
        const tags: Dictionary<EntryIdMap<ActionId | null>> = isPrivate
            ? this.taggingPerspective.privateTargetsByTag
            : this.taggingPerspective.publicTargetsByTag
        const groupTags = Object.entries(tags)
            .filter(([_tag, idMap]) => idMap.size > 0)
            .map(([tag, array]) => {
            return html`
            <sl-menu-item isPrivate=${isPrivate} isTag="true">
                <sl-icon slot="prefix" name="tag"></sl-icon>
                ${tag}
                <sl-badge slot="suffix" variant="neutral" pill>${array.size}</sl-badge>
            </sl-menu-item>`;
        });

        if (groupTags.length == 0) {
            return html``;
        }
        return html`
            <sl-divider></sl-divider>
            <sl-menu-label>${isPrivate? msg("Personal Tags") : msg("Group Tags")}</sl-menu-label>
            ${groupTags}
        `;
    }


    /** */
    render() {
        console.log("<files-menu>.render()", this._initialized, this._dvm.deliveryZvm.probeDhtCount, this.taggingPerspective);

        const initialized = !!(this._initialized && this._dvm.deliveryZvm.probeDhtCount);

        //let localPublicCount = 0;
        let dhtPublicCount = 0;
        let privateCount = 0;
        let unrepliedCount = 0;
        let distribCount = 0;
        let outboundCount = 0;
        let inboundCount = 0;
        let privOrphans = 0;
        let pubOrphans = 0;
        if (this._initialized) {
            const [unreplieds, inbounds] = this._dvm.deliveryZvm.inbounds();
            dhtPublicCount = Array.from(this.deliveryPerspective.publicParcels.entries()).filter(([_ppEh, pprm]) => !pprm.deleteInfo).length;
            inboundCount = Array.from(inbounds.entries()).length;
            unrepliedCount = Array.from(unreplieds.entries()).length;
            outboundCount = Array.from(this._dvm.deliveryZvm.outbounds().entries()).length;
            //localPublicCount = Object.entries(this.deliveryPerspective.localPublicManifests).length;
            privateCount = Array.from(this.deliveryPerspective.privateManifests.entries()).length;
            distribCount = Array.from(this.deliveryPerspective.distributions.entries()).length;
            privOrphans = this.deliveryPerspective.orphanPrivateChunks.length
            pubOrphans = this.deliveryPerspective.orphanPublicChunks.length;
        }

        /** render all */
        return html`
            <div>
                <img src="assets/icon.png" width="32" height="32" alt="favicon" style="padding-left: 5px;padding-top: 5px;"/>
                <span id="title"">Files</span>
            </div>
            <sl-menu id="lhs-menu" @sl-select=${this.onSelected}>
                <sl-menu-item class="selectedItem" value=${SelectedType.Home}>
                    <sl-icon slot="prefix" name="house"></sl-icon>
                    ${msg("Home")}
                </sl-menu-item>
                <sl-menu-item ?disabled=${!initialized} value=${SelectedType.AllFiles}>                    
                    <sl-icon slot="prefix" name="files"></sl-icon>
                    ${msg("All Files")}
                    ${initialized? html`<sl-badge slot="suffix" variant="neutral" pill>${dhtPublicCount + privateCount}</sl-badge>`: html`<sl-skeleton slot="suffix" effect="sheen"></sl-skeleton>`}
                </sl-menu-item>
                <sl-menu-item ?disabled=${!initialized} value=${SelectedType.PersonalFiles}>
                    <sl-icon slot="prefix" name="hdd"></sl-icon>
                    ${msg("Personal Files")}
                    ${initialized? html`<sl-badge slot="suffix" variant="neutral" pill>${privateCount}</sl-badge>`: html`<sl-skeleton slot="suffix" effect="sheen"></sl-skeleton>`}
                </sl-menu-item>
                <sl-menu-item ?disabled=${!initialized} value=${SelectedType.GroupFiles}>
                    <sl-icon slot="prefix" name="people"></sl-icon>
                    ${msg("Group Files")}
                    ${initialized? html`<sl-badge slot="suffix" variant="neutral" pill>${dhtPublicCount}</sl-badge>`: html`<sl-skeleton slot="suffix" effect="sheen"></sl-skeleton>`}
                </sl-menu-item>
                <sl-menu-item ?disabled=${!initialized} value=${SelectedType.Inbox}>
                    <sl-icon slot="prefix" name="download"></sl-icon>
                    ${msg("Inbox")}
                    ${initialized? html`<sl-badge slot="suffix" variant=${unrepliedCount > 0? "primary" : "neutral"} pill>${unrepliedCount}</sl-badge>`: html`<sl-skeleton slot="suffix" effect="sheen"></sl-skeleton>`}
                </sl-menu-item>
                <sl-menu-item ?disabled=${!initialized} value=${SelectedType.Sent}>
                    <sl-icon slot="prefix" name="send"></sl-icon>
                    ${msg("Sent")}
                    ${initialized? html`<sl-badge slot="suffix" variant="neutral" pill>${distribCount - outboundCount}</sl-badge>`: html`<sl-skeleton slot="suffix" effect="sheen"></sl-skeleton>`}
                </sl-menu-item>
                <sl-menu-item ?disabled=${!initialized} value=${SelectedType.InProgress}>
                    <sl-icon slot="prefix" name="arrow-left-right"></sl-icon>
                    ${msg("In Progress")}
                    ${initialized? html`<sl-badge slot="suffix" variant=${outboundCount > 0? "primary" : "neutral"} pill>${outboundCount + inboundCount}</sl-badge>`: html`<sl-skeleton slot="suffix" effect="sheen"></sl-skeleton>`}
                </sl-menu-item>
                ${this.renderTags(false)}
                ${this.renderTags(true)}
            </sl-menu>
            <br />
            ${pubOrphans? html`
                <sl-divider></sl-divider>
                <div style="color: darkred">Public orphan chunks: ${pubOrphans}</div>
            `:html``}
            ${privOrphans? html`
                <sl-divider></sl-divider>
                <div style="color: darkred">Private Orphan chunks: ${privOrphans}</div>
            `:html``}            
        `;
    }

    /** */
    static get styles() {
        return [
            filesSharedStyles,
            css`
              :host {
                background: #E8F0F3;
                display: block;
                overflow-y: auto;
                height: 100%;
                min-width: 210px;
              }

              sl-menu {
                width: 100%;
                background: #E8F0F3;
                border: none;
              }
              #title {
                margin: 5px;
                font-size: 32px;
                font-weight: bold;
              }
              sl-menu-item {
                margin-bottom: 7px;
              }
              .selectedItem {
                background: #FFFFFF;
                box-shadow: rgba(0, 0, 0, 0.35) 0px 5px 15px;
                margin-left: 5px;
                margin-right: 5px;
                border-radius: 5px;
              }
            `,];
    }
}

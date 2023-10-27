import {css, html, PropertyValues} from "lit";
import {property, state, customElement} from "lit/decorators.js";
import {DnaElement} from "@ddd-qc/lit-happ";
import {FileShareDvm} from "../viewModels/fileShare.dvm";
import {FileShareDvmPerspective} from "../viewModels/fileShare.perspective";
import {DeliveryPerspective} from "@ddd-qc/delivery";
import {consume} from "@lit-labs/context";
import {globalProfilesContext} from "../viewModels/happDef";
import {ProfilesZvm} from "../viewModels/profiles.zvm";
import {sharedStyles} from "../sharedStyles";
import {SlDrawer, SlMenu, SlMenuItem} from "@shoelace-style/shoelace";
import {TaggingPerspective} from "../viewModels/tagging.zvm";


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
@customElement("file-share-menu")
export class FileShareMenu extends DnaElement<FileShareDvmPerspective, FileShareDvm> {

    /** Observed perspective from zvm */
    @property({type: Object, attribute: false, hasChanged: (_v, _old) => true})
    deliveryPerspective!: DeliveryPerspective;

    @property({type: Object, attribute: false, hasChanged: (_v, _old) => true})
    taggingPerspective!: TaggingPerspective;


    @consume({ context: globalProfilesContext, subscribe: true })
    _profilesZvm!: ProfilesZvm;


    @state() private _initialized = false;


    /**
     * In dvmUpdated() this._dvm is not already set!
     * Subscribe to ZVMs
     */
    protected async dvmUpdated(newDvm: FileShareDvm, oldDvm?: FileShareDvm): Promise<void> {
        console.log("<file-view>.dvmUpdated()");
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
        console.log("<file-share-menu> onSelected", e.detail.item);
        //console.log("<file-share-menu> onSelected", e.detail.item.getTextLabel().trim());

        /** Set "selectedItem" class */
        this.setSelected(e.detail.item.innerText.split('\n')[0]);

        const isPrivate = e.detail.item.getAttribute("isPrivate");
        const isTag = e.detail.item.getAttribute("isTag");
        console.log("<file-share-menu> attrs", isPrivate, isTag);



        const event = isTag
            ? {
                type: isPrivate == "true" ? SelectedType.PrivateTag : SelectedType.PublicTag,
                tag: e.detail.item.getTextLabel().trim()
            } as SelectedEvent
            : { type: e.detail.item.getTextLabel().trim() } as SelectedEvent;
        console.log("<file-share-menu> event", event);

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

        const tags = isPrivate
            ? this.taggingPerspective.privateTags
            : this.taggingPerspective.publicTags

        const groupTags = Object.entries(tags).map(([tag, array]) => {
            return html`
            <sl-menu-item isPrivate=${isPrivate} isTag="true">
                <sl-icon slot="prefix" name="tag"></sl-icon>
                ${tag}
                <sl-badge slot="suffix" variant="neutral" pill>${array.length}</sl-badge>
            </sl-menu-item>`;
        });

        if (groupTags.length == 0) {
            return html``;
        }
        return html`
            <sl-divider></sl-divider>
            <sl-menu-label>${isPrivate? "Personal Tags" : "Group Tags"}</sl-menu-label>
            ${groupTags}
        `;
    }


    /** */
    render() {
        console.log("<file-share-menu>.render()", this._initialized, this.deliveryPerspective.probeDhtCount, this.taggingPerspective);

        const initialized = !!(this._initialized && this.deliveryPerspective.probeDhtCount);

        //let localPublicCount = 0;
        let dhtPublicCount = 0;
        let privateCount = 0;
        let unrepliedCount = 0;
        let distribCount = 0;
        let outboundCount = 0;
        let incompleteCount = 0;
        let privOrphans = 0;
        let pubOrphans = 0;
        if (this._initialized) {
            dhtPublicCount = Object.entries(this.deliveryPerspective.publicParcels).length;
            //localPublicCount = Object.entries(this.deliveryPerspective.localPublicManifests).length;
            privateCount = Object.entries(this.deliveryPerspective.privateManifests).length;
            unrepliedCount = Object.entries(this._dvm.deliveryZvm.inbounds()).length;
            distribCount = Object.entries(this.deliveryPerspective.distributions).length;
            outboundCount = Object.entries(this._dvm.deliveryZvm.outbounds()).length;
            incompleteCount = this.deliveryPerspective.incompleteManifests.length;
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
                <sl-menu-item class="selectedItem">
                    <sl-icon slot="prefix" name="house"></sl-icon>
                    ${SelectedType.Home}
                </sl-menu-item>
                <sl-menu-item ?disabled=${!initialized}>                    
                    <sl-icon slot="prefix" name="files"></sl-icon>
                    ${SelectedType.AllFiles}
                    ${initialized? html`<sl-badge slot="suffix" variant="neutral" pill>${dhtPublicCount + privateCount}</sl-badge>`: html`<sl-skeleton slot="suffix" effect="sheen"></sl-skeleton>`}
                </sl-menu-item>
                <sl-menu-item ?disabled=${!initialized}>
                    <sl-icon slot="prefix" name="hdd"></sl-icon>
                    ${SelectedType.PersonalFiles}
                    ${initialized? html`<sl-badge slot="suffix" variant="neutral" pill>${privateCount}</sl-badge>`: html`<sl-skeleton slot="suffix" effect="sheen"></sl-skeleton>`}
                </sl-menu-item>
                <sl-menu-item ?disabled=${!initialized}>
                    <sl-icon slot="prefix" name="people"></sl-icon>
                    ${SelectedType.GroupFiles}
                    ${initialized? html`<sl-badge slot="suffix" variant="neutral" pill>${dhtPublicCount}</sl-badge>`: html`<sl-skeleton slot="suffix" effect="sheen"></sl-skeleton>`}
                </sl-menu-item>
                <sl-menu-item ?disabled=${!initialized}>
                    <sl-icon slot="prefix" name="download"></sl-icon>
                    ${SelectedType.Inbox}
                    ${initialized? html`<sl-badge slot="suffix" variant=${unrepliedCount > 0? "primary" : "neutral"} pill>${unrepliedCount}</sl-badge>`: html`<sl-skeleton slot="suffix" effect="sheen"></sl-skeleton>`}
                </sl-menu-item>
                <sl-menu-item ?disabled=${!initialized}>
                    <sl-icon slot="prefix" name="send"></sl-icon>
                    ${SelectedType.Sent}
                    ${initialized? html`<sl-badge slot="suffix" variant="neutral" pill>${distribCount - outboundCount}</sl-badge>`: html`<sl-skeleton slot="suffix" effect="sheen"></sl-skeleton>`}
                </sl-menu-item>
                <sl-menu-item ?disabled=${!initialized}>
                    <sl-icon slot="prefix" name="arrow-left-right"></sl-icon>
                    ${SelectedType.InProgress}
                    ${initialized? html`<sl-badge slot="suffix" variant=${outboundCount > 0? "primary" : "neutral"} pill>${outboundCount + incompleteCount}</sl-badge>`: html`<sl-skeleton slot="suffix" effect="sheen"></sl-skeleton>`}
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
            sharedStyles,
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

import {css, html, PropertyValues} from "lit";
import {property, state, customElement} from "lit/decorators.js";
import {consume} from "@lit/context";
import {delay, DnaElement, EntryId} from "@ddd-qc/lit-happ";
import {FilesDvm} from "../viewModels/files.dvm";
import {filesSharedStyles} from "../sharedStyles";
import {FilesDvmPerspective} from "../viewModels/files.perspective";
import {TaggingPerspectiveMutable} from "../viewModels/tagging.perspective";
import {kind2Icon} from "../fileTypeUtils";
import {SelectedEvent, SelectedType} from "./files-menu";
import {prettyFileSize} from "../utils";
import {ParcelDescription} from "@ddd-qc/delivery";
import {weaveUrlFromWal, WeaveServices} from "@lightningrodlabs/we-applet";
//import {weClientContext} from "@lightningrodlabs/we-applet/context";
import {createContext} from "@lit/context";
import {WAL} from "@lightningrodlabs/we-applet/dist/types";
import {msg} from "@lit/localize";
import {SlTooltip} from "@shoelace-style/shoelace";

export const weClientContext = createContext<WeaveServices>('weave_client');


/**
 * @element
 */
@customElement("file-button")
export class FileButton extends DnaElement<FilesDvmPerspective, FilesDvm> {

    /** -- Properties -- */

    /** Hash of ParcelManifest to display */
    @property() hash?: EntryId;

    //@property() author?: AgentId;

    @property() description?: ParcelDescription;

    @consume({ context: weClientContext, subscribe: true })
    weServices: WeaveServices;


    /** -- Methods -- */


    /** Observed perspective from zvm */
    @property({type: Object, attribute: false, hasChanged: (_v, _old) => true})
    taggingPerspective!: TaggingPerspectiveMutable;


    /**
     * In dvmUpdated() this._dvm is not already set!
     * Subscribe to ZVMs
     */
    protected async dvmUpdated(newDvm: FilesDvm, oldDvm?: FilesDvm): Promise<void> {
        console.log("<file-button>.dvmUpdated()");
        if (oldDvm) {
            console.log("\t Unsubscribed to Zvms roleName = ", oldDvm.taggingZvm.cell.name)
            oldDvm.taggingZvm.unsubscribe(this);
        }
        newDvm.taggingZvm.subscribe(this, 'taggingPerspective');
        console.log("\t Subscribed Zvms roleName = ", newDvm.taggingZvm.cell.name)
    }


    /** */
    render() {
        console.log("<file-button>.render()", this.hash, this.description);
        if (!this.hash && !this.description) {
            return html`<sl-button class="fileButton" disabled>N/A</sl-button>`;
        }

        /** Retrieve File description */
        let fileDescription = this.description;
        let isPrivate = true;
        //let author = this.author? this.author : this.cell.agentPubKey;
        if (this.hash) {
            const tuple = this._dvm.deliveryZvm.perspective.privateManifests.get(this.hash);
            isPrivate = false;
            if (tuple) {
                fileDescription = tuple[0].description;
                isPrivate = true;
            } else {
                const tuple = this._dvm.deliveryZvm.perspective.localPublicManifests.get(this.hash);
                if (tuple) {
                    fileDescription = tuple[0].description;
                } else {
                    const pprm = this._dvm.deliveryZvm.perspective.publicParcels.get(this.hash);
                    //author = pprm.author;
                    if (pprm) {
                        fileDescription = pprm.description;
                    } else {
                        return html`
                            <sl-button class="unknown" disabled>Unknown file</sl-button>`;
                    }
                }
            }
        }

        /** Retrieve tags */
        let tagList = [];
        let actionButtons = [];
        if (this.hash) {
            let tags;
            let type;
            if (isPrivate) {
                tags = this._dvm.taggingZvm.perspective.getTargetPrivateTags(this.hash);
                type = SelectedType.PrivateTag;
            } else {
                tags = this._dvm.taggingZvm.perspective.getTargetPublicTags(this.hash);
                type = SelectedType.PublicTag;
            }
            tagList = tags.map((tag) => {
                return html`
                    <sl-button class="hide tag-button pop" size="small" variant="primary" style="margin-left:5px"
                               @click=${async (e) => {
                                   this.dispatchEvent(new CustomEvent<SelectedEvent>('tag', {
                                       detail: {type, tag},
                                       bubbles: true,
                                       composed: true
                                   }));
                               }}>${tag}
                        <sl-icon slot="prefix" name="tag"></sl-icon>
                    </sl-button>
                `;
            });
            /** action bar */
            actionButtons.push(html`
                <sl-tooltip placement="top" content=${msg("Download")} style="--show-delay: 200;">
                <sl-button class="hide pop action" size="small" variant="primary" style="margin-left:5px" @click=${async (e) => {
                    this.dispatchEvent(new CustomEvent<EntryId>('download', {detail: this.hash, bubbles: true, composed: true}));
                }}>
                    <sl-icon name="download"></sl-icon>
                </sl-button></sl-tooltip>`);
            actionButtons.push(html`
                <sl-tooltip placement="top" content=${msg("Send")} style="--show-delay: 200;">
                <sl-button class="hide pop action" size="small" variant="primary" @click=${async (e) => {
                    this.dispatchEvent(new CustomEvent<EntryId>('send', {detail: this.hash, bubbles: true, composed: true}));
                }}>
                    <sl-icon name="send"></sl-icon>
                </sl-button></sl-tooltip>`);
            /** Add button for each attachment type */
            // FIXME: use creatables API instead
            // if (this.weServices && this.weServices.attachmentTypes && this.hash != '') {
            //     console.log("weServices.attachmentTypes", this.weServices.attachmentTypes);
            //     this.weServices.attachmentTypes.forEach((attDict, appletHash, _map) => {
            //         for (const [attName, attType] of Object.entries(attDict)) {
            //             actionButtons.push(html`
            //                 <sl-tooltip placement="top" content=${attName} style="--show-delay: 200;">
            //     <sl-button class="hide pop action" size="small" variant="primary" @click=${async (e) => {
            //             const hrl: Hrl = [decodeHashFromBase64(this.cell.dnaHash), decodeHashFromBase64(this.hash)];
            //             const context = {
            //                 subjectType: "File",
            //                 subjectName: fileDescription.name,
            //                 size: fileDescription.size,
            //                 subjectAuthor: author,
            //             };
            //             console.log("Create attachmentTypes request:", context);
            //             const res = await attType.create({hrl, context});
            //             console.log("Create attachmentTypes result:", res);
            //             this.weServices.openHrl({hrl: res.hrl, context: res.context});
            //         }}>
            //         <sl-icon .src=${attType.icon_src}></sl-icon>
            //     </sl-button></sl-tooltip>`);
            //         }
            //     });
            // }
        }


        /** render all */
        return html`
            <sl-popup class="fileButton" placement="bottom-start" skidding="-4" active>
                <div slot="anchor">
                    <sl-popup class="fileButton" placement="right" active>
                        
                        <div slot="anchor" @click=${async (e) => {
                            const obj: WAL = {
                                hrl: [this.cell.dnaId.hash, this.hash.hash],
                                context: {
                                    subjectName: fileDescription.name,
                                    subjectType: "File",
                                    size: fileDescription.size,
                                },
                            }
                            console.log("Copied to HrlClipboard", obj);
                            const wurl = weaveUrlFromWal(obj);
                            navigator.clipboard.writeText(wurl);
                            if (this.weServices) {
                                this.weServices.walToPocket(obj);
                            }
                            await delay(1200);
                            const tt = this.shadowRoot.getElementById("file-tip") as SlTooltip;
                            tt.hide();
                            //this.requestUpdate();
                        }}>
                            <sl-tooltip id="file-tip" placement="top" trigger="click" content="Copied!">
                                <div class="fileName">
                                <sl-icon class="prefixIcon" name=${kind2Icon(fileDescription.kind_info)}></sl-icon>
                                <files-filename .filename=${fileDescription.name}></files-filename>                                 
                                <span class="filesize">${prettyFileSize(fileDescription.size)}</span>
                                </div>
                            </sl-tooltip>
                        </div>
                        ${actionButtons}
                    </sl-popup>
                </div>
                ${tagList}
            </sl-popup>
        `;
    }


    /** */
    static get styles() {
        return [
            filesSharedStyles,
            css`

              .unknown::part(base) {
                border: dotted 2px;  
              }
              
              
              sl-icon {
                font-weight: bold;
              }


              .pop::part(base) {
                background: #21374A;
                box-shadow: rgba(0, 0, 0, 0.35) 0px 5px 15px;
                font-weight: bold;
                border: none;
              }

              .pop::part(base):hover {
                cursor: pointer;
                background: aliceblue;
                color: rgb(33, 55, 74);
                border: 1px solid #2488e0;
              }

              .tag-button::part(base) {
                margin: 4px 0px 0px 0px;
              }

              .action::part(base) {
                font-size: 1.0rem;
                margin: 0px;
              }

              .fileButton {
                font-size: 1.0rem;
              }

              .filesize {
                font-size: .75rem;
                color: darkgray;
                padding-left: 7px;
                padding-right: 5px;
                padding-top: 3px;
                flex-shrink: 0;
              }
              
              .fileName {
                cursor: copy;
                display: flex;
                border-radius: 6px;
                border-width: 1px;
                border-style: dashed;
                border-color: rgb(179, 179, 179);
                font-weight: bold;
                color: #2488e0;
                background: #FAFAFA;
                padding: 8px;
                max-width: 250px;
                transition: max-width 2s cubic-bezier(.22,.61,.36,1);
              }

              .fileButton:hover .fileName {
                /*color: #09c8f3;*/
                box-shadow: rgba(0, 0, 0, 0.35) 0px 5px 15px;
                background: white;
                border: none;
                max-width: 100vw;
              }

              .fileButton:hover sl-button.hide {
                display: inline-block;
              }

              .fileButton:hover tag-list.hide {
                display: flex;
              }

              .hide {
                display: none;
              }

            `
        ];
    }
}

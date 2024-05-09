import {css, html, LitElement} from "lit";
import {property, state, customElement} from "lit/decorators.js";
import {
    AgentPubKeyB64,
    EntryHashB64,
} from "@holochain/client";
import {prettyFileSize, prettyTimestamp} from "../utils";
import {columnBodyRenderer, columnFooterRenderer} from "@vaadin/grid/lit";
import {ParcelDescription} from "@ddd-qc/delivery/dist/bindings/delivery.types";
import {filesSharedStyles} from "../sharedStyles";
import {ZomeElement} from "@ddd-qc/lit-happ";
import {TaggingPerspective, TaggingZvm} from "../viewModels/tagging.zvm";
import {TagList} from "./tag-list";
import {kind2Type} from "../fileTypeUtils";
import {Profile as ProfileMat} from "@ddd-qc/profiles-dvm/dist/bindings/profiles.types";
import {msg} from "@lit/localize";


export interface FileTableItem {
    ppEh: EntryHashB64,
    description: ParcelDescription,
    timestamp: number,
    author: AgentPubKeyB64,
    isPrivate: boolean,
    isLocal: boolean,
}


/**
 * @element
 */
@customElement("file-table")
export class FileTable extends ZomeElement<TaggingPerspective, TaggingZvm> {

    /** */
    constructor() {
        super(TaggingZvm.DEFAULT_ZOME_NAME)
    }

    /** -- State variables -- */

    @property() items: FileTableItem[] = [];
    @property() profiles: Record<AgentPubKeyB64, ProfileMat> = {};

    @property() selectable?: string;

    @state() private _selectedItems: FileTableItem[] = [];


    /** */
    get gridElem(): LitElement {
        return this.shadowRoot!.getElementById("grid") as LitElement;
    }


    /** */
    render() {
        console.log("<file-table>.render()", this.items);
        if (!this.items.length) {
            return html`${msg("No items found")}`;
        }

        const totalSize = this.items.reduce((accumulator, item) => accumulator + item.description.size, 0);


        // if (this.selectable == undefined) {
        //     this._selectedItems = this.items;
        // }
        // .selectedItems="${this._selectedItems}"
        // @active-item-changed="${(e: GridActiveItemChangedEvent<FileTableItem>) => {
        //     const item = e.detail.value;
        //     this._selectedItems = item ? [item] : [];
        // }}"

        /** render all */
        return html`
            <vaadin-grid id="grid" 
                         .items=${this.items}>
                <vaadin-grid-selection-column></vaadin-grid-selection-column>
                <vaadin-grid-column path="description" header=${msg("Filename")}
                                    ${columnBodyRenderer(
                                            ({ description }) => html`<span>${description.name}</span>`,
                                            [],
                                    )}>
                </vaadin-grid-column>
                <vaadin-grid-column path="description" header=${msg("Size")}
                                    ${columnBodyRenderer(
                                ({ description }) => html`<span>${prettyFileSize(description.size)}</span>`,
                            [],
                                    )}
                                    ${columnFooterRenderer(() => html`<span>${prettyFileSize(totalSize)} ${msg("total")}</span>`, [totalSize])}
                ></vaadin-grid-column>
                <vaadin-grid-column path="description" header=${msg("Type")}
                                    ${columnBodyRenderer(
                                            ({ description }) => html`<span>${kind2Type(description.kind_info)}</span>`,
                                            [],
                                    )}
                ></vaadin-grid-column>
                <vaadin-grid-column path="ppEh" header=${msg("Group Tags")}
                                    ${columnBodyRenderer(
                                            ({ ppEh }) => html`<tag-list .tags=${this._zvm.getTargetPublicTags(ppEh)}></tag-list>`,
                                            [],
                                    )}
                ></vaadin-grid-column>
                <vaadin-grid-column path="ppEh" header=${msg("Personal Tags")}
                                    ${columnBodyRenderer(
                                            ({ ppEh }) => html`
                                                <div style="display:flex">
                                                    <tag-list id="priv-tags-${ppEh}" selectable deletable
                                                              .tags=${this._zvm.getTargetPrivateTags(ppEh)}
                                                              @deleted=${async (e) => {
                                                                  await this._zvm.untagPrivateEntry(ppEh, e.detail);
                                                                  const tagList = this.shadowRoot.getElementById(`priv-tags-${ppEh}`) as TagList;
                                                                  tagList.requestUpdate();
                                                              }}
                                                    ></tag-list>
                                                    <sl-icon-button class="add-tag" name="plus-circle-dotted" label=${msg("add")}></sl-icon-button>
                                                </div>
                                            `,
                                            [],
                                    )}
                ></vaadin-grid-column>
                <vaadin-grid-column path="author" header="Author" .hidden="${!this.items[0].author}"
                                    ${columnBodyRenderer(
                                            ({ author }) => {
                                                const maybeProfile = this.profiles[author];
                                                return maybeProfile
                                                        ? html`<span>${maybeProfile.nickname}</span>`
                                                        : html`<span>${msg("Unknown")}</span>`
                                            },
                                    [],
                                    )}
                ></vaadin-grid-column>
                <vaadin-grid-column path="timestamp" header="Date"
                                    ${columnBodyRenderer(
                                            ({ timestamp }) => html`<span>${prettyTimestamp(timestamp)}</span>`,
                                            [],
                                    )}
                ></vaadin-grid-column>
                <vaadin-grid-column path="isLocal" header="Local" .hidden="${!("isLocal" in this.items[0])}"
                                    ${columnBodyRenderer(
                                            ({ isLocal }) => html`<span>${isLocal? msg("Yes") : msg("No")}</span>`,
                                            [],
                                    )}
                ></vaadin-grid-column>
                <vaadin-grid-column path="isPrivate" header="Private" .hidden="${!("isPrivate" in this.items[0])}"
                                    ${columnBodyRenderer(
                                            ({ isPrivate }) => html`<span>${isPrivate? msg("Yes") : msg("No")}</span>`,
                                            [],
                                    )}
                ></vaadin-grid-column>
                <vaadin-grid-column
                        path="ppEh" header="" style="min-width: 300px"
                        ${columnBodyRenderer(
                                ({ppEh}) => {
                                    if (this.selectable == "") {
                                        return html`
                                            <sl-button size="small" variant="primary" style="margin-left:5px"
                                                       @click=${async (e) => {
                                                           this.dispatchEvent(new CustomEvent('selected', {
                                                               detail: ppEh,
                                                               bubbles: true,
                                                               composed: true
                                                           }));
                                                       }}>
                                                <sl-icon name="link-45deg"></sl-icon>
                                            </sl-button>
                                        `;
                                    } else {
                                        // TODO: Optimize. Better way to get the item here instead of doing a search for each item.
                                        const item = this.items.filter((item) => item.ppEh == ppEh);
                                        const isPublic = !item[0].isPrivate;
                                        console.log("isPublic", isPublic, item, ppEh)
                                        return html`
                                            ${isPublic? html`
                                            <sl-button size="small" variant="danger"
                                                       @click=${async (e) => {
                                                           console.log("Dispatching delete Event", ppEh)
                                                           this.dispatchEvent(new CustomEvent('delete', {
                                                               detail: ppEh,
                                                               bubbles: true,
                                                               composed: true
                                                           }));
                                                       }}>
                                                <sl-icon name="trash"></sl-icon>
                                            </sl-button>`: html``}                                       
                                            <sl-button size="small" variant="primary" style="margin-left:5px"
                                                       @click=${async (e) => {
                                                          this.dispatchEvent(new CustomEvent('download', {
                                                              detail: ppEh,
                                                              bubbles: true,
                                                              composed: true
                                                          }));
                                                      }}>
                                                <sl-icon name="download"></sl-icon>
                                            </sl-button>
                                            <sl-button size="small" variant="primary" 
                                                       @click=${async (e) => {
                                                          this.dispatchEvent(new CustomEvent('send', {
                                                              detail: ppEh,
                                                              bubbles: true,
                                                              composed: true
                                                          }));
                                                      }}>
                                                <sl-icon name="send"></sl-icon>
                                            </sl-button>
                                            <sl-button size="small" variant="neutral" 
                                                       @click=${async (e) => {
                                                          this.dispatchEvent(new CustomEvent('view', {
                                                              detail: ppEh,
                                                              bubbles: true,
                                                              composed: true
                                                          }));
                                                      }}>
                                                <sl-icon name="info-lg"></sl-icon>
                                            </sl-button>
                                        `
                                    }
                                },
                                []
                        )}
                        ${columnFooterRenderer(() => html`<span>${this.items.length} ${msg("files")}</span>`, [this.items])}
                ></vaadin-grid-column>                
            </vaadin-grid>            
        `;
    }


    /** */
    static get styles() {
        return [
            filesSharedStyles,
            css`
              :host {
                flex: 1 1 auto;
                padding-bottom: 80px;
                padding-right: 10px;                
              }
              #grid {
                height: 100%;
              }
              .add-tag {
                font-size: 1.0rem;
              }
            `
        ];
    }
}

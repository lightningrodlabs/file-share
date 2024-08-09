import {css, html, LitElement} from "lit";
import {property, customElement} from "lit/decorators.js";
import {prettyFileSize, prettyTimestamp} from "../utils";
import {columnBodyRenderer, columnFooterRenderer} from "@vaadin/grid/lit";
import {ParcelDescription} from "@ddd-qc/delivery/dist/bindings/delivery.types";
import {filesSharedStyles} from "../sharedStyles";
import {EntryId, ZomeElement} from "@ddd-qc/lit-happ";
import {TaggingZvm} from "../viewModels/tagging.zvm";
import {TagList} from "./tag-list";
import {kind2Type} from "../fileTypeUtils";
import {Profile as ProfileMat} from "@ddd-qc/profiles-dvm/dist/bindings/profiles.types";
import {msg} from "@lit/localize";
import {EntryHashB64} from "@holochain/client";
import {TaggingPerspectiveMutable} from "../viewModels/tagging.perspective";


/** Don't use HolochainId directly as the vaadin will try to autoconvert to string for default rendering */
export interface FileTableItem {
    ppEh: EntryHashB64,
    description: ParcelDescription,
    timestamp: number,
    author?: ProfileMat,
    isPrivate: boolean,
    isLocal: boolean,
}


/**
 * @element
 */
@customElement("file-table")
export class FileTable extends ZomeElement<TaggingPerspectiveMutable, TaggingZvm> {

    /** */
    constructor() {
        super(TaggingZvm.DEFAULT_ZOME_NAME)
    }

    /** -- State variables -- */

    @property() items: FileTableItem[] = [];
    //@property() profiles: profiles = new AgentIdMap();

    @property() type: string = ""

    @property() selectable?: string;

    //@state() private _selectedItems: FileTableItem[] = [];


    /** */
    get gridElem(): LitElement {
        return this.shadowRoot!.getElementById("grid") as LitElement;
    }


    /** */
    override render() {
        console.log("<file-table>.render()", this.type, this.items, this._zvm.perspective);
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
        //return html``;
        return html`
            <vaadin-grid id="grid"
                         .items=${this.items}>
                <vaadin-grid-selection-column></vaadin-grid-selection-column>
                <vaadin-grid-column path="description" header=${msg("Filename")}
                                    ${columnBodyRenderer<FileTableItem>(
                                            ({ description }) => html`<span>${description.name}</span>`,
                                            [],
                                    )}>
                </vaadin-grid-column>
                
                <vaadin-grid-column path="description" header=${msg("Size")} width="80px"
                                    ${columnBodyRenderer<FileTableItem>(
                                ({ description }) => html`<span>${prettyFileSize(description.size)}</span>`,
                            [],
                                    )}
                                    ${columnFooterRenderer(() => html`<span>${prettyFileSize(totalSize)} ${msg("total")}</span>`, [totalSize])}
                ></vaadin-grid-column>
                <vaadin-grid-column path="description" header=${msg("Type")}
                                    ${columnBodyRenderer<FileTableItem>(
                                            ({ description }) => html`<span>${kind2Type(description.kind_info)}</span>`,
                                            [],
                                    )}
                ></vaadin-grid-column>
                    
                <vaadin-grid-column path="ppEh" header=${msg("Group Tags")}
                                    ${columnBodyRenderer<FileTableItem>(
                                            ({ ppEh }) => html`<tag-list .tags=${this._zvm.perspective.getTargetPublicTags(new EntryId(ppEh))}></tag-list>`,
                                            [],
                                    )}
                ></vaadin-grid-column>
                <vaadin-grid-column path="ppEh" header=${msg("Personal Tags")}
                                    ${columnBodyRenderer<FileTableItem>(
                                            ({ ppEh }) => html`
                                                <div style="display:flex">
                                                    <tag-list id="priv-tags-${ppEh}" selectable deletable
                                                              .tags=${this._zvm.perspective.getTargetPrivateTags(new EntryId(ppEh))}
                                                              @deleted=${async (e: CustomEvent<string>) => {
                                                                  await this._zvm.untagPrivateEntry(new EntryId(ppEh), e.detail);
                                                                  const tagList = this.shadowRoot!.getElementById(`priv-tags-${ppEh}`) as TagList;
                                                                  tagList.requestUpdate();
                                                              }}
                                                    ></tag-list>
                                                    <sl-icon-button class="add-tag" name="plus-circle-dotted" label=${msg("add")}></sl-icon-button>
                                                </div>
                                            `,
                                            [],
                                    )}
                ></vaadin-grid-column>
                <vaadin-grid-column path="author" header=${msg("Author")}
                                    ${columnBodyRenderer<FileTableItem>(
                                            ({ author }) => {
                                                return author
                                                        ? html`<span>${author.nickname}</span>`
                                                        : html`<span>${msg("Unknown")}</span>`
                                            },
                                    [],
                                    )}
                ></vaadin-grid-column>
                <vaadin-grid-column path="timestamp" header=${msg("Date")}
                                    ${columnBodyRenderer<FileTableItem>(
                                            ({ timestamp }) => html`<span>${prettyTimestamp(timestamp)}</span>`,
                                            [],
                                    )}
                ></vaadin-grid-column>
                <vaadin-grid-column path="isLocal" header=${msg("Local")} width="80px"
                                    .hidden=${this.type == "personal"}
                                    ${columnBodyRenderer<FileTableItem>(
                                            ({ isLocal }) => html`<span>${isLocal? msg("Yes") : msg("No")}</span>`,
                                            [],
                                    )}
                ></vaadin-grid-column>
                <vaadin-grid-column path="isPrivate" header=${msg("Private")} width="80px"
                                    .hidden=${this.type == "group" || this.type == "personal"}
                                    ${columnBodyRenderer<FileTableItem>(
                                            ({ isPrivate }) => html`<span>${isPrivate? msg("Yes") : msg("No")}</span>`,
                                            [],
                                    )}
                ></vaadin-grid-column>
                <vaadin-grid-column
                        path="ppEh" header="" width="160px" style="text-overflow: clip;"
                        ${columnBodyRenderer<FileTableItem>(
                                ({ppEh}) => {
                                    if (this.selectable == "") {
                                        return html`
                                            <sl-button size="small" variant="primary" style="margin-left:5px"
                                                       @click=${async (_e:any) => {
                                                           this.dispatchEvent(new CustomEvent<EntryId>('selected', {
                                                               detail: new EntryId(ppEh),
                                                               bubbles: true,
                                                               composed: true
                                                           }));
                                                       }}>
                                                <sl-icon name="link-45deg"></sl-icon>
                                            </sl-button>
                                        `;
                                    } else {
                                        // TODO: Optimize. Should have a better way to get the item here instead of doing a search for each item.
                                        const item = this.items.filter((item) => item.ppEh == ppEh);
                                        const isPublic = item.length > 0 && !item[0]!.isPrivate;
                                        //console.log("isPublic", isPublic, item, ppEh)
                                        return html`
                                            <sl-button size="small" variant="primary" style="margin-left:5px"
                                                       @click=${async (_e:any) => {
                                                          this.dispatchEvent(new CustomEvent<EntryId>('download', {
                                                              detail: new EntryId(ppEh),
                                                              bubbles: true,
                                                              composed: true
                                                          }));
                                                      }}>
                                                <sl-icon name="download"></sl-icon>
                                            </sl-button>
                                            ${!isPublic? html`
                                            <sl-button size="small" variant="primary"
                                                       @click=${async (_e:any) => {
                                                          this.dispatchEvent(new CustomEvent<EntryId>('send', {
                                                              detail: new EntryId(ppEh),
                                                              bubbles: true,
                                                              composed: true
                                                          }));
                                                      }}>
                                                <sl-icon name="send"></sl-icon>
                                            </sl-button>`: html``}
                                            <sl-button size="small" variant="neutral"
                                                       @click=${async (_e:any) => {
                                                          this.dispatchEvent(new CustomEvent<EntryId>('view', {
                                                              detail: new EntryId(ppEh),
                                                              bubbles: true,
                                                              composed: true
                                                          }));
                                                      }}>
                                                <sl-icon name="info-lg"></sl-icon>
                                            </sl-button>
                                            ${isPublic? html`
                                            <sl-button size="small" variant="danger"
                                                       @click=${async (_e:any) => {
                                                console.log("Dispatching delete Event", ppEh)
                                                this.dispatchEvent(new CustomEvent<EntryId>('delete', {
                                                    detail: new EntryId(ppEh),
                                                    bubbles: true,
                                                    composed: true
                                                }));
                                            }}>
                                                <sl-icon name="trash"></sl-icon>
                                            </sl-button>`: html``}
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
    static override get styles() {
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

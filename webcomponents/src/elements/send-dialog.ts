import {css, html} from "lit";
import {property, state, customElement} from "lit/decorators.js";
import {AgentId, DnaElement, EntryId} from "@ddd-qc/lit-happ";
import {FilesDvm} from "../viewModels/files.dvm";
import {filesSharedStyles} from "../sharedStyles";
import {FilesDvmPerspective} from "../viewModels/files.perspective";
import {SlDialog, SlInput,} from "@shoelace-style/shoelace";
import {prettyFileSize, splitFile, SplitObject} from "../utils";
import {toastError} from "../toast";
import {TagList} from "./tag-list";
import {kind2Icon} from "../fileTypeUtils";
import {ProfilesPerspective} from "@ddd-qc/profiles-dvm";
import {msg} from "@lit/localize";


interface AgentItem {
    key: AgentId,
    name: string,
}

/**
 * @element
 */
@customElement("send-dialog")
export class SendDialog extends DnaElement<FilesDvmPerspective, FilesDvm> {

    @state() private _allAgents: AgentItem[] = [];
    //@state() private _filteredAgents: AgentItem[] = [];
    //@state() private _recipient?: AgentPubKeyB64;
    @state() private _recipients: AgentId[] = [];


    @state() private _file: File | undefined = undefined;
    private _splitObj?: SplitObject;

    @property({type: Object, attribute: false, hasChanged: (_v, _old) => true})
    profilesPerspective!: ProfilesPerspective;


    /** -- Getters -- */

    get dialogElem() : SlDialog {
        return this.shadowRoot!.querySelector("sl-dialog") as SlDialog;
    }

    get recipientElem() : HTMLElement {
        return this.shadowRoot!.getElementById("recipientSelector") as HTMLElement;
    }


    /** -- Methods -- */

    /** */
    open(hash?: EntryId) {
        if (hash) {
            this._dvm.fetchFile(hash).then(([_manifest, file]) => {
                splitFile(file, this._dvm.dnaProperties.maxChunkSize).then((splitObj) => {
                    this._splitObj = splitObj;
                    this._file = file;
                    this.dialogElem.open = true;
                })
            });
            return;
        }
        const input = document.createElement('input');
        input.type = 'file';
        input.onchange = async (e:any) => {
            console.log("<send-dialog> target download file", e);
            const file = e.target.files[0];
                if (file.size > this._dvm.dnaProperties.maxParcelSize) {
                    toastError(`File is too big ${prettyFileSize(file.size)}. Maximum file size: ${prettyFileSize(this._dvm.dnaProperties.maxParcelSize)}`)
                    return;
                }
                this._splitObj = await splitFile(file, this._dvm.dnaProperties.maxChunkSize);
                this._file = file;
                this.dialogElem.open = true;
            }
        input.click();
    }


    // /** */
    // private filterChanged(event: ComboBoxFilterChangedEvent) {
    //     const filter = event.detail.value;
    //     console.log("filter", filter);
    //     this._filteredAgents = this._allAgents.filter(({ name }) =>
    //         name.toLowerCase().startsWith(filter.toLowerCase())
    //     );
    //     console.log("_filteredAgents", this._filteredAgents);
    // }


//     private agentRenderer: ComboBoxLitRenderer<AgentItem> = (agent) => html`
//   <div style="display: flex;">
//     <img
//       style="height: var(--lumo-size-m); margin-right: var(--lumo-space-s);"
//       src="${this._profilesZvm.perspective.profiles[agent.key].fields["avatar"]}"
//       alt="Portrait of ${agent.name}"
//     />
//     <div>
//       ${agent.name}
//     </div>
//   </div>
// `;

    // /** */
    // private agentRenderer: ComboBoxLitRenderer<AgentItem> = (agent) => html`
    //   <div style="display: flex; width: 100%;">
    //     <div>
    //       ${agent.name}
    //     </div>
    //   </div>
    // `;


    @state() private _selectedTags: string[] = [];

    get inputElem() : SlInput {
        return this.shadowRoot!.getElementById("tag-input") as SlInput;
    }

    get tagListElem() : TagList {
        return this.shadowRoot!.getElementById("selected-tag-list") as TagList;
    }


    /** */
    async onAddNewPrivateTag(e:any) {
        console.log("onAddNewPrivateTag", e);
        await this._dvm.taggingZvm.commitPrivateTag(e.detail);
        this._selectedTags.push(e.detail);
        if (this.tagListElem) this.tagListElem.requestUpdate();
        this.requestUpdate();
    }


    /** */
    override render() {
        console.log("<send-dialog>.render()", this._recipients.length, this._file, this._allAgents, this._selectedTags);

        let myNotifier = html`<div slot="footer" style="color:red;"></div>`;
        // const maybeNotifier = this._dvm.notificationsZvm.perspective.myNotifier;
        //let myNotifier = html`<div slot="footer" style="color:red;">${msg('No notifier')}</div>`;
        // if (maybeNotifier) {
        //     //myNotifier = html`<div slot="footer" style="color:darkorange;">${msg('notifier selected')}</div>`;
        //     myNotifier = html``;
        // }


        let content = html`<sl-spinner></sl-spinner>`;
        if (this._file) {
            // ${comboBoxRenderer(this.agentRenderer, [])}

            const allTags = this._dvm.taggingZvm.perspective.allPrivateTags
                .filter((tag) => this._selectedTags.indexOf(tag) < 0)

            content = html`
                <div id="filename">
                    <sl-icon class="prefixIcon" name=${kind2Icon({Manifest: this._file.type})}></sl-icon>                    
                    ${this._file.name} 
                    <span style="font-weight: normal">(${prettyFileSize(this._file.size)})</span>
                </div>
                <!--<<div style="margin-left:10px;">
                    <div>Size: ${prettyFileSize(this._file.size)}</div>
                        div>Type: ${this._file.type}</div> 
                    <div>Hash: ${!this._splitObj? "" : this._splitObj.dataHash}</div>
                </div> -->
                ${msg("To")}:
                <profile-input
                        @selected=${(e:any) => {
                            console.log("profile selected:", e.detail);
                            if (e.detail) {
                                this._recipients.push(e.detail);
                                this.requestUpdate();
                            }
                        }}
                        @cleared=${(e:any) => {
                            console.log("profile cleared:", e.detail);
                            if (e.detail) {
                                const index = this._recipients.map(id => id.b64).indexOf(e.detail);
                                if (index > -1) {
                                    this._recipients.splice(index, 1);
                                    this.requestUpdate();
                                }
                            }
                        }}                        
                ></profile-input>
                
                <sl-divider></sl-divider>
                
                <div style="margin-bottom: 5px; display:flex;">
                    <span style="margin-top: 10px;margin-right: 10px;">Tags:</span>
                    ${this._selectedTags.length == 0
                ? html``
                : html`
                            <tag-list id="selected-tag-list" selectable deletable
                                      .tags=${this._selectedTags}
                                      @deleted=${(e:any) => {
                    console.log("deleted tag", e.detail);
                    const index = this._selectedTags.indexOf(e.detail);
                    if (index > -1) {
                        this._selectedTags.splice(index, 1);
                    }
                    this.requestUpdate();
                    if(this.tagListElem) this.tagListElem.requestUpdate();
                }}
                            >
                            </tag-list>
                    `}
                </div>
                <tag-input .tags=${allTags}
                           @new-tag=${(e:any) => {console.log("e", e); this.onAddNewPrivateTag(e)}}
                           @selected=${(e:any) => {this._selectedTags.push(e.detail); this.requestUpdate(); if (this.tagListElem) this.tagListElem.requestUpdate();}}
                ></tag-input>

                ${myNotifier}
                <sl-button slot="footer" variant="neutral" @click=${(_e:any) => {this._file = undefined; this.dialogElem.open = false;}}>${msg("Cancel")}</sl-button>
                <sl-button slot="footer" variant="primary" ?disabled=${this._recipients.length <= 0} @click=${async (_e:any) => {
                this.dispatchEvent(new CustomEvent('send-started', {detail: {splitObj: this._splitObj, recipients: this._recipients}, bubbles: true, composed: true}));
                //const _splitObject = await this._dvm.startCommitPrivateAndSendFile(this._file, this._recipient, this._selectedTags.map((item) => item.value));
                /*const _splitObject =*/ await this._dvm.startCommitPrivateAndSendFile(this._file!, this._recipients, this._selectedTags);
                this._file = undefined;
                this._selectedTags = [];
                this._recipients = [];
                this.dialogElem.open = false;
            }}>
                    ${msg("Send")}
                </sl-button>
                
            `;

        }


        /** render all */
        return html`
            <sl-dialog class="action-dialog"
                       @sl-request-close=${(_e:any) => this._file = undefined}>
                <div slot="label">
                    <sl-icon class="prefixIcon" name="send"></sl-icon>
                    ${msg("Sending")}
                </div>
                ${content}
            </sl-dialog>
        `;
}


/** */
static override get styles() {
return [
filesSharedStyles,
css`              
  sl-dialog {
    --width: 400px;
  } 
  sl-dialog::part(close-button) {
    color:white;
    font-size: 20px;
  }

  sl-divider {
    margin: 0px;
    margin-top: 0px;
    margin-top: 10px;
    border-color: #6f6f6f;                
  }
  
  #filename {
    background: white;
    color: #0089FF;
    border-radius: 6px;
    padding: 10px;
    font-weight: bold;
  }

`
        ];
    }
}

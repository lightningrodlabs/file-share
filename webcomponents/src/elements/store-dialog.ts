import {css, html, PropertyValues} from "lit";
import {property, state, customElement} from "lit/decorators.js";
import {DnaElement} from "@ddd-qc/lit-happ";
import {FilesDvm} from "../viewModels/files.dvm";
import {filesSharedStyles} from "../sharedStyles";
import {FilesDvmPerspective} from "../viewModels/files.perspective";
import {SlDialog, SlInput} from "@shoelace-style/shoelace";
import {getCompletionPct, prettyFileSize, splitFile, SplitObject} from "../utils";
import {toastError, toastWarning} from "../toast";
import {TagList} from "./tag-list";
import {kind2Icon} from "../fileTypeUtils";
import {msg} from "@lit/localize";
import {EntryHashB64} from "@holochain/client";



/**
 * @element
 */
@customElement("store-dialog")
export class StoreDialog extends DnaElement<FilesDvmPerspective, FilesDvm> {

    @property() wait: boolean = false;

    @state() private _file?: File;
    @state() private _selectedTags = [];

    private _splitObj?: SplitObject;

    private _localOnly: boolean = false;

    /** -- Getters -- */


    get inputElem() : SlInput {
        return this.shadowRoot.getElementById("tag-input") as SlInput;
    }

    get dialogElem() : SlDialog {
        return this.shadowRoot.querySelector("sl-dialog") as SlDialog;
    }


    get tagListElem() : TagList {
        return this.shadowRoot.querySelector("tag-list") as TagList;
    }

    /** -- Methods -- */

    /** */
    open(localOnly?: boolean) {
        console.log("<store-dialog> open()", this._dvm);
        this._localOnly = false;
        if (localOnly) this._localOnly = localOnly;
        //console.log("<store-dialog> localOnly", localOnly, this._localOnly);
        var input = document.createElement('input');
        input.type = 'file';
        input.onchange = async (e:any) => {
            console.log("<store-dialog> target download file", e);
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


    /** */
    async onAddNewTag(e) {
        console.log("onAddNewTag", e);
        if (this._localOnly) {
            await this._dvm.taggingZvm.addPrivateTag(e.detail);
        } else {
            await this._dvm.taggingZvm.addPublicTag(e.detail);
        }
        this._selectedTags.push(e.detail);
        if (this.tagListElem) this.tagListElem.requestUpdate();
        this.requestUpdate();
    }


    /** */
    render() {
        console.log("<store-dialog>.render()", this.wait, this._file, this.perspective.uploadState);

        let content = html`<sl-spinner></sl-spinner>`;

        if (this.wait && this.perspective.uploadState) {
            let pct = Math.ceil(this.perspective.uploadState.written_chunks / this.perspective.uploadState.splitObj.numChunks * 100);
            content = html`<sl-progress-bar .value=${pct}>${pct}%</sl-progress-bar>`;
        }

        if (this._file) {
            let allTags;
            if (this._localOnly) {
                allTags = this._dvm.taggingZvm.allPrivateTags;
            } else {
                allTags = this._dvm.taggingZvm.allPublicTags;
            }
            allTags.filter((tag) => this._selectedTags.indexOf(tag) < 0);
            /** */
            content = html`
                <div id="filename">
                    <sl-icon class="prefixIcon" name=${kind2Icon({Manifest: this._file.type})}></sl-icon>
                    ${this._file.name}
                    <span style="font-weight: normal">(${prettyFileSize(this._file.size)})</span>
                </div>
                    
                <!--<div>Size: ${prettyFileSize(this._file.size)}</div>                    
                    <div>Type: ${this._file.type}</div>
                    <div>Hash: ${!this._splitObj? "" : this._splitObj.dataHash}</div>
                </div>-->
                
                <div style="margin-bottom: 5px; display:flex;">
                    <span style="margin-top: 10px;margin-right: 10px;">${msg("Tags")}:</span> 
                    ${this._selectedTags.length == 0
                ? html``
                : html`
                    <tag-list selectable deletable
                              .tags=${this._selectedTags}
                              @deleted=${(e) => {
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
                           @new-tag=${(e) => {console.log("e", e); this.onAddNewTag(e)}}
                           @selected=${(e) => {this._selectedTags.push(e.detail); this.requestUpdate(); if (this.tagListElem) this.tagListElem.requestUpdate();}}
                ></tag-input>
                
                <sl-button slot="footer" variant="neutral" 
                           @click=${(e) => {
                                this._file = undefined; 
                                this.dialogElem.open = false;
                                this.dispatchEvent(new CustomEvent('cancel', {detail: null, bubbles: true, composed: true}))
                           }}>
                    ${msg("Cancel")}
                </sl-button>
                <sl-button slot="footer" variant="primary" 
                           ?disabled=${!this._file} 
                           @click=${async (e) => {
                               e.preventDefault(); e.stopPropagation();
                               if (this._localOnly) {
                                   const res = await this._dvm.startCommitPrivateFile(this._file, this._selectedTags);
                                   if (!res) {
                                       const str = msg("File already stored locally");
                                       toastError(str);
                                       this.dispatchEvent(new CustomEvent('reject', {detail: str, bubbles: true, composed: true}));
                                       this.dialogElem.open = false;
                                   }
                               }  else {
                                   let maybeSplitObj;
                                   let str = msg("File already shared to group or stored locally")
                                   try {
                                       maybeSplitObj = await this._dvm.startPublishFile(this._file, this._selectedTags, (manifestEh: EntryHashB64) => {
                                           console.log("<store-dialog>.onUploadDone()", manifestEh, this);
                                           this.dispatchEvent(new CustomEvent('created', {detail: manifestEh, bubbles: true, composed: true}));
                                           if (this.dialogElem) this.dialogElem.open = false;
                                       }
                                   );
                                   } catch(e) {
                                       console.warn("filesDvm.startPublishFile() Failed", e);
                                       str = e;
                                   }
                                   console.log("<store-dialog>.click", maybeSplitObj);
                                   if (!maybeSplitObj) {
                                       toastError(str);
                                       this.dispatchEvent(new CustomEvent('reject', {detail: str, bubbles: true, composed: true}));
                                       this.dialogElem.open = false;
                                   }
                               }
                            this._file = undefined;
                            this._selectedTags = [];
                            if (!this.wait) {
                                this.dialogElem.open = false;
                            }
                            //this.dispatchEvent(new CustomEvent('store-started', {detail: this._splitObj, bubbles: true, composed: true}));
                        }}>
                    ${this._localOnly? msg("Add") : msg("Publish")}
                </sl-button>                
            `;

        }

        /** render all */
        return html`
            <sl-dialog class="action-dialog" 
                       @sl-request-close=${(e) => {
                           console.log("<store-dialog> sl-request-close", e); 
                           if (!this.wait) {
                               this._file = undefined;
                           } else {
                               e.preventDefault();
                               e.stopPropagation();
                           }
                       }}>
                <div slot="label">
                    <sl-icon class="prefixIcon" name="${this._localOnly?"hdd" : "people"}"></sl-icon>
                    ${this._localOnly? msg("Add to my personal files") : msg("Share with group")}
                </div>
                ${content}
            </sl-dialog>
        `;
    }


    /** */
    static get styles() {
        return [
            filesSharedStyles,
            css`
              sl-dialog {
                --width: 500px;
              }
              sl-dialog::part(close-button) {
                color:white;
                font-size: 20px;
              }
              
              #filename {
                background: white;
                color: #0089FF;
                border-radius: 6px;
                padding: 10px;
                margin-bottom: 10px;
                font-weight: bold;
              }
              
            `
        ];
    }
}

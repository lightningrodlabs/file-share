import {css, html, PropertyValues} from "lit";
import {customElement, property, state} from "lit/decorators.js";
import {DnaElement} from "@ddd-qc/lit-happ";
import {decodeHashFromBase64, EntryHashB64,} from "@holochain/client";
import {FilesDvm} from "../viewModels/files.dvm";
import {ParcelManifest} from "@ddd-qc/delivery";
import {filesSharedStyles} from "../sharedStyles";
import {FilesDvmPerspective} from "../viewModels/files.perspective";
import {msg} from "@lit/localize";
import {FileType, kind2mime, kind2Type} from "../fileTypeUtils";


/**
 * @element
 */
@customElement("file-preview")
export class FilePreview extends DnaElement<FilesDvmPerspective, FilesDvm> {

    /** -- Properties -- */

    /** Hash of ParcelManifest to display */
    @property() hash: EntryHashB64 = ''

    /** Observed perspective from zvm */
    // @property({type: Object, attribute: false, hasChanged: (_v, _old) => true})
    // filesPerspective!: FileSharePerspective;

    @state() private _loading = true;
    @state() private _manifest?: ParcelManifest;
             private _maybeFile?: File;
             //private _maybeDataUrl?: string | ArrayBuffer;
             private _maybeBlobUrl?: string;


    /** -- Methods -- */

    /** */
    protected async willUpdate(changedProperties: PropertyValues<this>) {
        super.willUpdate(changedProperties);
        console.log("<file-preview>.willUpdate()", changedProperties, !!this._dvm, this.hash);
        if (this._dvm && (changedProperties.has("hash") || (!this._manifest && this.hash))) {
            console.log("<file-preview>.willUpdate()", this.hash);
            this._loading = true;
            this._manifest = await this._dvm.filesZvm.zomeProxy.getFileInfo(decodeHashFromBase64(this.hash));
            //console.log(`<file-preview>.willUpdate() ${this._manifest.description.size} < ${this._dvm.dnaProperties.maxChunkSize}?`);
            if (this._manifest && this._manifest.description.size < this._dvm.dnaProperties.maxChunkSize) {
                const mime = kind2mime(this._manifest.description.kind_info);
                //const fileType = kind2Type(this._manifest.description.kind_info);
                const data = await this._dvm.deliveryZvm.getParcelData(this.hash);
                this._maybeFile = this._dvm.data2File(this._manifest, data);

                const reader = new FileReader();
                if (this._maybeBlobUrl) {
                    URL.revokeObjectURL(this._maybeBlobUrl);
                    this._maybeBlobUrl = undefined;
                }
                //this._maybeBlobUrl = URL.createObjectURL(this._maybeFile);
                reader.onload = (event) => {
                    console.log("FileReader onload", event, mime)
                    //this._maybeDataUrl = event.target.result;
                    const blob = new Blob([event.target.result], { type: mime });
                    this._maybeBlobUrl = URL.createObjectURL(blob);
                    console.log("FileReader blob", blob, this._maybeBlobUrl)
                    //this.requestUpdate();
                    this._loading = false;
                };
                //reader.readAsDataURL(this._maybeFile);
                reader.readAsArrayBuffer(this._maybeFile);
            } else {
                this._loading = false;
            }
        }
    }


    /** */
    render() {
        console.log("<file-preview>.render()", this.hash, this._maybeBlobUrl);
        if (this.hash == "") {
            return html`
                <div style="color:#c10a0a">${msg("No file selected")}</div>`;
        }
        if (!this._manifest) {
            return html`
                <div style="color:#c10a0a">${msg("File not found")}</div>`;
        }
        if (this._loading) {
            return html`<sl-spinner></sl-spinner>`;
        }

        //const file_type = (this._manifest.description.kind_info as ParcelKindVariantManifest).Manifest;
        const mime = kind2mime(this._manifest.description.kind_info);
        const fileType = kind2Type(this._manifest.description.kind_info);

        let preview = html`<div id="preview">File "${this._manifest.description.name}" too big for preview</div>`;
        if (this._maybeFile) {
            switch (fileType) {
                // case FileType.Text:
                //     // const tt = atob((this._maybeBlobUrl as string).split(',')[1]);
                //     // //const text = decodeURIComponent(escape(tt)));
                //     // console.log("FileType.Text", this._maybeDataUrl)
                //     // preview = html`<div id="preview" class="text">${tt}</div>`;
                //     preview = html`<embed id="preview" src=${this._maybeBlobUrl} type=${mime} width="440px" height="300px" />`;
                //     break;
                // case FileType.Pdf:
                //     preview = html`<embed id="preview" src=${this._maybeBlobUrl} type=${mime} width="440px" height="300px" />`;
                //     //preview = html`<embed id="preview" src=${this._maybeBlobUrl} type="application/pdf" width="100%" height="600px" />`;
                //     break;
                // case FileType.Image:
                //     preview = html`<img id="preview" src=${this._maybeBlobUrl} alt="Preview Image" />`;
                //     break;
                case FileType.Audio:
                    preview = html`
                        <audio id="preview" class="Audio" controls>
                            <source src=${this._maybeBlobUrl} type=${mime}>
                            Your browser does not support the audio element.
                        </audio>
                    `;
                    break;
                case FileType.Video:
                    //  width="440" height="320"
                    preview = html`
                        <video id="preview" class="Video" controls>
                            <source src=${this._maybeBlobUrl} type=${mime}>
                            Your browser does not support the video element.
                        </video>
                    `;
                    break;
                default:
                    //preview = html`<div id="preview">Preview not available for this type</div>`;
                    preview = html`<embed id="preview" class="${fileType}" src=${this._maybeBlobUrl} type=${mime} />`;
                    break;
            }
        }

        /** render all */
        return html`${preview}`;
    }


    /** */
    static get styles() {
        return [
            filesSharedStyles,
          css`
              :host {
                  display: flex;
                  flex-direction: column;
                  gap: 5px;
                  padding-left: 7px;
                  padding-right: 5px;
              }
              
              #preview {
                  flex-grow: 1;                  
                  background: #dadada;
                  min-height: 40px;
                  min-width: 40px;
                  max-height: 400px;
                  /*width:100%;*/
                  /*max-width: 440px;*/
                  /*overflow: auto;*/
                  padding: 5px;                  
              }

              .Audio {
                  max-height: 50px !important;
              }
              .Image,
              .Video {
                  /*height: 300px;*/
                  /*width: 440px;*/
                  min-height: 120px !important;
              }
              
              .PDF,
              .Document,
              .Text {
                  /*height: 300px;*/
                  min-height: 250px !important;
                  white-space: pre;
                  max-height: 100vh !important;
                  box-shadow: rgba(0, 0, 0, 0.15) 0px 3px 3px 0px inset;
              }
          `,
        ];
    }
}

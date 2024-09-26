import {css, html, PropertyValues} from "lit";
import {customElement, property, state} from "lit/decorators.js";
import {DnaElement, EntryId} from "@ddd-qc/lit-happ";
import {FilesDvm} from "../viewModels/files.dvm";
import {ParcelManifest} from "@ddd-qc/delivery";
import {filesSharedStyles} from "../sharedStyles";
import {FilesDvmPerspective} from "../viewModels/files.perspective";
import {msg} from "@lit/localize";
import {prettyFileSize} from "../utils";
import {kind2mime} from "../fileTypeUtils";


/**
 * @element
 */
@customElement("file-view")
export class FileView extends DnaElement<FilesDvmPerspective, FilesDvm> {

    /** -- Properties -- */

    /** Hash of ParcelManifest to display */
    @property() hash?: EntryId;

    /** Enable action bar */
    @property() showActionBar: boolean = true

    /** Observed perspective from zvm */
    // @property({type: Object, attribute: false, hasChanged: (_v, _old) => true})
    // filesPerspective!: FileSharePerspective;

    /** -- State variables -- */

    @state() private _loading = true;
    @state() private _manifest?: ParcelManifest;


    /** -- Methods -- */


    /** */
    protected override async willUpdate(changedProperties: PropertyValues<this>) {
        super.willUpdate(changedProperties);
        //console.log("<file-view>.willUpdate()", changedProperties, !!this._dvm, this.hash);
        if (this._dvm && (changedProperties.has("hash") || (!this._manifest && this.hash))) {
            console.log("<file-view>.willUpdate()", this.hash!.b64);
            this._loading = true;
            //this._manifest = await this._dvm.filesZvm.zomeProxy.getFileInfo(this.hash!.hash);
            this._manifest = await this._dvm.fetchFileInfo(this.hash!);
            this._loading = false;
        }
    }


    /** */
    override render() {
        console.log("<file-view>.render()", this.hash);
        if (!this.hash) {
            return html`<div style="color:#c10a0a">${msg("No file selected")}</div>`;
        }
        if (!this._manifest) {
            return html`<div style="color:#c10a0a">${msg("File not found")}</div>`;
        }
        if (this._loading) {
            return html`<sl-spinner></sl-spinner>`;
        }

        /** render all */
        return html`
            <h3 id="title"><files-filename .filename=${this._manifest.description.name}></files-filename></h3>
            <div>Size: ${prettyFileSize(this._manifest.description.size)}</div>
            <div style="padding-bottom: 10px;">MIME: ${kind2mime(this._manifest.description.kind_info)}</div>
            <file-preview .hash=${this.hash}></file-preview>
            ${this.showActionBar
                    ? html`<sl-button variant="primary" @click=${(_e:any) => {this._dvm.downloadFile(this.hash!)}}>Download</sl-button>`
                    : html``
            }
        `;
    }


    /** */
    static override get styles() {
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
              
              #title {
                  font-size: 1.5rem;
              }
              

              sl-button {
                  margin-top: 5px;
                  max-width: 120px;
              }

              sl-button::part(label) {
                  font-weight: bold;
              }
          `,
        ];
    }
}

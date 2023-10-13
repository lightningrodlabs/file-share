import {css, html, PropertyValues} from "lit";
import {property, state, customElement} from "lit/decorators.js";
import {DnaElement} from "@ddd-qc/lit-happ";
import {
    EntryHashB64,
} from "@holochain/client";
import {FileShareDvm} from "../viewModels/fileShare.dvm";
import {mime2icon, prettyFiletype} from "../utils";
import {sharedStyles} from "../sharedStyles";
import {FileShareDvmPerspective} from "../viewModels/fileShare.perspective";


/**
 * @element
 */
@customElement("file-button")
export class FileButton extends DnaElement<FileShareDvmPerspective, FileShareDvm> {

    /** -- Properties -- */

    /** Hash of ParcelManifest to display */
    @property() hash: EntryHashB64 = ''

    /** Enable action bar */
    @property() showActionBar: boolean = false

    /** -- State variables -- */

    @state() private _loading = true;
    @state() private _manifest?;


    /** -- Methods -- */


    /** */
    render() {
        console.log("<file-view>.render()", this.hash);
        if (this.hash == "") {
            return html`<sl-button disabled>N/A</sl-button>`;
        }

        /** Retrieve File description */
        const tuple = this._dvm.deliveryZvm.perspective.privateManifests[this.hash];
        let fileDescription;
        let isPrivate = false;
        if (tuple) {
            fileDescription = tuple[0].description;
            isPrivate = true;
        } else {
            const tuple = this._dvm.deliveryZvm.perspective.localPublicManifests[this.hash];
            if (tuple) {
                fileDescription = tuple[0].description;
            } else {
                const tuple = this._dvm.deliveryZvm.perspective.publicParcels[this.hash];
                if (tuple) {
                    fileDescription = tuple[0];
                } else {
                    return html`<sl-button disabled>File not found</sl-button>`;
                }
            }
        }


        /** render all */
        return html`
            <div class="fileButton">
                <sl-icon class="prefixIcon" name=${mime2icon(prettyFiletype(fileDescription.kind_info))}></sl-icon>
                ${fileDescription.name}
                <sl-button class="hide" size="small" variant="primary" style="margin-left:5px" @click=${async (e) => {
                    this.dispatchEvent(new CustomEvent('download', {detail: this.hash, bubbles: true, composed: true}));
                }}>
                    <sl-icon name="download"></sl-icon>
                </sl-button>
                <sl-button class="hide" size="small" variant="primary" @click=${async (e) => {
                        this.dispatchEvent(new CustomEvent('send', {detail: this.hash, bubbles: true, composed: true}));
                    }}>
                    <sl-icon name="send"></sl-icon>
                </sl-button>
                <tag-list class="hide" .hash=${this.hash} ${isPrivate? html`private` : html``}></tag-list>
            </div>
        `;
    }


    /** */
    static get styles() {
        return [
            sharedStyles,
            css`
              .fileButton {
                border-radius: 6px;
                border-width: 2px;
                border-style: dotted;
                font-size: 0.875rem;
                font-weight: bold;
                color: #2488e0;
                background: #FFFFFF;
                padding: 5px;
              }

              .prefixIcon {
                font-size: 1.275rem;
                margin-right: 2px;
                margin-bottom: -5px;
              }

              sl-icon {
                font-weight: bold;
              }
              
              .fileButton:hover {
                color: #09c8f3;
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

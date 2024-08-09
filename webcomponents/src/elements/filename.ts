import {css, html, LitElement} from "lit";
import {property, customElement} from "lit/decorators.js";
import {filesSharedStyles} from "../sharedStyles";

/**
 * @element
 */
@customElement("files-filename")
export class Filename extends LitElement {

    @property() filename: string = ''

    /** */
    override render() {
        const fields = this.filename.split('.');
        let fileExt = ""
        if (fields.length > 1) {
            fileExt = fields[fields.length - 1]!;
        }
        const fileBase = this.filename.slice(0, -(fileExt.length + 1))
          //<sl-tooltip content=${this.filename} distance="10">
        return html`
            <div class="filename">
                    <span class="filename__base">${fileBase}</span><span class="filename__extension">.${fileExt}</span>
            </div>            
        `;
    }

    /** */
    static override get styles() {
        return [
            filesSharedStyles,
            css`
              :host {
                overflow: auto;
              }
              
              .filename {
                display: flex;
                min-width: 0;
              }
                
              .filename__base {
                text-overflow: ellipsis;
                white-space: nowrap;
                overflow: hidden;
              }
                
                
              .filename__extension {
                flex-shrink: 0;
              }              
              
                sl-tooltip {
                    --show-delay: 1000;
                    
                }
            `,
        ];
    }
}

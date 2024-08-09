import {css, html, LitElement} from "lit";
import {property, customElement} from "lit/decorators.js";
import {filesSharedStyles} from "../sharedStyles";


/**
 * @element
 */
@customElement('tag-list')
export class TagList extends LitElement {

    /** */
    @property() tags: string[] = [];
    @property() selectable?: string;
    @property() deletable?: string;


    /** */
    async onTagDelete(tag: string) {
        this.dispatchEvent(new CustomEvent('deleted', {detail: tag, bubbles: true, composed: true}))
    }


    /** */
    override render() {
        //console.log("<tag-list>.render()", this.tags, this.selectable, this.deletable);
        const tagItems = this.tags.map((str) => {
            return html`
                <div class="tag ${this.selectable == ""? "selectable" : ""}" @click=${(_e:any) => {
                if (this.selectable == "") {
                    this.dispatchEvent(new CustomEvent('selected', {detail: str, bubbles: true, composed: true}))
                }
                }}>
                    <span>${str}</span>
                    ${this.deletable == ""
                        ? html`
                        <sl-icon-button class="hide" name="x" label="remove" style=""
                                   @click=${async (_e:any) => {this.onTagDelete(str)}}>
                        </sl-icon-button>`
                        : html``
                    }            
                </div>`
        });
        return html`${tagItems}`;
    }


    /** */
    static override get styles() {
        return [
            filesSharedStyles,
            css`
              :host {
                margin-top: 5px;
                display: flex;
                flex-direction: row;
                gap: 5px;
                flex-wrap: wrap;
              }

              .selectable:hover {
                background: #303131;
                color: white;
                cursor: pointer;
              }

              .selectable:hover .hide {
                display: inline-block;
              }
              
              sl-icon-button {
                font-size: 1.0rem;
                color: white;
              }

              sl-icon-button::part(base) {
                padding: 4px;
              }
            `,
        ];
    }
}

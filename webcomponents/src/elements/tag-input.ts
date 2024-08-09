import {css, html, LitElement} from "lit";
import {property, state, customElement} from "lit/decorators.js";
import {filesSharedStyles} from "../sharedStyles";
import {SlInput} from "@shoelace-style/shoelace";
import {msg} from "@lit/localize";


/**
 * @element
 */
@customElement('tag-input')
export class TagInput extends LitElement {


    @property() tags: string[] = [];

    @state() private _selectedTags: string[] = [];

    @state() private _canShowResults: boolean = true; // FIXME


    get inputElem() : SlInput {
        return this.shadowRoot!.getElementById("tag-input") as SlInput;
    }

    /** */
    onAddNewTag(_e: KeyboardEvent) {
        console.log("<tag-input> onAddNewTag", this.inputElem.value);
        if (this.inputElem.value.length <= 1) {
            return;
        }
        const string_copy = (' ' + this.inputElem.value).slice(1);
        //await this._dvm.taggingZvm.addPrivateTag(string_copy);
        this._selectedTags.push(string_copy);
        this.inputElem.value = "";
        this.dispatchEvent(new CustomEvent<string>('new-tag', {detail: string_copy, bubbles: true, composed: true}))
        this.requestUpdate();
        //if(this.tagListElem) this.tagListElem.requestUpdate();
    }


    /** */
    override render() {
        //console.log("<tag-input>.render()", this.tags, this._selectedTags);

        let tagResults = undefined;
        /** Search results */
        if (this.inputElem && this.inputElem.value) {
            const filter = this.inputElem.value;
            const filteredTags = this.tags
                //.filter((tag) => this._selectedTags.indexOf(tag) < 0)
                .filter((tag) => tag.includes(filter))
            if (filteredTags.length) {
                tagResults = html`
                    <tag-list .tags=${filteredTags} selectable
                              @selected=${(e:any) => {
                                  console.log("selected tag", e.detail);
                                  this._selectedTags.push(e.detail);
                                  this.inputElem.value = "";
                                  // this.dispatchEvent(new CustomEvent('selected', {
                                  //     detail: e.detail,
                                  //     bubbles: true,
                                  //     composed: true
                                  // }))
                                  this.requestUpdate();
                                  //if(this.tagListElem) this.tagListElem.requestUpdate();
                              }}
                              }>
                    </tag-list>
                `;
            }
        }

//     @sl-blur=${(e: SlBlurEvent) => {console.log("blur blur", e);this._canShowResults = false;}}
// @sl-focus=${(e:any) => {console.log("blur focus", e); this._canShowResults = true}}

        /** */
        return html`
            <sl-input id="tag-input" placeholder=${msg("Add tag")} clearable
                      @keydown=${(e: KeyboardEvent) => {
                          console.log("sl-keydown", this.inputElem.value, e);
                          if (e.keyCode == 13) {
                              this.onAddNewTag(e);
                          }
                          this.requestUpdate();
                      }}
            >
                <sl-icon name="plus" slot="prefix"></sl-icon>
            </sl-input>            
            <!-- Search result -->
            <div id="result-view" style="display:${tagResults && this._canShowResults? "flex" :"none"}">
                ${tagResults}
            </div>
        `;
    }

    /** */
    static override get styles() {
        return [
            filesSharedStyles,
            css`
              #result-view {
                /*position: absolute;*/
                /*top: 70px;*/
                /*left: 25%;*/
                padding: 15px;
                background: rgb(24, 24, 24);
                border-radius: 12px;
                box-shadow: rgba(0, 0, 0, 0.3) 0px 9px 18px, rgba(0, 0, 0, 0.22) 0px 7px 6px;
                display: flex;
                gap: 15px;
                max-width: 500px;
                flex-wrap: wrap;
              }

              sl-input::part(base) {
                background: rgba(7, 21, 34, 0.93);
                border: none;
              }

              sl-input::part(input) {
                color: white;                
              }

              sl-input::part(base):focus {
                border: 2px white solid;
              }
            `
        ];
    }
}

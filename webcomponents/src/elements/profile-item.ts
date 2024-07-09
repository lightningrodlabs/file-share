import {css, html, LitElement, PropertyValues} from "lit";
import {property, state, customElement} from "lit/decorators.js";
import {filesSharedStyles} from "../sharedStyles";
import {
    getInitials,
    ProfilesAltPerspective,
    ProfilesAltZvm
} from "@ddd-qc/profiles-dvm";
import {AgentId, ZomeElement} from "@ddd-qc/lit-happ";


/**
 * @element
 */
@customElement('profile-item')
export class ProfileItem extends ZomeElement<ProfilesAltPerspective, ProfilesAltZvm> {

    /** */
    constructor() {
        super(ProfilesAltZvm.DEFAULT_ZOME_NAME)
    }

    @property() key!: AgentId;

    @property() selectable?: string;
    @property() clearable?: string;


    /** */
    render() {
        console.log("<profile-item>.render()", this.clearable);

        const profile = this._zvm.getProfile(this.key);

        if (!this.key || !profile) {
            return html`<sl-spinner></sl-spinner>`;
        }

        // <sl-badge class="avatar-badge" type="${this.determineAgentStatus(keyB64)}" pill></sl-badge>

        let clearButton = html``;
        if (this.clearable == "") {
            clearButton = html`
                <sl-icon-button class="hide" 
                                name="x" label="Clear"
                                @click=${(e) => {this.dispatchEvent(new CustomEvent<AgentId>('cleared', {detail: this.key, bubbles: true, composed: true}));}}
                ></sl-icon-button>
            `;
            // clearButton = html`
            //     <sl-button variant="default" size="small" circle>
            //         <sl-icon name="x-lg" label="Clear"></sl-icon>
            //     </sl-button>
            // `;
        }



        /** render all */
        return html`
            <div id="item" class="${this.selectable == ""? "selectable" : ""}" @click=${(e) => {
                if (this.selectable == "") {
                    this.dispatchEvent(new CustomEvent<AgentId>('selected', {detail: this.key, bubbles: true, composed: true}))
                }
            }}>
                <sl-avatar id=${this.key.b64} initials=${getInitials(profile.nickname)} .image=${profile && profile.fields.avatar? profile.fields.avatar : ""}></sl-avatar>
                <span id="nickname">${profile.nickname}</span>
                ${clearButton}
            </div>
        `;
    }


    /** */
    static get styles() {
        return [
            filesSharedStyles,
            css`
              #item {
                display: flex;
                flex-direction: row;
                gap: 5px;
              }
              .selectable:hover {
                background: #11101082;
                cursor:pointer;
              }
              
              #item:hover .hide {
                display: inline-block;
              }
              
              sl-avatar {
                --size: 28px;
              }

              #nickname {
                margin-left: 6px;
                font-size: 18px;
              }
                            
              sl-icon-button {
                font-size: 1.25rem;
              }

              sl-icon-button::part(base) {
                padding: 1px 0px 0px 0px;
                margin-left: 10px;
                background: rgba(121, 115, 115, 0.1);
              }

              sl-button::part(base) {
                margin-left: 10px;
                background: red;
              }

            `,
    ]};


}

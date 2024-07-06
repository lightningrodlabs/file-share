import {css, html, LitElement, PropertyValues} from "lit";
import {property, state, customElement} from "lit/decorators.js";
import {filesSharedStyles} from "../sharedStyles";
import {SlInput} from "@shoelace-style/shoelace";
import {AgentId, ZomeElement} from "@ddd-qc/lit-happ";
import {ProfilesAltPerspective, ProfilesAltZvm, Profile} from "@ddd-qc/profiles-dvm";


/**
 * @element
 */
@customElement('profile-input')
export class ProfileInput extends ZomeElement<ProfilesAltPerspective, ProfilesAltZvm> {

    /** */
    constructor() {
        super(ProfilesAltZvm.DEFAULT_ZOME_NAME)
    }

    @state() private _selectedAgents: AgentId[] = [];

    @state() private _canShowResults: boolean = true;  // FIXME

    get inputElem() : SlInput {
        return this.shadowRoot.getElementById("tag-input") as SlInput;
    }

    /** */
    onAddAgent(key: AgentId) {
        console.log("<profile-input> onAddAgent", key);
        this._selectedAgents.push(key);
        this.inputElem.value = "";
        this.requestUpdate();
    }


    /** */
    render() {
        console.log("<profile-input>.render()", this._selectedAgents);

        const profiles = Array.from(this.perspective.profileByAgent.entries());

        const agentItems = this._selectedAgents
            .map((key) => {
                const profile = this._zvm.getProfile(key);
                if (!profile) return html``;
                //return html`<div>${profile.nickname}</div>`;
                return html`<profile-item .key=${key} clearable @cleared=${(e) => {
                    const index = this._selectedAgents.indexOf(e.detail);
                    console.log("<profile-input> clear", e.detail, index);
                    if (index > -1) {
                        this._selectedAgents.splice(index, 1);
                    }
                    this.requestUpdate();
                }}></profile-item>`;

            });

        /** agentResults */
        let agentResults = undefined;
        if (this.inputElem && this.inputElem.value) {
            const filter = this.inputElem.value.toLowerCase();
            const profilePairs: [AgentId, Profile][] = profiles
                .filter(([key, _profile]) => key.b64 != this._zvm.cell.agentId.b64) // exclude self
                .filter(([key, _profile]) => this._selectedAgents.indexOf(key) < 0) // Don't show already selected agents
                .map(([key, profileId]) => [key, this.perspective.profiles.get(profileId)[0]]);
            agentResults = profilePairs
                .filter(([_key, profile]) => profile.nickname.toLowerCase().includes(filter)) // Must match filter
                .map(([key, profile]) => {
                    console.log("<profile-input> map", key, profile);
                    return html`<profile-item class="selectable-profile" .key=${key} selectable @selected=${(_e) => {this.onAddAgent(key);}}></profile-item>`;
                });
        }

        console.log("agentResults", agentResults);

//    @sl-blur=${(e) => {this._canShowResults = false}}
//@sl-focus=${(e) => {this._canShowResults = true}}

        /** */
        return html`
            <sl-input id="tag-input" placeholder="Add Recipients" clearable
                      @keydown=${(e: KeyboardEvent) => {this.requestUpdate();}}
            >
                <sl-icon name="person-plus" slot="prefix"></sl-icon>
            </sl-input>
            <div id="agent-list">
                ${agentItems}
            </div>
            <!-- Search result -->
            <div id="result-view" style="display:${agentResults && agentResults.length > 0 && this._canShowResults? "flex" :"none"}">
                ${agentResults}
            </div>
        `;
    }


    /** */
    static get styles() {
        return [
            filesSharedStyles,
            css`

              .selectable-profile {
                /*background: red;  */
              }

              #agent-list {
                display: flex;
                flex-direction: column;
                padding-top: 10px;
                gap: 5px;
              }

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

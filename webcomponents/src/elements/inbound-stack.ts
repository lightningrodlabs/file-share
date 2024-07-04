import {css, html, PropertyValues} from "lit";
import {property, state, customElement} from "lit/decorators.js";
import {AgentIdMap, ZomeElement, AgentId, ActionId, EntryId, ActionIdMap} from "@ddd-qc/lit-happ";
import {DeliveryPerspective, DeliveryZvm} from "@ddd-qc/delivery";
import {filesSharedStyles} from "../sharedStyles";
import {kind2Icon} from "../fileTypeUtils";
import {getCompletionPct} from "../utils";
import {Profile as ProfileMat} from "@ddd-qc/profiles-dvm/dist/bindings/profiles.types";


/**
 * @element
 */
@customElement("inbound-stack")
export class InboundStack extends ZomeElement<DeliveryPerspective, DeliveryZvm> {

    /** */
    constructor() {
        super(DeliveryZvm.DEFAULT_ZOME_NAME)
    }

    @property() profiles: AgentIdMap<ProfileMat> = new AgentIdMap();

    /** distribAh -> bool */
    @state() private _canDisplay: ActionIdMap<boolean> = new ActionIdMap();

    /** */
    render() {
        const windowInnerWidth  = document.documentElement.clientWidth; // window.innerWidth;
        console.log("<inbound-stack>.render()", windowInnerWidth);

        const incompletes = Array.from(this._zvm.inbounds()[1].values())
            .filter((tuple) => tuple[2].size >= 0);

        const items = incompletes
            .map(([notice, _ts, missingChunks]) => {
                const maybeProfile = this.profiles.get(new AgentId(notice.sender));
                const senderName = maybeProfile? maybeProfile.nickname : "unknown";
                const distribAh = new ActionId(notice.distribution_ah);
                if (this._canDisplay.get(distribAh) == undefined) {
                    this._canDisplay.set(distribAh, true);
                }
                const canDisplay = missingChunks.size > 0 && this._canDisplay.get(distribAh);
                if (!canDisplay) {
                    return html``;
                }
                let pct = getCompletionPct(this._zvm, notice, missingChunks);
                return html`
                    <div class="fab-inbound">
                        <div style="display:flex; flex-direction:row; gap:35px;">
                            <sl-progress-bar style="flex-grow:1;" .value=${pct}>${pct}%</sl-progress-bar>
                            <sl-icon-button name="x" label="close"
                                            @click=${async (_e) => {this._canDisplay.set(distribAh, false); this.requestUpdate()}}>
                            </sl-icon-button>
                        </div>
                        <div style="display:flex; flex-direction:row; gap:5px;">
                            <span class="nickname">${senderName}</span>                            
                            <sl-icon name="arrow-right"></sl-icon>
                            <sl-icon class="prefixIcon" name=${kind2Icon(notice.summary.parcel_reference.description.kind_info)}></sl-icon>
                            <files-filename style="font-weight: bold; max-width: 175px; width:inherit; margin-right:3px;" filename=${notice.summary.parcel_reference.description.name}></files-filename>
                        </div>
                    </div>
                `;
            });


        /** render all */
        return html`
            <div id="inbound-stack">
                ${items}
            </div>
        `;
    }

    /** */
    static get styles() {
        return [
            filesSharedStyles,
            css`
            :host {
            }

            sl-icon-button::part(base) {
              padding: 0px;
              background: #e6e6e6; 
            }
              
            #inbound-stack {
              display: flex;
              flex-direction: row-reverse;
            }
            .fab-inbound {
              display: flex;
              flex-direction: column;
              gap: 8px;
              padding: 8px 8px 7px 10px;
              width: 250px;
              border-radius: 6px;
              background: #ffffff;
              box-shadow: rgba(0, 0, 0, 0.3) 0px 19px 38px, rgba(0, 0, 0, 0.22) 0px 15px 12px;
            }              
            `,
        ];
    }
}

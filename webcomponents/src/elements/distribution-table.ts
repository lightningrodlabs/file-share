import {html, LitElement} from "lit";
import {property, customElement} from "lit/decorators.js";
import {prettyFileSize, prettyTimestamp} from "../utils";
import {columnBodyRenderer, columnFooterRenderer} from "@vaadin/grid/lit";
import {EntryId} from "@ddd-qc/lit-happ";
import {DeliveryState, ParcelDescription} from "@ddd-qc/delivery/dist/bindings/delivery.types";
import {filesSharedStyles} from "../sharedStyles";
import {kind2Type} from "../fileTypeUtils";
import {Profile as ProfileMat} from "@ddd-qc/profiles-dvm";
import {msg} from "@lit/localize";
import {ActionHashB64, EntryHashB64} from "@holochain/client";


/** Don't use HolochainId directly as the vaadin will try to autoconvert to string for default rendering */
export interface DistributionTableItem {
    distribAh: ActionHashB64,
    recipient: ProfileMat,
    deliveryState: DeliveryState,
    parcelEh: EntryHashB64,
    description: ParcelDescription,
    sentTs: number,
    receptionTs: number,
}


/**
 * @element
 */
@customElement("distribution-table")
export class DistributionTable extends LitElement {

    /** -- State variables -- */

    @property() items: DistributionTableItem[] = [];

    /** */
    override render() {
        console.log("<distribution-table>.render()", this.items);
        // if (!this.items.length) {
        //     return html`No items found`;
        // }

        const totalSize = this.items.reduce((accumulator, item) => accumulator + item.description.size, 0);

        /** render all */
        //return html``;
        return html`
            <vaadin-grid .items=${this.items}>
                <vaadin-grid-selection-column></vaadin-grid-selection-column>
                <!-- <vaadin-grid-column path="deliveryState" header=
                                    ${columnBodyRenderer<DistributionTableItem>(
                                            ({ deliveryState }) => html`<span>${deliveryState}</span>`,
                                            [],
                                    )}>
                </vaadin-grid-column> -->
                <vaadin-grid-column path="description" header=${msg("Filename")}
                                    ${columnBodyRenderer<DistributionTableItem>(
                                            ({ description }) => html`<span>${description.name}</span>`,
                                            [],
                                    )}>
                </vaadin-grid-column>
                <vaadin-grid-column path="description" header=${msg("Size")}
                                    ${columnBodyRenderer<DistributionTableItem>(
                                ({ description }) => html`<span>${prettyFileSize(description.size)}</span>`,
                            [],
                                    )}
                                    ${columnFooterRenderer(() => html`<span>${prettyFileSize(totalSize)} ${msg("total")}</span>`, [totalSize])}
                ></vaadin-grid-column>
                <vaadin-grid-column path="description" header=${msg("Type")}
                                    ${columnBodyRenderer<DistributionTableItem>(
                                            ({ description }) => html`<span>${kind2Type(description.kind_info)}</span>`,
                                            [],
                                    )}
                ></vaadin-grid-column>
                <vaadin-grid-column path="recipient" header=${msg("Recipient")}
                                    ${columnBodyRenderer<DistributionTableItem>(
                                            ({ recipient }) => {
                                                return recipient
                                                        ? html`<span>${recipient.nickname}</span>`
                                                        : html`<span>Unknown</span>`
                                            },
                                    [],
                                    )}
                ></vaadin-grid-column>
                <vaadin-grid-column path="sentTs" header=${msg("Sent Date")}
                                    ${columnBodyRenderer<DistributionTableItem>(
                                            ({ sentTs }) => html`<span>${prettyTimestamp(sentTs)}</span>`,
                                            [],
                                    )}
                ></vaadin-grid-column>
                <vaadin-grid-column path="receptionTs" header=${msg("Received Date")}
                                    ${columnBodyRenderer<DistributionTableItem>(
                                            ({ receptionTs }) => html`<span>${prettyTimestamp(receptionTs)}</span>`,
                                            [],
                                    )}
                ></vaadin-grid-column>
                <vaadin-grid-column
                        path="parcelEh" header="" width="120px"
                        ${columnBodyRenderer<DistributionTableItem>(
                                ({parcelEh}) => {
                                    return html`
                                        <sl-button size="small" variant="primary" style="margin-left:5px" @click=${async (_e: any) => {
                                            this.dispatchEvent(new CustomEvent<EntryId>('download', {detail: new EntryId(parcelEh), bubbles: true, composed: true}));
                                        }}>
                                            <sl-icon name="download"></sl-icon>
                                        </sl-button>
                                        <sl-button size="small" variant="primary" @click=${async (_e: any) => {
                                            this.dispatchEvent(new CustomEvent<EntryId>('send', {detail: new EntryId(parcelEh), bubbles: true, composed: true}));
                                        }}>
                                            <sl-icon name="send"></sl-icon>
                                        </sl-button>
                                        <sl-button size="small" variant="neutral"
                                                   @click=${async (_e: any) => {
                                                       this.dispatchEvent(new CustomEvent<EntryId>('view', {
                                                           detail: new EntryId(parcelEh),
                                                           bubbles: true,
                                                           composed: true
                                                       }));
                                                   }}>
                                            <sl-icon name="info-lg"></sl-icon>
                                        </sl-button>
                                    `
                                },
                                []
                        )}
                        ${columnFooterRenderer(() => html`<span>${this.items.length} ${msg("files")}</span>`, [this.items])}
                ></vaadin-grid-column>
            </vaadin-grid>
        `;
    }


    /** */
    static override get styles() {
        return [
            filesSharedStyles,
        ];
    }
}

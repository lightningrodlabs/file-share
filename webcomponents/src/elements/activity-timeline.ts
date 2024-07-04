import {css, html, PropertyValues, TemplateResult} from "lit";
import {property, state, customElement} from "lit/decorators.js";
import {delay, DnaElement, ActionId, EntryId, AgentId} from "@ddd-qc/lit-happ";
import {msg} from '@lit/localize';
import {FilesDvm} from "../viewModels/files.dvm";
import {
    DeliveryPerspective,
} from "@ddd-qc/delivery";
import {EntryHashB64, Timestamp} from "@holochain/client";
import {FileView} from "./file-view";
import {filesSharedStyles} from "../sharedStyles";
import {agent2avatar} from "@ddd-qc/profiles-dvm";
import {FilesDvmPerspective} from "../viewModels/files.perspective";


/** */
export enum ActivityLogType {
    DeliveryReceived = 'DeliveryReceived',
    DeliveryDeclined = 'DeliveryDeclined',
    NewPersonalFile = 'NewPersonalFile',
    ReceivedFile = 'ReceivedFile',
    NewGroupFile = 'NewGroupFile',
    RemovedGroupFile = 'RemovedGroupFile',
}

export type ActivityLogTypeVariantDeliveryReceived = {distributionAh: ActionId, peer: AgentId}
export type ActivityLogTypeVariantDeliveryDeclined = {distributionAh: ActionId, peer: AgentId}
export type ActivityLogTypeVariantNewPersonalFile = {manifestEh: EntryId, peer: AgentId}
export type ActivityLogTypeVariantNewGroupFile = {manifestEh: EntryId, peer: AgentId}
export type ActivityLogTypeVariantRemovedGroupFile = {manifestEh: EntryId, peer: AgentId}
export type ActivityLogTypeVariantReceivedFile = {manifestEh: EntryId, peer: AgentId}

export type ActivityLogVariant =
    | ActivityLogTypeVariantDeliveryReceived
    | ActivityLogTypeVariantDeliveryDeclined
    | ActivityLogTypeVariantNewPersonalFile
    | ActivityLogTypeVariantReceivedFile
    | ActivityLogTypeVariantNewGroupFile
    | ActivityLogTypeVariantRemovedGroupFile

export type ActivityLog = {timestamp: Timestamp, type: ActivityLogType, value: ActivityLogVariant}


/**
 * @element
 */
@customElement("activity-timeline")
export class ActivityTimeline extends DnaElement<FilesDvmPerspective, FilesDvm> {

    @state() private _initialized = false;

    /** Observed perspective from zvm */
    @property({type: Object, attribute: false, hasChanged: (_v, _old) => true})
    deliveryPerspective!: DeliveryPerspective;


    /** */
    get fileViewElem() : FileView {
        return this.shadowRoot.getElementById("file-view") as FileView;
    }


    /**
     * In dvmUpdated() this._dvm is not already set!
     * Subscribe to ZVMs
     */
    protected async dvmUpdated(newDvm: FilesDvm, oldDvm?: FilesDvm): Promise<void> {
        console.log("<activity-timeline>.dvmUpdated()");
        if (oldDvm) {
            //console.log("\t Unsubscribed to Zvms roleName = ", oldDvm.fileShareZvm.cell.name)
            oldDvm.deliveryZvm.unsubscribe(this);
        }
        newDvm.deliveryZvm.subscribe(this, 'deliveryPerspective');
        //console.log("\t Subscribed Zvms roleName = ", newDvm.fileShareZvm.cell.name)
        this._initialized = true;
    }


    /** */
    determineActivityHistory(): ActivityLog[] {

        /** Remove Received files from private files */
        const receivedManifestEhs: EntryHashB64[] = Array.from(this.deliveryPerspective.receptions.values())
            .map(([rp,_ts]) => new EntryId(this.deliveryPerspective.notices.get(new EntryId(rp.notice_eh))[0].summary.parcel_reference.parcel_eh).b64);


        const ReceivedFiles: ActivityLog[] = Array.from(this.deliveryPerspective.receptions.entries())
            .map(([noticeEh, [rp, timestamp]]) => {
                const notice = this.deliveryPerspective.notices.get(noticeEh)[0];
                return {
                        timestamp,
                        type: ActivityLogType.ReceivedFile,
                        value: {manifestEh: new EntryId(rp.parcel_eh), peer: new AgentId(notice.sender)} as ActivityLogTypeVariantReceivedFile,
                    } as ActivityLog;
            })
        //console.log("sortedReceptions", sortedReceptions);

        const declinedDeliveries: ActivityLog[] = Array.from(this.deliveryPerspective.replyAcks.entries())
            .map(([distributionAh, acks]) => {
                const res: ActivityLog[] =  Array.from(acks.entries())
                    .filter(([_peer, [ack, _ts]]) => !ack.has_accepted)
                    .map(([peer, [_ack, timestamp]]) => {
                        return {
                            timestamp,
                            type: ActivityLogType.DeliveryDeclined,
                            value: {distributionAh, peer} as ActivityLogTypeVariantDeliveryDeclined,
                        } as ActivityLog;
                    });
                return res;
            }).flat();

        const receivedDeliveries: ActivityLog[] = Array.from(this.deliveryPerspective.receptionAcks.entries())
            .map(([distributionAh, acks]) => {
                const res: ActivityLog[] =  Array.from(acks.entries())
                    .map(([peer, [_ack, timestamp]]) => {
                        return {timestamp, type: ActivityLogType.DeliveryReceived, value: {distributionAh, peer}};
                    });
                return res;
            }).flat();

        //console.log("sortedReceptionAcks", sortedReceptionAcks);

        const newPersonalFiles: ActivityLog[] = Array.from(this.deliveryPerspective.privateManifests.entries())
            .filter(([eh, [_rp, _ts]]) => !receivedManifestEhs.includes(eh.b64))
            .map(([eh, [rp, timestamp]]) => {
                return {timestamp, type: ActivityLogType.NewPersonalFile, value: {manifestEh: eh} as ActivityLogTypeVariantNewPersonalFile};
            });
        //console.log("sortedPrivateParcels", sortedPrivateParcels);

        const addGroupFiles: ActivityLog[] = Array.from(this.deliveryPerspective.publicParcels.entries())
            .map(([eh, pprm]) => {
                return {timestamp: pprm.creationTs, type: ActivityLogType.NewGroupFile, value: {manifestEh: eh, peer: pprm.author}}
            });
        const removeGroupFiles: ActivityLog[] = Array.from(this.deliveryPerspective.publicParcels.entries())
          .filter(([_ppEh, pprm]) => pprm.deleteInfo)
          .map(([eh, pprm]) => {
              return {timestamp: pprm.deleteInfo[0] , type: ActivityLogType.RemovedGroupFile, value: {manifestEh: eh, peer: pprm.deleteInfo[1]}};
          });
        //console.log("sortedPublicParcels", sortedPublicParcels);


        /** Concat all */
        const all = ReceivedFiles.concat(receivedDeliveries, declinedDeliveries, newPersonalFiles, addGroupFiles, removeGroupFiles)
            .sort((logA, logB) => logB.timestamp - logA.timestamp);

        //console.table(all);
        return all;
    }



    /** */
    activityLog2Html(log: ActivityLog): TemplateResult<1> {

        /** Format date */
        const date = new Date(log.timestamp / 1000); // Holochain timestamp is in micro-seconds, Date wants milliseconds
        const date_str = date.toLocaleString('en-US', {hour12: false});

        /**  */
        let message: string;
        let manifestEh: EntryId;
        let peer: AgentId;
        switch (log.type) {
            case ActivityLogType.DeliveryDeclined: {
                const variant = log.value as ActivityLogTypeVariantDeliveryDeclined;
                manifestEh = new EntryId(this.deliveryPerspective.distributions.get(variant.distributionAh)[0].delivery_summary.parcel_reference.parcel_eh);
                message = msg(`was declined by`);
                peer = variant.peer;
                break;}
            case ActivityLogType.DeliveryReceived: {
                const variant = log.value as ActivityLogTypeVariantDeliveryReceived;
                manifestEh = new EntryId(this.deliveryPerspective.distributions.get(variant.distributionAh)[0].delivery_summary.parcel_reference.parcel_eh);
                message = msg(`was received by`);
                peer = variant.peer;
                break;}
            case ActivityLogType.ReceivedFile: {
                const variant = log.value as ActivityLogTypeVariantReceivedFile;
                manifestEh = variant.manifestEh;
                message = msg(`was sent to you by`);
                peer = variant.peer;
                break;}
            case ActivityLogType.NewGroupFile: {
                const variant = log.value as ActivityLogTypeVariantNewGroupFile;
                manifestEh = variant.manifestEh;
                message = msg(`has been published by`);
                peer = variant.peer;
                break;}
            case ActivityLogType.RemovedGroupFile: {
                const variant = log.value as ActivityLogTypeVariantRemovedGroupFile;
                manifestEh = variant.manifestEh;
                message = msg(`has been unpublished by`);
                peer = variant.peer;
                break;}
            case ActivityLogType.NewPersonalFile: {
                const variant = log.value as ActivityLogTypeVariantNewPersonalFile;
                manifestEh = variant.manifestEh;
                peer = this.cell.agentId;
                message = msg(`was added privately by`);
                break;}
        }

        //const manifest = this.deliveryPerspective.lo
        // if (!manifest) {
        //     return html`<sl-skeleton effect="sheen"></sl-skeleton>`
        // }
        //const id = "activity-item__" + manifestEh;

        const [profile, _avatar] = agent2avatar(peer, this._dvm.profilesZvm.perspective);
        const authorSpan = peer.b64 == this.cell.agentId.b64
            ? html`<span style="font-weight: bold;">${msg("yourself")}</span>`
            : html`<span class="nickname">${profile.nickname}</span>`;

        /** render */
        return html`
        <div class="activityItem">
            <div class="activityDate"> ${date_str}</div>            
            <div class="activityLine">
                <file-button .hash=${manifestEh} .author=${peer}></file-button>
                <div class="activityMsg">
                    ${message}
                    ${authorSpan}
                </div>
            </div>
        </div>
    `;
    }


    /** */
    render() {
        console.log("<activity-timeline>.render()", this._initialized);

        if (!this._initialized) {
            return html`
                <sl-skeleton effect="sheen"></sl-skeleton>
                <sl-skeleton effect="sheen"></sl-skeleton>
                <sl-skeleton effect="sheen"></sl-skeleton>
            `;
        }

        let history = this.determineActivityHistory();
        if (history.length > 30) {
            history = history.slice(0, 30);
        }

        const items = history.map(
            (activityLog) => {
                //console.log("activityLog", activityLog);
                return this.activityLog2Html(activityLog);
            }
        )
        if (items.length == 0) {
            items.push(html`${msg("None")}`);
        }


        /** Render all */
        return html`${items}`;
    }


    /** */
    static get styles() {
        return [
            filesSharedStyles,
            css`
              .activityItem {
                display: flex;
                flex-direction: row-reverse;
                align-content: center;
                align-items: center;
                margin-bottom: 10px;
              }

              .activityLine {
                display: flex;
                flex-direction: row;
                min-height: 45px;
                align-content: center;
                align-items: center;
                flex-grow: 2;
              }

              .activityAvatar {
                margin-right: 5px;
                min-width: 48px;
              }

              .activityDate {
                margin: 0px 0px 0px 5px;
                font-size: small;
                color: gray;
              }
              .activityMsg {
                margin: 5px 5px 5px 5px;
              }
            `,];
    }

}

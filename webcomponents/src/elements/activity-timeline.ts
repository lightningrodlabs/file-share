import {css, html, PropertyValues, TemplateResult} from "lit";
import {property, state, customElement} from "lit/decorators.js";
import {delay, DnaElement} from "@ddd-qc/lit-happ";
import {consume} from "@lit-labs/context";
import {FileShareDvm} from "../viewModels/fileShare.dvm";
import {FileShareProfile} from "../viewModels/profiles.proxy";
import {ProfilesZvm} from "../viewModels/profiles.zvm";
import {
    DeliveryEntryType,
    DeliveryPerspective,
} from "@ddd-qc/delivery";
import {globalProfilesContext} from "../viewModels/happDef";
import {ActionHashB64, AgentPubKeyB64, encodeHashToBase64, EntryHashB64, Timestamp} from "@holochain/client";
import {agent2avatar, getInitials} from "../utils";
import {FileView} from "./file-view";
import {sharedStyles} from "../sharedStyles";


/** */
export enum ActivityLogType {
    DeliveryReceived = 'DeliveryReceived',
    DeliveryDeclined = 'DeliveryDeclined',
    NewPersonalFile = 'NewPersonalFile',
    ReceivedFile = 'ReceivedFile',
    NewGroupFile = 'NewGroupFile',
}

export type ActivityLogTypeVariantDeliveryReceived = {distributionAh: ActionHashB64, peer: AgentPubKeyB64}
export type ActivityLogTypeVariantDeliveryDeclined = {distributionAh: ActionHashB64, peer: AgentPubKeyB64}
export type ActivityLogTypeVariantNewPersonalFile = {manifestEh: EntryHashB64, peer: AgentPubKeyB64}
export type ActivityLogTypeVariantNewGroupFile = {manifestEh: EntryHashB64, peer: AgentPubKeyB64}
export type ActivityLogTypeVariantReceivedFile = {manifestEh: EntryHashB64, peer: AgentPubKeyB64}

export type ActivityLogVariant =
    | ActivityLogTypeVariantDeliveryReceived
    | ActivityLogTypeVariantDeliveryDeclined
    | ActivityLogTypeVariantNewPersonalFile
    | ActivityLogTypeVariantReceivedFile
    | ActivityLogTypeVariantNewGroupFile

export type ActivityLog = {timestamp: Timestamp, type: ActivityLogType, value: ActivityLogVariant}


/**
 * @element
 */
@customElement("activity-timeline")
export class ActivityTimeline extends DnaElement<unknown, FileShareDvm> {

    @state() private _initialized = false;

    /** Observed perspective from zvm */
    @property({type: Object, attribute: false, hasChanged: (_v, _old) => true})
    deliveryPerspective!: DeliveryPerspective;

    @consume({ context: globalProfilesContext, subscribe: true })
    _profilesZvm!: ProfilesZvm;



    /** */
    get fileViewElem() : FileView {
        return this.shadowRoot.getElementById("file-view") as FileView;
    }


    /**
     * In dvmUpdated() this._dvm is not already set!
     * Subscribe to ZVMs
     */
    protected async dvmUpdated(newDvm: FileShareDvm, oldDvm?: FileShareDvm): Promise<void> {
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
        const receivedManifestEhs: EntryHashB64[] = Object.values(this.deliveryPerspective.receptions)
            .map(([rp,_ts]) => encodeHashToBase64(this.deliveryPerspective.notices[encodeHashToBase64(rp.notice_eh)][0].summary.parcel_reference.eh));


        const ReceivedFiles: ActivityLog[] = Object.entries(this.deliveryPerspective.receptions)
            .map(([noticeEh, [rp, timestamp]]) => {
                const notice = this.deliveryPerspective.notices[noticeEh][0];
                return {
                        timestamp,
                        type: ActivityLogType.ReceivedFile,
                        value: {manifestEh: encodeHashToBase64(rp.parcel_eh), peer: encodeHashToBase64(notice.sender)} as ActivityLogTypeVariantReceivedFile,
                    } as ActivityLog;
            })
        //console.log("sortedReceptions", sortedReceptions);

        const declinedDeliveries: ActivityLog[] = Object.entries(this.deliveryPerspective.replyAcks)
            .map(([distributionAh, acks]) => {
                const res: ActivityLog[] =  Object.entries(acks)
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

        const receivedDeliveries: ActivityLog[] = Object.entries(this.deliveryPerspective.receptionAcks)
            .map(([distributionAh, acks]) => {
                const res: ActivityLog[] =  Object.entries(acks)
                    .map(([peer, [_ack, timestamp]]) => {
                        return {timestamp, type: ActivityLogType.DeliveryReceived, value: {distributionAh, peer}};
                    });
                return res;
            }).flat();

        //console.log("sortedReceptionAcks", sortedReceptionAcks);

        const newPersonalFiles: ActivityLog[] = Object.entries(this.deliveryPerspective.privateManifests)
            .filter(([eh, [_rp, _ts]]) => !receivedManifestEhs.includes(eh))
            .map(([eh, [rp, timestamp]]) => {
                return {timestamp, type: ActivityLogType.NewPersonalFile, value: {manifestEh: eh} as ActivityLogTypeVariantNewPersonalFile};
            });
        //console.log("sortedPrivateParcels", sortedPrivateParcels);

        const newGroupFiles: ActivityLog[] = Object.entries(this.deliveryPerspective.publicParcels)
            .map(([eh, [rp, timestamp, auth]]) => {
                return {timestamp, type: ActivityLogType.NewGroupFile, value: {manifestEh: eh, peer: auth}};
            });
        //console.log("sortedPublicParcels", sortedPublicParcels);

        /** Concat all */
        const all = ReceivedFiles.concat(receivedDeliveries, declinedDeliveries, newPersonalFiles, newGroupFiles)
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
        let manifestEh: EntryHashB64;
        let peer: AgentPubKeyB64;
        switch (log.type) {
            case ActivityLogType.DeliveryDeclined: {
                const variant = log.value as ActivityLogTypeVariantDeliveryDeclined;
                manifestEh = encodeHashToBase64(this.deliveryPerspective.distributions[variant.distributionAh][0].delivery_summary.parcel_reference.eh);
                message = `was declined by`;
                peer = variant.peer;
                break;}
            case ActivityLogType.DeliveryReceived: {
                const variant = log.value as ActivityLogTypeVariantDeliveryReceived;
                manifestEh = encodeHashToBase64(this.deliveryPerspective.distributions[variant.distributionAh][0].delivery_summary.parcel_reference.eh);
                message = `was received by`;
                peer = variant.peer;
                break;}
            case ActivityLogType.ReceivedFile: {
                const variant = log.value as ActivityLogTypeVariantReceivedFile;
                manifestEh = variant.manifestEh;
                message = `was sent to you by`;
                peer = variant.peer;
                break;}
            case ActivityLogType.NewGroupFile: {
                const variant = log.value as ActivityLogTypeVariantNewGroupFile;
                manifestEh = variant.manifestEh;
                message = `has been shared by`;
                peer = variant.peer;
                break;}
            case ActivityLogType.NewPersonalFile: {
                const variant = log.value as ActivityLogTypeVariantNewPersonalFile;
                manifestEh = variant.manifestEh;
                peer = this.cell.agentPubKey;
                message = `was added privately by`;
                break;}
        }

        //const manifest = this.deliveryPerspective.lo
        // if (!manifest) {
        //     return html`<sl-skeleton effect="sheen"></sl-skeleton>`
        // }
        //const id = "activity-item__" + manifestEh;

        const [profile, _avatar] = agent2avatar(peer, this._profilesZvm.perspective);
        const authorSpan = peer == this.cell.agentPubKey
            ? html`<span style="font-weight: bold;">yourself</span>`
            : html`<span class="nickname">${profile.nickname}</span>`;

        /** render */
        return html`
        <div class="activityItem">
            <div class="activityDate"> ${date_str}</div>            
            <div class="activityLine">
                <file-button .hash="${manifestEh}"></file-button>
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

        const history = this.determineActivityHistory();


        const items = history.map(
            (activityLog) => {
                //console.log("activityLog", activityLog);
                return this.activityLog2Html(activityLog);
            }
        )
        if (items.length == 0) {
            items.push(html`None`);
        }


        /** Render all */
        return html`${items}`;
    }


    /** */
    static get styles() {
        return [
            sharedStyles,
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

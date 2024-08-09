import {css, html, TemplateResult} from "lit";
import {customElement, property, state} from "lit/decorators.js";
import {AgentId, DnaElement, EntryId, HAPP_ENV, HappEnvType} from "@ddd-qc/lit-happ";
import {Timestamp} from "@holochain/client";
import {GroupProfile, FrameNotification, WeaveServices} from "@lightningrodlabs/we-applet";
import {consume} from "@lit/context";
import {createContext} from "@lit/context";


import {
    FilesDvm,
    FilesMenu,
    SelectedEvent,
    SelectedType,
    prettyFileSize,
    prettyTimestamp,
    SplitObject,
    createAlert,
    FileType,
    ActionOverlay,
    StoreDialog,
    SendDialog,
    countFileTypes,
    type2Icon,
    FileTableItem,
    kind2Type,
    DistributionTableItem,
    filesSharedStyles,
    kind2Icon,
    ProfileInfo,
    FilesNotificationVariantPublicSharingRemoved,
} from "@ddd-qc/files";
import {DeliveryPerspective, DeliveryState, Distribution} from "@ddd-qc/delivery";
import {
    FilesDvmPerspective,
    FilesNotification,
    FilesNotificationType,
    FilesNotificationVariantDeliveryRequestSent,
    FilesNotificationVariantDistributionToRecipientComplete,
    FilesNotificationVariantNewNoticeReceived,
    FilesNotificationVariantPrivateCommitComplete,
    FilesNotificationVariantPublicSharingComplete,
    FilesNotificationVariantReceptionComplete,
    FilesNotificationVariantReplyReceived
} from "@ddd-qc/files";

import {DistributionState} from "@ddd-qc/delivery/dist/bindings/delivery.types";
import {columnBodyRenderer} from "@vaadin/grid/lit";
import {Profile as ProfileMat} from "@ddd-qc/profiles-dvm";

import {SlAlert, SlButton, SlDialog, SlInput} from "@shoelace-style/shoelace";

import "@shoelace-style/shoelace/dist/components/avatar/avatar.js";
import "@shoelace-style/shoelace/dist/components/alert/alert.js";
import "@shoelace-style/shoelace/dist/components/badge/badge.js";
import "@shoelace-style/shoelace/dist/components/button/button.js";
import "@shoelace-style/shoelace/dist/components/card/card.js";
import "@shoelace-style/shoelace/dist/components/dialog/dialog.js";
import "@shoelace-style/shoelace/dist/components/divider/divider.js";
import "@shoelace-style/shoelace/dist/components/drawer/drawer.js";
import "@shoelace-style/shoelace/dist/components/details/details.js";
import "@shoelace-style/shoelace/dist/components/icon/icon.js";
import "@shoelace-style/shoelace/dist/components/icon-button/icon-button.js";
import "@shoelace-style/shoelace/dist/components/input/input.js";
import "@shoelace-style/shoelace/dist/components/menu/menu.js";
import "@shoelace-style/shoelace/dist/components/menu-item/menu-item.js";
import "@shoelace-style/shoelace/dist/components/progress-bar/progress-bar.js";
import "@shoelace-style/shoelace/dist/components/radio/radio.js";
import "@shoelace-style/shoelace/dist/components/radio-group/radio-group.js";
import "@shoelace-style/shoelace/dist/components/spinner/spinner.js";
import "@shoelace-style/shoelace/dist/components/skeleton/skeleton.js";
import "@shoelace-style/shoelace/dist/components/tooltip/tooltip.js";

//import {Upload, UploadBeforeEvent, UploadFileRejectEvent} from "@vaadin/upload";
// import {UploadFile} from "@vaadin/upload/src/vaadin-upload";
import '@vaadin/multi-select-combo-box/theme/lumo/vaadin-multi-select-combo-box.js';
import '@vaadin/combo-box/theme/lumo/vaadin-combo-box.js';
import '@vaadin/grid/theme/lumo/vaadin-grid.js';
import '@vaadin/grid/theme/lumo/vaadin-grid-selection-column.js';
import '@vaadin/upload/theme/lumo/vaadin-upload.js';
import {setLocale} from "./localization";
import {msg} from "@lit/localize";
import {wrapPathInSvg} from "@ddd-qc/we-utils";
import {mdiAlertOctagonOutline, mdiAlertOutline, mdiCheckCircleOutline, mdiInformationOutline, mdiCog} from "@mdi/js";


export const REPORT_BUG_URL = `https://github.com/lightningrodlabs/files/issues/new`;
const weClientContext = createContext<WeaveServices>('weave_client');


type OutboundItem = {
    distribution: Distribution,
    nickname: string,
    timestamp: Timestamp,
    state: DeliveryState,
};

/**
 * @element
 */
@customElement("files-main-page")
export class FilesMainPage extends DnaElement<FilesDvmPerspective, FilesDvm> {

    /** -- Fields -- */

    @state() private _initialized = false;
    @state() private _viewFileEh?: EntryId;

    @property() appletId: string = "";
    @property() groupProfiles: GroupProfile[] = [];

    private _typeFilter: FileType | undefined = undefined;

    private _notifCount = 0;

    @state() private _deletableFile: EntryId | undefined = undefined;

    //private _groupName = "";

    /** Observed perspective from zvm */
    @property({type: Object, attribute: false, hasChanged: (_v, _old) => true})
    deliveryPerspective!: DeliveryPerspective;

    @consume({ context: weClientContext, subscribe: true })
    weServices!: WeaveServices;


    /** AppletId -> AppletInfo */
    //@state() private _appletInfos: Dictionary<AppletInfo> = {};

    @state() private _selectedMenuItem: SelectedEvent = {type: SelectedType.Home};


    /** -- Getters -- */

    get viewFileDialogElem(): SlDialog {
        return this.shadowRoot!.getElementById("view-file-dialog") as SlDialog;
    }

    get profileDialogElem(): SlDialog {
        return this.shadowRoot!.getElementById("profile-dialog") as SlDialog;
    }

    get actionOverlayElem() : ActionOverlay {
        return this.shadowRoot!.querySelector("action-overlay") as ActionOverlay;
    }

    get storeDialogElem() : StoreDialog {
        return this.shadowRoot!.querySelector("store-dialog") as StoreDialog;
    }
    get sendDialogElem() : SendDialog {
        return this.shadowRoot!.querySelector("send-dialog") as SendDialog;
    }
    get deleteDialogElem() : SlDialog {
        return this.shadowRoot!.getElementById("delete-dialog") as SlDialog;
    }

    get searchInputElem() : SlInput {
        return this.shadowRoot!.getElementById("search-input") as SlInput;
    }

    get menuElem() : FilesMenu {
        return this.shadowRoot!.querySelector("files-menu") as FilesMenu;
    }


    get fabElem() : SlButton {
        return this.shadowRoot!.getElementById("fab-publish") as SlButton;
    }



    /** -- Handle global events -- */

    onDownload(e: CustomEvent<EntryId>) {this._dvm.downloadFile(e.detail)}
    onSend(e: CustomEvent<EntryId>) {this.sendDialogElem.open(e.detail)}
    onViewFile(e: CustomEvent<EntryId>) {this._viewFileEh = e.detail; this.viewFileDialogElem.open = true;}
    onDeleteFile(e: CustomEvent<EntryId>) {console.log("@delete", e.detail); this._deletableFile = e.detail; this.deleteDialogElem.open = true;}


    override connectedCallback() {
        super.connectedCallback();
        // @ts-ignore
        this.addEventListener('download', this.onDownload);
        // @ts-ignore
        this.addEventListener('send', this.onSend);
        // @ts-ignore
        this.addEventListener('view', this.onViewFile);
        // @ts-ignore
        this.addEventListener('delete', this.onDeleteFile);
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        // @ts-ignore
        this.removeEventListener('download', this.onDownload);
        // @ts-ignore
        this.removeEventListener('send', this.onSend);
        // @ts-ignore
        this.removeEventListener('view', this.onViewFile);
        // @ts-ignore
        this.removeEventListener('delete', this.onDeleteFile);
    }


    /** -- Methods -- */

    /**
     * In dvmUpdated() this._dvm is not already set!
     * Subscribe to ZVMs
     */
    protected override async dvmUpdated(newDvm: FilesDvm, oldDvm?: FilesDvm): Promise<void> {
        console.log("<files-main-page>.dvmUpdated()");
        if (oldDvm) {
            console.log("\t Unsubscribed to Zvms roleName = ", oldDvm.filesZvm.cell.name)
            //oldDvm.filesZvm.unsubscribe(this);
            oldDvm.deliveryZvm.unsubscribe(this);
        }
        newDvm.deliveryZvm.subscribe(this, 'deliveryPerspective');
        console.log("\t Subscribed Zvms roleName = ", newDvm.filesZvm.cell.name);
        /** Done */
        this._initialized = true;
    }


    /** After first render only */
    override async firstUpdated() {
        console.log("<files-main-page> firstUpdated()", this.appletId);

        // /** Notifier */
        // const maybeNotifier = await this._dvm.notificationsZvm.selectNotifier();
        // console.log("firstUpdated() maybeNotifier:", maybeNotifier? encodeHashToBase64(maybeNotifier) : "none");
        // await this.initializeMailgunNotifierFromProfile();

        // /** Generate test data */
        // if (!this.appletId) {
        //     this.appletId = encodeHashToBase64(await emptyAppletHash());
        //     console.warn("no appletHash provided. A fake one has been generated", this.appletId);
        // }
    }


    /** */
    async initializeMailgunNotifier(_email: string, _domain: string, _auth_token: string) {
        // console.log("initializeNotifier()", auth_token);
        // await this._dvm.notificationsZvm.zomeProxy.claimNotifier(this.cell.agentPubKey);
        // this._dvm.notificationsZvm.setConfig({"mailgun": {
        //         "email_address": email, //"whosin@mg.flowplace.org",
        //         "auth_token": "api:" + auth_token,
        //         "domain": domain, //"mg.flowplace.org"
        //     }});
        // console.log("Config keys:", this._dvm.notificationsZvm.config? Object.keys(this._dvm.notificationsZvm.config) : "none");
        // this._dvm.notificationsZvm.serviceName = "Files Notification";
        // const maybeNotifier = await this._dvm.notificationsZvm.selectNotifier();
        // console.log("init maybeNotifier:", maybeNotifier? encodeHashToBase64(maybeNotifier) : "none");
    }


    /** */
    override updated() {
        //console.log("<files-main-page> UPDATED START");
        /** Add behavior to buttons in reply notification */
        const acceptButton = document.getElementById("accept-notice-btn") as HTMLInputElement;
        const declineButton = document.getElementById("decline-notice-btn") as HTMLInputElement;
        if (acceptButton) {
            //console.log("UPDATED button found!", acceptButton);
            const mustEh = acceptButton.getAttribute("eh");
            if (!mustEh) {
                throw Error("Missing eh attribute in acceptButton");
            }
            const acceptEh = new EntryId(mustEh);
            const alert = document.getElementById("new-notice-" + acceptEh.b64) as SlAlert;
            //console.log("UPDATED alert", alert);
            //const declineEh = declineButton.getAttribute("eh");
            //const notice = this._dvm.deliveryZvm.perspective.notices[acceptEh];
            acceptButton.removeEventListener("click", () => {this._dvm.deliveryZvm.acceptDelivery(acceptEh); alert.hide();});
            acceptButton.addEventListener("click", () => {this._dvm.deliveryZvm.acceptDelivery(acceptEh); alert.hide();});
            declineButton.removeEventListener("click", () => {this._dvm.deliveryZvm.declineDelivery(acceptEh); alert.hide();});
            declineButton.addEventListener("click", () => {this._dvm.deliveryZvm.declineDelivery(acceptEh); alert.hide();});
        }
    }


    /** */
    async onAddFile(): Promise<SplitObject | undefined> {
        const fileInput = this.shadowRoot!.getElementById("addLocalFile") as HTMLInputElement;
        if (!fileInput) {
            throw Promise.reject("Missing HTML element addLocalFile");
        }
        console.log("onAddFile():", fileInput.files);
        if (fileInput.files && fileInput.files.length > 0) {
            let res = await this._dvm.startCommitPrivateFile(fileInput.files[0]!, []);
            console.log("onAddFile() res:", res);
            fileInput.value = "";
            return res;
        }
        return undefined;
    }


    // /** */
    // async onPublishFile(): Promise<SplitObject | undefined> {
    //     const fileInput = this.shadowRoot!.getElementById("publishFile") as HTMLInputElement;
    //     console.log("onPublishFile():", fileInput.files.length);
    //     const splitObj = await this._dvm.startPublishFile(fileInput.files[0]);
    //     console.log("onPublishFile() splitObj:", splitObj);
    //     fileInput.value = "";
    //     return splitObj;
    // }


    // /** */
    // async onSendFile(_e: any): Promise<void> {
    //     const localFileInput = this.shadowRoot!.getElementById("localFileSelector") as HTMLSelectElement;
    //     const agentSelect = this.shadowRoot!.getElementById("recipientSelector") as HTMLSelectElement;
    //     console.log("onSendFile():", localFileInput.value, agentSelect.value);
    //     let distribAh = await this._dvm.fileShareZvm.sendFile(localFileInput.value, agentSelect.value);
    //     console.log("onSendFile() distribAh:", distribAh);
    //     localFileInput.value = "";
    // }


    /** */
    async refresh() {
        await this._dvm.probeAll();
        //await this._dvm.filesZvm.zomeProxy.getPrivateFiles();
        await this._dvm.deliveryZvm.zomeProxy.queryAll();
        this.requestUpdate();
    }


    /** */
    printNoticeReceived() {
        for (const [distribAh, acks] of Array.from(this.deliveryPerspective.noticeAcks.entries())) {
            console.log(` - "${distribAh}": distrib = "${distribAh}"; recipients = "${Array.from(acks.keys())}"`)
        }
    }



    /** */
    toastNotif(notifLog: [Timestamp, FilesNotificationType, FilesNotification]): void {
        const type = notifLog[1];
        const ts = notifLog[0];

        let message = "";
        let title = "";
        let variant = "primary";
        let duration = 5000;
        let icon = "info-circle";
        let extraHtml;
        let id;

        let myProfile = this._dvm.profilesZvm.getMyProfile();
        if (!myProfile) {
            myProfile = {nickname: msg("unknown"), fields: {lang: "en"}} as ProfileMat;
        }

        if (FilesNotificationType.DeliveryRequestSent == type) {
            const manifestEh = (notifLog[2] as FilesNotificationVariantDeliveryRequestSent).manifestEh;
            const tuple = this.deliveryPerspective.privateManifests.get(manifestEh)!;
            const privateManifest = tuple[0];
            const recipients = (notifLog[2] as FilesNotificationVariantDeliveryRequestSent).recipients;
            let recipientName = "" + recipients.length + " peers";
            if (recipients.length == 1) {
                const maybeProfile = this._dvm.profilesZvm.perspective.getProfile(recipients[0]!);
                recipientName = maybeProfile ? maybeProfile.nickname : "unknown";
            }
            console.log("DeliveryRequestSent", notifLog, recipients, recipientName);
            variant = 'success';
            icon = "check2-circle";
            title = msg("File delivery request sent");
            message = "" + privateManifest.description.name + " " + msg("to") + " " + recipientName;
        }
        if (FilesNotificationType.ReceptionComplete == type) {
            const manifestEh = (notifLog[2] as FilesNotificationVariantReceptionComplete).manifestEh;
            //const noticeEh = (notifLog[2] as FileShareNotificationVariantReceptionComplete).noticeEh;
            const privateManifest = this.deliveryPerspective.privateManifests.get(manifestEh)![0];
            variant = 'success';
            icon = "check2-circle";
            title = msg("File succesfully received");
            message = `"${privateManifest.description.name}" (${prettyFileSize(privateManifest.description.size)})`;
        }
        if (FilesNotificationType.DistributionToRecipientComplete == type) {
            const distribAh = (notifLog[2] as FilesNotificationVariantDistributionToRecipientComplete).distribAh;
            const recipient = (notifLog[2] as FilesNotificationVariantDistributionToRecipientComplete).recipient;
            const manifestEh = new EntryId(this.deliveryPerspective.distributions.get(distribAh)![0].delivery_summary.parcel_reference.parcel_eh);
            const privateManifest = this.deliveryPerspective.privateManifests.get(manifestEh)![0];
            const maybeProfile = this._dvm.profilesZvm.perspective.getProfile(recipient);
            const recipientName = maybeProfile? maybeProfile.nickname : msg("Unknown");
            variant = 'success';
            icon = "check2-circle";
            title = msg("File successfully shared");
            message = `"${privateManifest.description.name}" to ${recipientName}`;
        }
        if (FilesNotificationType.PublicSharingComplete == type) {
            const manifestEh = (notifLog[2] as FilesNotificationVariantPublicSharingComplete).manifestEh;
            const publicParcel = this.deliveryPerspective.publicParcels.get(manifestEh)!;
            variant = 'success';
            icon = "check2-circle";
            title = msg("New file published");
            message = `"${publicParcel.description.name}" (${prettyFileSize(publicParcel.description.size)})`;
        }
        if (FilesNotificationType.PublicSharingRemoved == type) {
            const manifestEh = (notifLog[2] as FilesNotificationVariantPublicSharingRemoved).manifestEh;
            const publicManifest = this.deliveryPerspective.publicParcels.get(manifestEh)!;
            variant = 'warning';
            icon = "x-octagon";
            title = msg("File unpublished");
            message = `"${publicManifest.description.name}"`;
        }
        if (FilesNotificationType.PrivateCommitComplete == type) {
            const manifestEh = (notifLog[2] as FilesNotificationVariantPrivateCommitComplete).manifestEh;
            const privateManifest = this.deliveryPerspective.privateManifests.get(manifestEh)![0];
            variant = 'success';
            icon = "check2-circle";
            title = msg("File succesfully added");
            message = `"${privateManifest.description.name}" (${prettyFileSize(privateManifest.description.size)})`;
        }
        if (FilesNotificationType.NewNoticeReceived == type) {
            const noticeEh = (notifLog[2] as FilesNotificationVariantNewNoticeReceived).noticeEh;
            const description = (notifLog[2] as FilesNotificationVariantNewNoticeReceived).description;
            const recipient = (notifLog[2] as FilesNotificationVariantNewNoticeReceived).sender;
            const maybeProfile = this._dvm.profilesZvm.perspective.getProfile(recipient);
            const recipientName = maybeProfile? maybeProfile.nickname : "unknown";
            title = msg("Incoming file request");
            message = `"${description.name}" (${prettyFileSize(description.size)}) ${msg("from")}: ${recipientName}`;
            id = "new-notice-" + noticeEh.b64
            duration = Infinity;
            extraHtml = `
                <div>
                    <sl-button id="accept-notice-btn" variant="default" size="small" eh="${noticeEh.b64}">
                      <sl-icon slot="prefix" name="check"></sl-icon>
                      ${msg("Accept")}
                    </sl-button>
                    <sl-button id="decline-notice-btn" variant="default" size="small" eh="${noticeEh.b64}">
                      <sl-icon slot="prefix" name="x"></sl-icon>
                      ${msg("Decline")}
                    </sl-button>
                </div>
            `;
        }
        if (FilesNotificationType.ReplyReceived == type) {
            const notif = notifLog[2] as FilesNotificationVariantReplyReceived;
            const distrib = this.deliveryPerspective.distributions.get(notif.distribAh)![0];
            const description = distrib.delivery_summary.parcel_reference.description;
            const maybeProfile = this._dvm.profilesZvm.perspective.getProfile(notif.recipient);
            const recipientName = maybeProfile? maybeProfile.nickname : "unknown";
            if (notif.hasAccepted) {
                title = msg("File accepted");
            } else {
                title = msg("File declined");
                variant = 'danger';
                icon = "x-octagon";
            }
            message = `${msg("For")} "${description.name}" ${msg("from")} ${recipientName}`;
        }
        createAlert(title, message, variant, icon, duration, extraHtml, id);

        if (this.weServices) {
            const myNotif: FrameNotification = {
                title,
                body: message,
                notification_type: type,
                icon_src: this.variant2Icon(variant),
                urgency: 'medium',
                timestamp: ts,
            }
            this.weServices.notifyFrame([myNotif]);
        }
    }


    /** */
    variant2Icon(variant: string): string {
        switch(variant) {
            case "primary": return wrapPathInSvg(mdiInformationOutline);
            case "success": return wrapPathInSvg(mdiCheckCircleOutline);
            case "neutral": return wrapPathInSvg(mdiCog);
            case "warning": return wrapPathInSvg(mdiAlertOutline);
            case "danger": return wrapPathInSvg(mdiAlertOctagonOutline);
            default: return "";
        }
    }

    /** */
    async initializeMailgunNotifierFromProfile() {
        const profile = this._dvm.profilesZvm.getMyProfile();
        console.log("initializeMailgunNotifierFromProfile() profile", profile);

        // if (profile.fields['mailgun_email'] && profile.fields['mailgun_domain'] && profile.fields['mailgun_token'] && profile.fields['mailgun_token_nonce']) {
        //     console.log("initializeMailgunNotifierFromProfile() has mailgun token", profile.fields['mailgun_token_nonce']);
        //     const encrypted_data = Base64.toUint8Array(profile.fields['mailgun_token']);
        //     let nonce = Base64.toUint8Array(profile.fields['mailgun_token_nonce']);
        //     console.log("<edit-profile>.render() decrypt mailgun token nonce", nonce);
        //     const wtf = { nonce, encrypted_data }
        //     try {
        //         const data = await this._dvm.filesZvm.zomeProxy.decryptData(wtf);
        //         const mailgun_token = new TextDecoder().decode(data);
        //         await this.initializeMailgunNotifier(profile.fields['mailgun_email'], profile.fields['mailgun_domain'], mailgun_token);
        //     } catch(e:any) {
        //         console.error("Failed to initializeMailgunNotifier()", e);
        //     }
        // }
    }

    /** */
    private async onSaveProfile(profileInfo: ProfileInfo) {
        console.log("onSaveProfile()", profileInfo.profile);
        const profile: ProfileMat = profileInfo.profile;
        try {
            await this._dvm.profilesZvm.updateMyProfile(profile);
        } catch(e:any) {
            await this._dvm.profilesZvm.createMyProfile(profile);
        }
        // /** mailgun */
        // if (profileInfo.mailgun_token && profileInfo.mailgun_token.length > 0) {
        //     await this.initializeMailgunNotifier(profileInfo.profile.fields['mailgun_email'], profileInfo.profile.fields['mailgun_domain'], profileInfo.mailgun_token);
        // }
        // /** email */
        // if (profile.fields["email"] && profile.fields["email"].length > 0) {
        //     console.log("onSavProfile() email", profile.fields["email"]);
        //     await this._dvm.notificationsZvm.createMyContact("", "", profile.fields["email"]);
        //     let maybeNotifier = this._dvm.notificationsZvm.perspective.myNotifier;
        //     if (!this._dvm.notificationsZvm.perspective.myNotifier) {
        //         maybeNotifier = await this._dvm.notificationsZvm.selectNotifier();
        //         console.log("New maybeNotifier:", maybeNotifier? encodeHashToBase64(maybeNotifier) : "none");
        //     }
        // }
        /** Done */
        this.profileDialogElem.open = false;
        this.requestUpdate();
    }


    /** */
    async deletePublicFile() {
        console.log("deletePublicFile()", this._deletableFile);
        if(!this._deletableFile) {
            console.warn("No PublicFile to delete");
            return;
        }
        await this._dvm.removePublicParcel(this._deletableFile);
        this._deletableFile = undefined;
        this.deleteDialogElem.open = false;
    }


    /** */
    onCardClick(type: FileType) {
        console.log("onCardClick()", this.menuElem, type);
        this.menuElem.setSelected(SelectedType.AllFiles);
        this._typeFilter = type;
        this._selectedMenuItem = {type: SelectedType.AllFiles};
    }


    /** */
    downloadTextFile(filename: string, content: string): void {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }


    /** */
    renderHome(unrepliedInbounds: TemplateResult<1>[]) {
        const initialized = !!(this._initialized && this._dvm.deliveryZvm.probeDhtCount);

        /** Count files per type */
        const privDescriptions = Array.from(this.deliveryPerspective.privateManifests.values())
            .map(([manifest, _ts]) => manifest.description);
        const pubDescriptions = Array.from(this.deliveryPerspective.publicParcels.values())
            .filter((pprm) => !pprm.deleteInfo)
            .map((pprm) => pprm.description);

        let countMap: Record<string, number> = {};
        if (initialized) {
            countMap = countFileTypes(privDescriptions.concat(pubDescriptions));
        }

        /** */
        return html`
            <!-- File type cards -->
            <div id="card-row">
                <div class="card" @click=${(_e:any) => {this.onCardClick(FileType.Document)}}>
                    <sl-icon name=${type2Icon(FileType.Document)}></sl-icon>
                    <div>${msg("Documents")}</div>
                    ${initialized? html`<div class="subtext">${countMap[FileType.Document]} ${msg("file(s)")}</div>`: html`<sl-skeleton effect="pulse"></sl-skeleton>`}
                </div>                
                <div class="card" @click=${(_e:any) => {this.onCardClick(FileType.Image)}}>
                    <sl-icon name=${type2Icon(FileType.Image)}></sl-icon>
                    <div>${msg("Images")}</div>
                    ${initialized? html`<div class="subtext">${countMap[FileType.Image]} ${msg("file(s)")}</div>`: html`<sl-skeleton effect="pulse"></sl-skeleton>`}
                </div>
                <div class="card" @click=${(_e:any) => {this.onCardClick(FileType.Video)}}>
                    <sl-icon name=${type2Icon(FileType.Video)}></sl-icon>
                    <div>${msg("Video")}</div>
                    ${initialized? html`<div class="subtext">${countMap[FileType.Video]} ${msg("file(s)")}</div>`: html`<sl-skeleton effect="pulse"></sl-skeleton>`}
                </div>
                <div class="card" @click=${(_e:any) => {this.onCardClick(FileType.Audio)}}>
                    <sl-icon name=${type2Icon(FileType.Audio)}></sl-icon>
                    <div>${msg("Audio")}</div>
                    ${initialized? html`<div class="subtext">${countMap[FileType.Audio]} ${msg("file(s)")}</div>`: html`<sl-skeleton effect="pulse"></sl-skeleton>`}
                </div>
                <div class="card" @click=${(_e:any) => {this.onCardClick(FileType.Zip)}}>
                    <sl-icon name=${type2Icon(FileType.Zip)}></sl-icon>
                    <div>${msg("Zip")}</div>
                    ${initialized? html`<div class="subtext">${countMap[FileType.Zip]} ${msg("file(s)")}</div>`: html`<sl-skeleton effect="pulse"></sl-skeleton>`}
                </div>                
            </div>
            <!-- Incoming file requests -->        
            ${unrepliedInbounds.length? html`
                <h2>${msg("Incoming file requests")}</h2>
                <ul>${unrepliedInbounds}</ul>
            ` : html``}
            <!-- Recent Activity -->
            <h2>${msg("Recent Activity")}</h2>
            <activity-timeline
                    style="padding-right: 5px;"
                    @tag=${(e: CustomEvent<SelectedEvent>) => this._selectedMenuItem = e.detail}
            ></activity-timeline>`;
    }


    /** */
    override render() {
        //console.log("<files-main-page>.render()")
        const isInDev = HAPP_ENV == HappEnvType.Devtest || HAPP_ENV == HappEnvType.DevtestWe || HAPP_ENV == HappEnvType.DevTestHolo;
        //const isInDev = true;
        console.log("<files-main-page>.render()", isInDev, this._initialized, this._dvm.deliveryZvm.probeDhtCount, this._selectedMenuItem, this.deliveryPerspective, this._dvm.profilesZvm.perspective);


        /** This agent's profile info */
        let myProfile = this._dvm.profilesZvm.getMyProfile();
        if (!myProfile) {
        //     myProfile = {nickname: msg("unknown"), fields: { lang: "en"}} as ProfileMat;
        //     console.log("Profile not found. Probing", this._dvm.cell.agentId);
        //     this._dvm.profilesZvm.findProfile(this._dvm.cell.agentId).then((profile) => {
        //         if (!profile) {
        //             console.log("Profile still not found after probing");
        //             return;
        //         }
        //         console.log("Found Profile", profile.nickname);
        //         this.requestUpdate();
        //     })
            return html`<sl-spinner></sl-spinner>`;
        }
        const avatarUrl = myProfile.fields['avatar'];
        let lang = myProfile.fields['lang'];
        if (!lang || lang == "") {
            lang = "en";
        }
        setLocale(lang);

        /** Search results */
        let searchResultItems: TemplateResult<1>[] = [];
        if (this.searchInputElem) {
            const filter = this.searchInputElem.value.toLowerCase();
            const results = this._dvm.searchParcel(filter);
            console.log("searchInputElem", filter, results);
            searchResultItems = results.map((ppEh) => html`
                <file-button    .hash=${ppEh}
                                @tag=${(e: CustomEvent<SelectedEvent>) => {this._selectedMenuItem = e.detail; this.searchInputElem.value = ""}}
                ></file-button>
            `);
        }


        /** -- Notifications -- */
        const newNotifDiff = this.perspective.notificationLogs.length - this._notifCount;
        if (newNotifDiff > 0) {
            console.log("New notifications diff:", newNotifDiff, this._notifCount);
            for(let i = this._notifCount; i < this.perspective.notificationLogs.length; i++) {
                const notifLog = this.perspective.notificationLogs[i]!;
                console.log("New notifications:", notifLog);
                this.toastNotif(notifLog);
            }
            this._notifCount = this.perspective.notificationLogs.length;
        }


        /** -- -- */

        // const agentOptions = Array.from(this._dvm.profilesZvm.perspective.profileByAgent.entries()).map(
        //     ([agentId, _profileId]) => {
        //         //console.log("" + index + ". " + agentIdB64)
        //         const profile = this._dvm.profilesZvm.getProfile(agentId);
        //         return html `<option value=${agentId.b64}>${profile.nickname}</option>`
        //     }
        // )

        //console.log("localFiles found:", this.deliveryPerspective.privateManifests);

        // const fileOptions = Array.from(this.deliveryPerspective.privateManifests.entries()).map(
        //     ([eh, [manifest, _ts]]) => {
        //         //console.log("" + index + ". " + agentIdB64)
        //         return html `<option value="${eh}">${manifest.description.name}</option>`
        //     }
        // )


        /** Unreplied inbounds */
        //let unrepliedInbounds: TemplateResult<1>[] = [];
        let unrepliedInbounds: TemplateResult<1>[] = Array.from(this._dvm.deliveryZvm.inbounds()[0].entries())
                .map(([noticeEh, [notice, _ts]]) => {
                console.log("" + noticeEh.b64, this.deliveryPerspective.notices.get(noticeEh));
                const senderKey = new AgentId(notice.sender);
                const senderProfile = this._dvm.profilesZvm.perspective.getProfile(senderKey);
                let senderName = senderKey.b64;
                if (senderProfile) {
                    senderName = senderProfile.nickname;
                }
                const unrepliedLi = html`
                    <li id="inbound_${noticeEh.b64}">
                        <span class="nickname">${senderName}</span>
                        ${msg("wants to send you")} 
                        <span style="font-weight: bold">${notice.summary.parcel_reference.description.name}</span>
                        (${prettyFileSize(notice.summary.parcel_reference.description.size)})
                        <div style="margin: 10px 10px 20px 20px;">
                            <sl-button type="button" variant="default" @click=${() => {this._dvm.deliveryZvm.acceptDelivery(noticeEh);}}>
                                <sl-icon slot="prefix" name="check"></sl-icon>
                                ${msg("Accept")}
                            </sl-button>
                            <sl-button type="button" variant="default" @click=${()=> {this._dvm.deliveryZvm.declineDelivery(noticeEh);}}>
                                <sl-icon slot="prefix" name="x"></sl-icon>
                                ${msg("Decline")}
                            </sl-button>
                        </divstyle>
                    </li>`
                return unrepliedLi;
            });

        /** Unreplied outbounds */
        let outboundList = Array.from(this._dvm.deliveryZvm.outbounds().entries())
            .map(([_distribAh, [distribution, ts, deliveryStates]]) => {
                const outboundItems = Array.from(deliveryStates.entries()).map(
                    ([recipient, state]) => {
                        const maybe = this._dvm.profilesZvm.perspective.getProfile(recipient);
                        return {
                            distribution,
                            nickname: maybe? maybe.nickname : "",
                            timestamp: ts,
                            state,
                        } as OutboundItem;
                });
                return outboundItems;
            })
            .flat();

        let outboundTable = html`
                    <vaadin-grid .items=${outboundList}>
                        <vaadin-grid-column path="distribution" header=${msg("Filename")}
                                            ${columnBodyRenderer<OutboundItem>(
                                                    ({ distribution }) => html`<span>${distribution.delivery_summary.parcel_reference.description.name}</span>`,
                                                    [],
                                            )}>
                        </vaadin-grid-column>                        
                        <vaadin-grid-column path="nickname" header=${msg("Recipient")}
                                            ${columnBodyRenderer<OutboundItem>(
                                                    ({ nickname }) => {
                                                        return nickname != ""
                                                                ? html`<span>${nickname}</span>`
                                                                : html`<sl-skeleton effect="sheen"></sl-skeleton>`
                                                    },
                                                    [],
                                            )}
                        ></vaadin-grid-column>                        
                        <vaadin-grid-column path="state" header=${msg("State")}
                            ${columnBodyRenderer<OutboundItem>(
                            ({ state }) => {
                                if (DeliveryState.Unsent == state) {
                                    return html`<span>${msg("Delivery notice unsent")}</span>`
                                }
                                if (DeliveryState.PendingNotice == state) {
                                    return html`<span>${msg("Delivery notice pending reception")}</span>`
                                }
                                if (DeliveryState.NoticeDelivered == state) {
                                    return html`<span>${msg("Waiting for reply")}</span>`
                                }
                                return html`<span>${msg("Unknown")}</span>`
                            },
                            [],
                        )}>
                        </vaadin-grid-column>
                        <vaadin-grid-column path="timestamp" header=${msg("Sent Date")}
                                            ${columnBodyRenderer<OutboundItem>(
                                                    ({ timestamp }) => html`<span>${prettyTimestamp(timestamp)}</span>`,
                                                    [],
                                            )}
                        ></vaadin-grid-column>                        
                    </vaadin-grid>
                `;

        /** Incomplete manifests (inbound pending) */
        // let incompleteList = this.deliveryPerspective.incompleteManifests
        //     .map((manifestEh) => {
        //         const pair = this.deliveryPerspective.privateManifests[manifestEh];
        //         if (!pair) {
        //             console.warn("Manifest not found for incomplete manifest:", manifestEh)
        //             return {};
        //         };
        //         let noticeTuple;
        //         for (const tuple of Object.values(this.deliveryPerspective.notices)) {
        //             if (encodeHashToBase64(tuple[0].summary.parcel_reference.eh) == manifestEh) {
        //                 noticeTuple = tuple;
        //                 break;
        //             }
        //         }
        //         if (!noticeTuple) {
        //             console.warn("Notice not found for incomplete manifest:", manifestEh)
        //             return {};
        //         };
        //         return {
        //             notice: noticeTuple[0],
        //             timestamp: noticeTuple[1],
        //             pct: noticeTuple[3],
        //         }
        //     });
        // const incompleteTable = html`
        //             <vaadin-grid .items="${incompleteList}">
        //                 <vaadin-grid-column path="notice" header="Filename"
        //                                     ${columnBodyRenderer(
        //     ({ notice }) => html`<span>${notice.summary.parcel_reference.description.name}</span>`,
        //     [],
        // )}>
        //                 </vaadin-grid-column>
        //                 <vaadin-grid-column path="notice" header="Sender"
        //                                     ${columnBodyRenderer(
        //     ({ notice }) => {
        //         const sender = encodeHashToBase64(notice.sender);
        //         const maybeProfile = this._profilesZvm.perspective.profiles[sender];
        //         return maybeProfile
        //             ? html`<span>${maybeProfile.nickname}</span>`
        //             : html`<sl-skeleton effect="sheen"></sl-skeleton>`
        //     },
        //     [],
        // )}
        //                 ></vaadin-grid-column>
        //                 <vaadin-grid-column path="pct" header="State"
        //                     ${columnBodyRenderer(({ pct }) => {return html`<sl-progress-bar value=${pct}></sl-progress-bar>`},
        //         [],
        //                 )}>
        //                 </vaadin-grid-column>
        //                 <vaadin-grid-column path="timestamp" header="Sent Date"
        //                                     ${columnBodyRenderer(
        //     ({ timestamp }) => html`<span>${prettyTimestamp(timestamp)}</span>`,
        //     [],
        // )}
        //                 ></vaadin-grid-column>
        //             </vaadin-grid>
        //         `;


        /** Choose what to display */
        let mainArea = html`
            <h2>${msg("Recent Activity")}...</h2>
            <sl-skeleton effect="sheen" style="margin:15px; width: 30%; height: 24px;"></sl-skeleton>
            <sl-skeleton effect="sheen" style="margin:15px; width: 30%; height: 24px;"></sl-skeleton>
            <sl-skeleton effect="sheen" style="margin:15px; width: 30%; height: 24px;"></sl-skeleton>
            `;
        if (this._selectedMenuItem && this._dvm.deliveryZvm.probeDhtCount) {
            console.log("_selectedMenuItem", this._selectedMenuItem)

            if (this._selectedMenuItem.type == SelectedType.Home) {
                mainArea = this.renderHome(unrepliedInbounds);
            }
            if (this._selectedMenuItem.type == SelectedType.AllFiles) {
                const privateItems = Array.from(this.deliveryPerspective.privateManifests.entries())
                    .filter(([_ppEh, [manifest, _ts]]) => {
                        const type = kind2Type(manifest.description.kind_info);
                        return !this._typeFilter
                            || this._typeFilter == type
                            || (this._typeFilter == FileType.Document && (type == FileType.Text || type == FileType.Pdf))
                    })
                    .map(([ppEh, [pm, timestamp]]) => {
                    //const timestamp = this.deliveryPerspective.privateManifests[ppEh][1];
                    return {
                        ppEh: ppEh.b64,
                        description: pm.description,
                        timestamp,
                        author: this._dvm.profilesZvm.perspective.getProfile(this.cell.address.agentId),
                        isLocal: true,
                        isPrivate: true
                    } as FileTableItem;
                });
                // const myPublicItems = Object.entries(this.deliveryPerspective.localPublicManifests).map(([ppEh, [pm, timestamp]]) => {
                //     //const timestamp = this.deliveryPerspective.localPublicManifests[ppEh][1];
                //     return {pp_eh: decodeHashFromBase64(ppEh), description: pm.description, timestamp, author: this.cell.agentPubKey, isLocal: true, isPrivate: false} as FileTableItem;
                // });
                const publicItems: FileTableItem[] = Array.from(this.deliveryPerspective.publicParcels.entries())
                    .filter(([_ppEh, pprm]) => !pprm.deleteInfo)
                    .filter(([_ppEh, pprm]) => {
                        const type = kind2Type(pprm.description.kind_info);
                        return !this._typeFilter
                            || this._typeFilter == type
                            || (this._typeFilter == FileType.Document && (type == FileType.Text || type == FileType.Pdf))
                    })
                    .map(([ppEh, pprm]) => {
                    //const [description, timestamp, author] = this.deliveryPerspective.publicParcels[ppEh];
                    const isLocal = !!this.deliveryPerspective.localPublicManifests.get(ppEh);
                    if (!pprm.author) {
                        console.error("Missing author for PPRM");
                    }
                    return {ppEh: ppEh.b64, description: pprm.description, timestamp: pprm.creationTs, author: this._dvm.profilesZvm.perspective.getProfile(pprm.author!), isLocal, isPrivate: false} as FileTableItem;
                });
                const allItems = privateItems.concat(publicItems/*, myPublicItems*/);
                mainArea = html`
                    <h2>${msg("All Files")}${this._typeFilter? ": " + this._typeFilter : ""}</h2>
                    <file-table type="all" .items=${allItems}></file-table>
                `;
            }
            if (this._selectedMenuItem.type == SelectedType.PersonalFiles) {
                const personalItems: FileTableItem[] = Array.from(this.deliveryPerspective.privateManifests.entries())
                  .map(([ppEh, [pm, timestamp]]) => {
                    //const timestamp = this.deliveryPerspective.privateManifests[ppEh][1];
                    return {ppEh: ppEh.b64, description:pm.description, timestamp, author: this._dvm.profilesZvm.perspective.getProfile(this.cell.address.agentId), isPrivate:true, isLocal:true} as FileTableItem;
                })
                mainArea = html`
                    <h2>${msg("Personal Files")}</h2>
                    <file-table type="personal" .items=${personalItems}></file-table>
                `;
            }
            if (this._selectedMenuItem.type == SelectedType.GroupFiles) {
                // console.log("this.deliveryPerspective.localPublicManifests", this.deliveryPerspective.localPublicManifests)
                // const myPublicItems = Object.entries(this.deliveryPerspective.localPublicManifests).map(([ppEh, [pm, timestamp]]) => {
                //     //const timestamp = this.deliveryPerspective.localPublicManifests[ppEh][1];
                //     return {pp_eh: decodeHashFromBase64(ppEh), description: pm.description, timestamp, author: this.cell.agentPubKey, isLocal: true} as FileTableItem;
                // });
                const dhtPublicItems = Array.from(this.deliveryPerspective.publicParcels.entries())
                  .filter(([_ppEh, pprm]) => !pprm.deleteInfo)
                  .map(([ppEh, pprm]) => {
                    //const [description, timestamp, author] = this.deliveryPerspective.publicParcels[ppEh];
                    const isLocal = !!this.deliveryPerspective.localPublicManifests.get(ppEh);
                    if (!pprm.author) {
                      console.error("Missing author for PPRM");
                    }
                    return {ppEh: ppEh.b64, description: pprm.description, timestamp: pprm.creationTs, author: this._dvm.profilesZvm.perspective.getProfile(pprm.author!), isLocal, isPrivate: false} as FileTableItem;
                });
                //const publicItems = dhtPublicItems.concat(myPublicItems);

                mainArea = html`
                    <h2>${msg("Group Files")}</h2>
                    <file-table type="group" .items=${dhtPublicItems}></file-table>
                `;
            }

            if (this._selectedMenuItem.type == SelectedType.Inbox) {
                mainArea = html`<files-inbox></files-inbox>`;
            }
            if (this._selectedMenuItem.type == SelectedType.Sent) {
                let distributionItems = Array.from(this.deliveryPerspective.distributions.entries())
                    .filter(([_distribAh, tuple]) => DistributionState.AllAcceptedParcelsReceived == tuple[2])
                    .map(([distribAh, [distribution, sentTs, _fullState, _stateMap]]) => {
                        const description = distribution.delivery_summary.parcel_reference.description;
                        const parcelEh = new EntryId(distribution.delivery_summary.parcel_reference.parcel_eh);
                        let items: DistributionTableItem[] = []
                        for (const recipientHash of distribution.recipients) {
                            const recipient = new AgentId(recipientHash);
                            let receptionTs = 0;
                            let deliveryState = DeliveryState.ParcelRefused;
                            /** If recipient refused, no receptionAck should be found */
                            if (this.deliveryPerspective.receptionAcks.get(distribAh) && this.deliveryPerspective.receptionAcks.get(distribAh)!.get(recipient)) {
                                const [_receptionAck, receptionTs2] = this.deliveryPerspective.receptionAcks.get(distribAh)!.get(recipient)!;
                                receptionTs = receptionTs2;
                                deliveryState = DeliveryState.ParcelDelivered;
                            }
                            items.push({
                                distribAh: distribAh.b64,
                                recipient: this._dvm.profilesZvm.perspective.getProfile(recipient),
                                deliveryState,
                                parcelEh: parcelEh.b64,
                                description,
                                sentTs,
                                receptionTs,
                            } as DistributionTableItem);
                        }
                        return items;
                    })
                    .flat()
                    .sort((a, b) => b.sentTs - a.sentTs);
                mainArea = html`
                    <h2>${msg("Sent")}</h2>
                    <distribution-table .items=${distributionItems}></distribution-table>
                `;
            }
            if (this._selectedMenuItem.type == SelectedType.InProgress) {
                mainArea = html`
                    <h2>${msg("Outbound Files")}</h2>
                    <div style="padding-bottom: 80px;padding-right: 10px;">
                        ${outboundTable}
                    </div>
                `;

            }
            if (this._selectedMenuItem.type == SelectedType.PublicTag && this._selectedMenuItem.tag) {
                console.log("Public taggedItems 0", this.deliveryPerspective.publicParcels);
                let taggedItems = Array.from(this.deliveryPerspective.publicParcels.entries())
                  .filter(([_ppEh, pprm]) => !pprm.deleteInfo)
                  .map(([ppEh, pprm]) => {
                        const isLocal = !!this.deliveryPerspective.localPublicManifests.get(ppEh);
                          if (!pprm.author) {
                              console.error("Missing author for PPRM");
                          }
                        return {ppEh: ppEh.b64, description: pprm.description, timestamp: pprm.creationTs, author: this._dvm.profilesZvm.perspective.getProfile(pprm.author!), isLocal, isPrivate:false} as FileTableItem;
                    })
                console.log("Public taggedItems 1", this._selectedMenuItem.tag, taggedItems);
                taggedItems = taggedItems.filter((item) => {
                    const publicTags = this._dvm.taggingZvm.perspective.getTargetPublicTags(new EntryId(item.ppEh));
                    console.log("public taggedItems tags", publicTags, item.ppEh);
                    return publicTags && publicTags.includes(this._selectedMenuItem.tag!);
                });
                console.log("Public taggedItems 2", this._selectedMenuItem.tag, taggedItems, this.deliveryPerspective.publicParcels);
                /** */
                mainArea = html`
                    <h2>${msg("Group Files")}: <span class="tag" style="display:inline; font-size: inherit">${this._selectedMenuItem.tag}</span></h2>
                    <file-table type="group" .items=${taggedItems}></file-table>
                `;
                this.menuElem.setSelected(this._selectedMenuItem.tag);
            }
            if (this._selectedMenuItem.type == SelectedType.PrivateTag && this._selectedMenuItem.tag) {
                let taggedItems = Array.from(this.deliveryPerspective.privateManifests.entries()).map(([ppEh, [pm, timestamp]]) => {
                    //const timestamp = this.deliveryPerspective.privateManifests[ppEh][1];
                    return {ppEh: ppEh.b64, description: pm.description, timestamp, isLocal: false, isPrivate: true} as FileTableItem;
                });
                console.log("private taggedItems 1", this._selectedMenuItem.tag, taggedItems);
                taggedItems = taggedItems.filter((item) => {
                    const tags = this._dvm.taggingZvm.perspective.getTargetPrivateTags(new EntryId(item.ppEh));
                    console.log("private taggedItems tags", tags, item.ppEh);
                    return tags && tags.includes(this._selectedMenuItem.tag!);
                });
                console.log("private taggedItems 2", this._selectedMenuItem.tag, taggedItems, this.deliveryPerspective.privateManifests);
                mainArea = html`
                    <h2>${msg("Personal Files")}: <span class="tag" style="display:inline; font-size: inherit">${this._selectedMenuItem.tag}</span></h2>
                    <file-table type="personal" .items=${taggedItems}></file-table>
                `;
                this.menuElem.setSelected(this._selectedMenuItem.tag);
            }
        }

        const uploadings = Object.keys(this.perspective.uploadStates);
        const maybeUploading = uploadings.length > 0 ? uploadings[0] : undefined;

        /** Render all */
        return html`
        <div id="main">
             <files-menu @selected=${(e:any) => {this._selectedMenuItem = e.detail; this._typeFilter = undefined;}}></files-menu>
             <div id="rhs">
                <div id="topBar">
                    <sl-tooltip placement="bottom-end" content=${myProfile.nickname} style="--show-delay: 400;">
                        <sl-avatar
                                style="cursor:pointer"
                                label=${myProfile.nickname}
                                image=${avatarUrl}
                                @click=${() => this.profileDialogElem.open = true}></sl-avatar>
                    </sl-tooltip>
                    <sl-button class="top-btn" variant="default" size="medium" disabled>
                        <sl-icon name="bell" label="notifications"></sl-icon>
                    </sl-button>
                    <sl-tooltip placement="bottom-end" content=${msg('Report a Bug')} style="--show-delay: 400;">
                        <sl-button class="top-btn" variant="default" size="medium" href=${REPORT_BUG_URL} target="_blank">
                            <sl-icon name="bug" label="Report bug"></sl-icon>
                        </sl-button>
                    </sl-tooltip>
                    <sl-tooltip placement="bottom-end" content=${msg('Export file list')} style="--show-delay: 400;">
                        <sl-button class="top-btn" variant="default" size="medium" @click=${async (_e:any) => {
                            const json = await this._dvm.exportPerspective();
                            this.downloadTextFile("files_dump.json", json);
                        }}>
                            <sl-icon name="journal-text"></sl-icon>
                        </sl-button>
                    </sl-tooltip>
                    ${isInDev? html`
                        <button type="button" @click=${async () => {
                            this._dvm.dumpCallLogs();
                            this._dvm.dumpSignalLogs();
                            //this._dvm.dumpSignalLogs("zDelivery");
                            // await this._dvm.notificationsZvm.probeAll();
                            // await this._dvm.notificationsZvm.probeContacts(this._dvm.profilesZvm.getAgents());
                            // console.log("notificationsZvm.perspective", this._dvm.notificationsZvm.perspective);
                            // console.log("myNotifier:", this._dvm.notificationsZvm.perspective.myNotifier? encodeHashToBase64(this._dvm.notificationsZvm.perspective.myNotifier) : "none");
                        }}>dump</button>
                        <button type="button" @click=${() => {this.refresh();}}>refresh</button>
                        <!-- <button type="button" @click=${() => {/*this._dvm.notificationsZvm.selectNotifier();*/}}>select</button>
                        <button type="button" @click=${() => {/*this._dvm.notificationsZvm.zomeProxy.grantUnrestrictedCapability();*/}}>grant</button> -->

                        <button type="button" @click=${ async() => {
                            // //const myContact = this._dvm.notificationsZvm.perspective.contacts[this.cell.agentPubKey];
                            // await this._dvm.notificationsZvm.probeContacts([this.cell.agentPubKey]);
                            // const myContact = this._dvm.notificationsZvm.getMyContact();
                            // if (myContact && this._dvm.notificationsZvm.perspective.myNotifier) {
                            //     console.log("sending my contact to notifier", myContact, encodeHashToBase64(this._dvm.notificationsZvm.perspective.myNotifier));
                            //     this._dvm.notificationsZvm.zomeProxy.sendContact(myContact);
                            // } else {
                            //     console.log("No Contact info or Notifier found");
                            // }
                        }}>contact</button>
                        <button type="button" @click=${() => {
                            //console.log("Send. Config keys:", this._dvm.notificationsZvm.config? Object.keys(this._dvm.notificationsZvm.config) : "none");
                            //const groupName = this.groupProfiles? this.groupProfiles[0].name : "No WeGroup";
                            //this._dvm.notificationsZvm.sendNotification(`This is a notif. ${this.appletId? weaveUrlFromAppletHash(decodeHashFromBase64(this.appletId)): ""}` ,  `Testing ${groupName}`, [this.cell.agentPubKey]);
                        }}>send</button>
                    `: html``
                    }
                    <sl-popup placement="bottom-start" sync="width" active>                    
                    <sl-input id="search-input" placeholder=${msg("Search")} size="large" clearable
                              slot="anchor"
                              @sl-input=${(_e:any) => {console.log("sl-change", this.searchInputElem.value);this.requestUpdate();}}
                              style="flex-grow: 2">
                        <sl-icon name="search" slot="prefix"></sl-icon>
                    </sl-input>
                    <!-- Search result -->
                    <div id="searchResultView" style="display:${searchResultItems.length? "flex" :"none"}">
                        ${searchResultItems}
                    </div>
                    </sl-popup>
                </div>
                <div id="mainArea">
                    ${mainArea}
                </div>
            </div>
        </div>
        <!-- dialogs -->
        <sl-dialog id="view-file-dialog" label=${msg("File Info")}>
            <file-view .hash=${this._viewFileEh}></file-view>
        </sl-dialog> 
        <sl-dialog id="profile-dialog" label=${msg("Edit Profile")}>
            <files-edit-profile
                    allowCancel
                    .profile=${myProfile}
                    @save-profile=${(e: CustomEvent<ProfileInfo>) => this.onSaveProfile(e.detail)}
                    @lang-selected=${(e: CustomEvent) => {
                        console.log("set locale", e.detail);
                        setLocale(e.detail)
                    }}
            ></files-edit-profile>
        </sl-dialog>
        <action-overlay
                .profile=${myProfile}
                @sl-after-hide=${(_e:any) => {this.fabElem.style.display = "block"}}
                @selected=${(e:any) => {
                    if (e.detail == "send") {
                        this.sendDialogElem.open();
                    }
                    if (e.detail == "publish") {
                        this.storeDialogElem.open(false);
                    }
                    if (e.detail == "add") {
                        this.storeDialogElem.open(true);
                    }
        }}></action-overlay>
        <store-dialog></store-dialog>
        <send-dialog></send-dialog>
        <sl-dialog id="delete-dialog">
            <div>Remove Public file?</div>
            <file-preview .hash=${this._deletableFile}></file-preview>
            <sl-button slot="footer" variant="neutral"
                       @click=${(_e:any) => {this._deletableFile = undefined; this.deleteDialogElem.open = false;}}>
                ${msg("Cancel")}
            </sl-button>
            <sl-button slot="footer" variant="danger"
                       @click=${async (_e:any) => this.deletePublicFile()}>
                ${msg("Delete")}
            </sl-button>
        </sl-dialog>
        <!-- stack -->
        <div id="bottom-stack">
            <!-- commit button & panel -->
            ${maybeUploading && this.perspective.uploadStates[maybeUploading]? html`
                        <div id="uploadingView">
                            <div style="display:flex; flex-direction:row; gap:35px;">
                                <sl-progress-bar style="flex-grow:1;--indicator-color:#3dd23d;"
                                                 .value=${Math.ceil(this.perspective.uploadStates[maybeUploading]!.chunks.length / this.perspective.uploadStates[maybeUploading]!.splitObj.numChunks * 100)}></sl-progress-bar>
                            </div>
                            <div style="display:flex; flex-direction:row; gap:5px;color:white;">
                                <sl-icon class="prefixIcon"
                                         name=${kind2Icon({Manifest: this.perspective.uploadStates[maybeUploading]!.file.type})}></sl-icon>
                                <files-filename filename=${this.perspective.uploadStates[maybeUploading]!.file.name} 
                                                 style="font-weight: bold; max-width: 175px; width:inherit; margin-right:3px;"></files-filename>
                                <sl-icon style="margin-right:3px;" name="arrow-right"></sl-icon>
                                <sl-icon name="hdd"></sl-icon>
                            </div>
                        </div>
                    `
                : html`
                <sl-tooltip placement="left" content="Send/Share file" style="--show-delay: 200;">
                    <sl-button id="fab-publish" size="large" variant="primary" circle
                               @click=${(_e:any) => {this.actionOverlayElem.open(); this.fabElem.style.display = "none"}}>
                        <sl-icon name="plus-lg" label="Add"></sl-icon>
                    </sl-button>
                </sl-tooltip>
        `}
            <inbound-stack></inbound-stack>
        </div>
        `;
    }


    /** */
    static override get styles() {
        return [
            filesSharedStyles,
            css`
              :host {
                display: block;
                height: 100vh;
                /*padding-top: 3px;*/
                background: #F7FBFE;
              }

              #view-file-dialog::part(body) {
                padding-top: 0px;
              }

              #bottom-stack {
                position: fixed;
                right: 15px;
                bottom: 15px;
                width: 100vw;
                display: flex;
                flex-direction: row-reverse;
                gap: 10px;
              }

              #fab-publish {
              }

              #fab-publish::part(base) {
                font-weight: bold;
                font-size: 32px;
                box-shadow: rgba(0, 0, 0, 0.25) 0px 14px 28px, rgba(0, 0, 0, 0.22) 0px 10px 10px;
                /*--sl-input-height-medium: 48px;*/
              }

              #main {
                background: #F7FBFE;
                display: flex;
                height: 100%;
                flex-direction: row;
                /*padding-left: 15px;*/
                /*padding: 15px 10px 10px 15px;*/
              }

              files-menu {
                width: 400px;
                border-radius: 5px;
              }

              #mainArea {
                display: flex;
                flex-direction: column;
                flex: 1 1 auto;
                min-height: 0px;
                overflow: clip;
              }

              #rhs {
                width: 100%;
                margin: 0px 5px 0px 15px;
                display: flex;
                flex-direction: column;
              }

              #topBar {
                display: flex;
                flex-direction: row-reverse;
                gap: 5px;
                margin-top: 3px;
              }

              .top-btn::part(base) {
                background: #E9F0F3;
                font-size: 20px;
                width: 40px;
              }

              #card-row {
                margin-top: 20px;
                display: flex;
                gap: 15px;
              }

              .card {
                /*cursor: pointer;*/
                color: white;
                padding: 15px 5px 5px 15px;
                width: 100px;
                height: 100px;
                background: #21374A;
                border-top: 2px #4B95D6 solid;
                border-left: 1px #4B95D6 solid;
                border-radius: 6px;
                box-shadow: rgba(0, 0, 0, 0.3) 0px 19px 38px, rgba(0, 0, 0, 0.22) 0px 15px 12px;
              }

              .card:hover {
                cursor: pointer;
                background: aliceblue;
                color: #21374A;
              }

              .card sl-icon {
                margin-bottom: 15px;
                font-size: 42px;
              }

              .card .subtext {
                color: #aca4a4;
                font-size: small;
              }

              sl-icon-button::part(base) {
                padding: 0px;
                background: #e6e6e6;
              }

              #uploadingView {
                background: #0284C7;
                display: flex;
                flex-direction: column;
                gap: 8px;
                width: 250px;
                max-width: 250px;
                padding: 10px 5px 7px 10px;
                border-radius: 6px;
                box-shadow: rgba(0, 0, 0, 0.3) 0px 19px 38px, rgba(0, 0, 0, 0.22) 0px 15px 12px;
              }

              #searchResultView {
                padding: 15px;
                background: rgb(255, 255, 255);
                border-radius: 12px;
                box-shadow: rgba(0, 0, 0, 0.3) 0px 19px 38px, rgba(0, 0, 0, 0.22) 0px 15px 12px;
                display: flex;
                gap: 15px;
                flex-wrap: wrap;
                width: fit-content;
              }
            `,];
    }
}

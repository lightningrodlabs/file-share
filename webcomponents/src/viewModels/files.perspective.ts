import {ActionHashB64, AgentPubKeyB64, EntryHash, EntryHashB64, Timestamp} from "@holochain/client";
import {ParcelDescription} from "@ddd-qc/delivery";
import {SplitObject} from "../utils";

export type FilesCb = (manifestEh: EntryHashB64) => void;

/** */
interface UploadState {
    isPrivate: boolean,
    file: File,
    splitObj: SplitObject,
    chunks: EntryHash[],
    index: number,
    written_chunks: number,
    callback?: FilesCb,
}


/** */
export interface FilesDvmPerspective {
    /** dataHash -> UploadState */
    uploadStates: Record<string, UploadState>;
    /** Notifications */
    notificationLogs: [Timestamp, FilesNotificationType, FilesNotification][];
}


/** */
export enum FilesNotificationType {
    //NewPublicFile = 'NewPublicFile',
    DeliveryRequestSent = 'DeliveryRequestSent',
    ReceptionComplete = 'ReceptionComplete',
    DistributionToRecipientComplete = 'DistributionToRecipientComplete',
    PublicSharingComplete = 'PublicSharingComplete',
    PublicSharingRemoved = 'PublicSharingRemoved',
    PrivateCommitComplete = 'PrivateCommitComplete',
    NewNoticeReceived = 'NewNoticeReceived',
    ReplyReceived = 'ReplyReceived',
}

//export type FilesNotificationVariantNewPublicFile = { manifestEh: EntryHashB64, description: ParcelDescription }
export type FilesNotificationVariantDeliveryRequestSent = {distribAh: ActionHashB64, manifestEh: EntryHashB64, recipients: AgentPubKeyB64[] }
export type FilesNotificationVariantReceptionComplete = {noticeEh: EntryHashB64, manifestEh: EntryHashB64 }
export type FilesNotificationVariantDistributionToRecipientComplete = {distribAh: ActionHashB64, recipient: AgentPubKeyB64 }
export type FilesNotificationVariantPublicSharingComplete = {manifestEh: EntryHashB64 }
export type FilesNotificationVariantPublicSharingRemoved = {manifestEh: EntryHashB64 }
export type FilesNotificationVariantPrivateCommitComplete = {manifestEh: EntryHashB64 }
export type FilesNotificationVariantNewNoticeReceived = {noticeEh: EntryHashB64, manifestEh: EntryHashB64, description: ParcelDescription, sender: AgentPubKeyB64 }
export type FilesNotificationVariantReplyReceived = {distribAh: ActionHashB64, recipient: AgentPubKeyB64, hasAccepted: boolean }

/** */
export type FilesNotification =
    //| FileseNotificationVariantNewPublicFile
    | FilesNotificationVariantDeliveryRequestSent
    | FilesNotificationVariantReceptionComplete
    | FilesNotificationVariantDistributionToRecipientComplete
    | FilesNotificationVariantPublicSharingComplete
    | FilesNotificationVariantPublicSharingRemoved
    | FilesNotificationVariantPrivateCommitComplete
    | FilesNotificationVariantNewNoticeReceived
    | FilesNotificationVariantReplyReceived


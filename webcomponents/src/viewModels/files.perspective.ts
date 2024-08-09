import {Timestamp} from "@holochain/client";
import {EntryId, AgentId, ActionId, EntryIdMap} from "@ddd-qc/lit-happ";
import {ParcelDescription} from "@ddd-qc/delivery";
import {SplitObject} from "../utils";

export type FilesCb = (manifestEh: EntryId) => void;

/** */
export interface UploadState {
    isPrivate: boolean,
    file: File,
    splitObj: SplitObject,
    chunks: EntryId[],
    index: number,
    written_chunks: number,
    callback?: FilesCb,
}


/** */
export interface FilesDvmPerspective {
    /** ManifestEh -> File */
    fileCache: EntryIdMap<File>;
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
export type FilesNotificationVariantDeliveryRequestSent = {distribAh: ActionId, manifestEh: EntryId, recipients: AgentId[] }
export type FilesNotificationVariantReceptionComplete = {noticeEh: EntryId, manifestEh: EntryId }
export type FilesNotificationVariantDistributionToRecipientComplete = {distribAh: ActionId, recipient: AgentId }
export type FilesNotificationVariantPublicSharingComplete = {manifestEh: EntryId }
export type FilesNotificationVariantPublicSharingRemoved = {manifestEh: EntryId }
export type FilesNotificationVariantPrivateCommitComplete = {manifestEh: EntryId }
export type FilesNotificationVariantNewNoticeReceived = {noticeEh: EntryId, manifestEh: EntryId, description: ParcelDescription, sender: AgentId }
export type FilesNotificationVariantReplyReceived = {distribAh: ActionId, recipient: AgentId, hasAccepted: boolean }

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


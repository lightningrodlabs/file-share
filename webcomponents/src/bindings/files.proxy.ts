/* This file is generated by zits. Do not edit manually */

import {ATTACHMENTS_ROOT, FILES_DEFAULT_COORDINATOR_ZOME_NAME, FILES_DEFAULT_INTEGRITY_ZOME_NAME, FILES_DEFAULT_ROLE_NAME, FILE_TYPE_NAME, FilesEntry, AttachInput, FileShare, SendFileInput, WriteManifestInput, } from './files.types';
import {
WebsocketConnectionOptions,
/** types.ts */
//HoloHash,
//AgentPubKey,
//DnaHash,
//WasmHash,
//EntryHash,
//ActionHash,
//AnyDhtHash,
//ExternalHash,
KitsuneAgent,
KitsuneSpace,
HoloHashB64,
AgentPubKeyB64,
DnaHashB64,
WasmHashB64,
EntryHashB64,
ActionHashB64,
AnyDhtHashB64,
InstalledAppId,
Signature,
CellId,
DnaProperties,
RoleName,
InstalledCell,
Timestamp,
Duration,
HoloHashed,
NetworkInfo,
FetchPoolInfo,
/** hdk/action.ts */
SignedActionHashed,
RegisterAgentActivity,
ActionHashed,
ActionType,
Action,
NewEntryAction,
Dna,
AgentValidationPkg,
InitZomesComplete,
CreateLink,
DeleteLink,
OpenChain,
CloseChain,
Update,
Delete,
Create,
/** hdk/capabilities.ts */
CapSecret,
CapClaim,
GrantedFunctionsType,
GrantedFunctions,
ZomeCallCapGrant,
CapAccessType,
CapAccess,
CapGrant,
///** hdk/countersigning.ts */
//CounterSigningSessionData,
//PreflightRequest,
//CounterSigningSessionTimes,
//ActionBase,
//CounterSigningAgents,
//PreflightBytes,
//Role,
//CountersigningAgentState,
/** hdk/dht-ops.ts */
DhtOpType,
DhtOp,
getDhtOpType,
getDhtOpAction,
getDhtOpEntry,
getDhtOpSignature,
/** hdk/entry.ts */
EntryVisibility,
AppEntryDef,
EntryType,
EntryContent,
Entry,
/** hdk/record.ts */
Record as HcRecord,
RecordEntry as HcRecordEntry,
/** hdk/link.ts */
AnyLinkableHash,
ZomeIndex,
LinkType,
LinkTag,
RateWeight,
RateBucketId,
RateUnits,
Link,
/** api/admin/types.ts */
InstalledAppInfoStatus,
DeactivationReason,
DisabledAppReason,
StemCell,
ProvisionedCell,
ClonedCell,
CellType,
CellInfo,
AppInfo,
MembraneProof,
FunctionName,
ZomeName,
ZomeDefinition,
IntegrityZome,
CoordinatorZome,
DnaDefinition,
ResourceBytes,
ResourceMap,
CellProvisioningStrategy,
CellProvisioning,
DnaVersionSpec,
DnaVersionFlexible,
AppRoleDnaManifest,
AppRoleManifest,
AppManifest,
AppBundle,
AppBundleSource,
NetworkSeed,
ZomeLocation,
   } from '@holochain/client';


/// Simple Hashes
type AgentArray = Uint8Array;
type DnaArray = Uint8Array;
type WasmArray = Uint8Array;
type EntryArray = Uint8Array;
type ActionArray = Uint8Array;
type AnyDhtArray = Uint8Array;

import {
/** Common */
DhtOpHashB64,
//DnaHashB64, (duplicate)
//AnyDhtHashB64, (duplicate)
DhtOpHash,
/** DnaFile */
DnaFile,
DnaDef,
Zomes,
WasmCode,
/** entry-details */
EntryDetails,
RecordDetails,
Details,
DetailsType,
EntryDhtStatus,
/** Validation */
ValidationStatus,
ValidationReceipt,
   } from '@holochain-open-dev/core-types';

/** User defined external dependencies */
import {DistributionStrategy, ParcelManifest, ParcelChunk, ParcelDescription, ParcelKind, ParcelReference} from '@ddd-qc/delivery';

import {ZomeProxy} from '@ddd-qc/lit-happ';
import {filesFunctionNames} from './files.fn';
import {FilesUnitEnum, FilesLinkType} from './files.integrity';

/**
 *
 */
export class FilesProxy extends ZomeProxy {
  static readonly DEFAULT_ZOME_NAME = "zFiles";
  static readonly FN_NAMES = filesFunctionNames;
  static readonly ENTRY_TYPES = Object.values(FilesUnitEnum);
  static readonly LINK_TYPES = Object.values(FilesLinkType);
 
  async attachToHrl(input: AttachInput): Promise<ActionArray> {
    return this.callBlocking('attach_to_hrl', input);
  }

  async getFilesFromHrl(hrl: [DnaArray, EntryArray]): Promise<EntryArray[]> {
    return this.call('get_files_from_hrl', hrl);
  }

  async commitPrivateFile(input: WriteManifestInput): Promise<[EntryArray, ParcelDescription]> {
    return this.call('commit_private_file', input);
  }

  async getAh(eh: EntryArray): Promise<ActionArray | null> {
    return this.call('get_ah', eh);
  }

  async getFileInfo(eh: EntryArray): Promise<ParcelManifest> {
    return this.call('get_file_info', eh);
  }

  async getPrivateFilesFrom(sender: AgentArray): Promise<EntryArray[]> {
    return this.call('get_private_files_from', sender);
  }

  async processInbox(): Promise<void> {
    return this.call('process_inbox', null);
  }

  async publishFileManifest(input: WriteManifestInput): Promise<[EntryArray, ParcelDescription]> {
    return this.callZomeBlockPostCommit('PublicParcel','publish_file_manifest', input);
  }

  async refuseFileShare(parcelEh: EntryArray): Promise<EntryArray> {
    return this.call('refuse_file_share', parcelEh);
  }

  async acceptFileShare(parcelEh: EntryArray): Promise<EntryArray> {
    return this.call('accept_file_share', parcelEh);
  }

  async sendFile(input: SendFileInput): Promise<ActionArray> {
    return this.call('send_file', input);
  }

  async writePrivateFileChunks(chunks: ParcelChunk[]): Promise<EntryArray[]> {
    return this.call('write_private_file_chunks', chunks);
  }

  async writePublicFileChunks(chunks: ParcelChunk[]): Promise<EntryArray[]> {
    return this.call('write_public_file_chunks', chunks);
  }
}

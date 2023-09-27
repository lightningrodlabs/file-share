/* This file is generated by zits. Do not edit manually */

import {FILE_TYPE_NAME, FILE_SHARE_ZOME_NAME, FileShareEntry, WriteManifestInput, SendFileInput, FileShare, } from './file_share.types';
import {
/** types.ts */
HoloHash,
AgentPubKey,
DnaHash,
WasmHash,
EntryHash,
ActionHash,
AnyDhtHash,
ExternalHash,
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

import {
/** Common */
DhtOpHashB64,
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
import {fileShareFunctionNames} from './file_share.fn';

/**
 *
 */
export class FileShareProxy extends ZomeProxy {
  static readonly DEFAULT_ZOME_NAME = "zFileShare"
  static readonly FN_NAMES = fileShareFunctionNames
 

  async commitPrivateFile(input: WriteManifestInput): Promise<[EntryHash, ParcelDescription]> {
    return this.call('commit_private_file', input);
  }

  async getFileInfo(eh: EntryHash): Promise<ParcelManifest> {
    return this.call('get_file_info', eh);
  }

  async getPrivateFiles(): Promise<[EntryHash, ParcelManifest][]> {
    return this.call('get_private_files', null);
  }

  async getLocalPublicFiles(): Promise<[EntryHash, ParcelManifest][]> {
    return this.call('get_local_public_files', null);
  }

  async getPrivateFilesFrom(sender: AgentPubKey): Promise<EntryHash[]> {
    return this.call('get_private_files_from', sender);
  }

  async getUnrepliedNotices(): Promise<[AgentPubKey, EntryHash, number][]> {
    return this.call('get_unreplied_notices', null);
  }

  async probePublicFiles(): Promise<[ParcelReference, Timestamp, AgentPubKey][]> {
    return this.call('probe_public_files', null);
  }

  async processInbox(): Promise<void> {
    return this.call('process_inbox', null);
  }

  async publishFileManifest(input: WriteManifestInput): Promise<[EntryHash, ParcelDescription]> {
    return this.call('publish_file_manifest', input);
  }

  async refuseFileShare(parcelEh: EntryHash): Promise<EntryHash> {
    return this.call('refuse_file_share', parcelEh);
  }

  async acceptFileShare(parcelEh: EntryHash): Promise<EntryHash> {
    return this.call('accept_file_share', parcelEh);
  }

  async sendFile(input: SendFileInput): Promise<ActionHash> {
    return this.call('send_file', input);
  }

  async writePrivateFileChunk(chunk: ParcelChunk): Promise<EntryHash> {
    return this.call('write_private_file_chunk', chunk);
  }

  async writePublicFileChunk(chunk: ParcelChunk): Promise<EntryHash> {
    return this.call('write_public_file_chunk', chunk);
  }
}

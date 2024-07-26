/* This file is generated by zits. Do not edit manually */

import {PUBLIC_TAG_ROOT, TAGGING_ZOME_NAME, TaggingEntry, PrivateTag, TaggingInput, TaggingProperties, UntagInput, } from './tagging.types';
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
type AnyLinkableArray = Uint8Array;

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

import {ZomeProxy} from '@ddd-qc/lit-happ';
import {taggingFunctionNames} from './tagging.fn';
import {TaggingUnitEnum, TaggingLinkType} from './tagging.integrity';

/**
 *
 */
export class TaggingProxy extends ZomeProxy {
  static readonly DEFAULT_ZOME_NAME = "zTagging";
  static readonly FN_NAMES = taggingFunctionNames;
  static readonly ENTRY_TYPES = Object.values(TaggingUnitEnum);
  static readonly LINK_TYPES = Object.values(TaggingLinkType);
 
  async queryAllPrivateTag(): Promise<[EntryArray, Timestamp, string][]> {
    return this.call('query_all_PrivateTag', null);
  }

  async commitPrivateTag(tagValue: string): Promise<EntryArray> {
    return this.callBlocking('commit_private_tag', tagValue);
  }

  async tagPrivateEntry(input: TaggingInput): Promise<void> {
    return this.call('tag_private_entry', input);
  }

  async untagPrivateEntry(input: UntagInput): Promise<void> {
    return this.callBlocking('untag_private_entry', input);
  }

  async findPrivateTagsForEntry(eh: EntryArray): Promise<[EntryArray, string][]> {
    return this.call('find_private_tags_for_entry', eh);
  }

  async findPrivateEntriesWithTag(tag: string): Promise<[EntryArray, string][]> {
    return this.call('find_private_entries_with_tag', tag);
  }

  async probePublicTags(): Promise<[EntryArray, string][]> {
    return this.call('probe_public_tags', null);
  }

  async publishPublicTag(tagValue: string): Promise<EntryArray> {
    return this.callBlocking('publish_public_tag', tagValue);
  }

  async tagPublicEntry(input: TaggingInput): Promise<ActionArray[]> {
    return this.call('tag_public_entry', input);
  }

  async findPublicTagsForEntry(eh: EntryArray): Promise<string[]> {
    return this.call('find_public_tags_for_entry', eh);
  }

  async findPublicEntriesWithTag(tag: string): Promise<[ActionArray, EntryArray, string][]> {
    return this.call('find_public_entries_with_tag', tag);
  }

  async untagPublicEntry(linkAh: ActionArray): Promise<ActionArray> {
    return this.callBlocking('untag_public_entry', linkAh);
  }
}

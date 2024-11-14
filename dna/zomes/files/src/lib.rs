mod callbacks;
mod commit_private_file;
mod get_files;
mod get_private_files_from;
mod process_inbox;
mod send_file;
mod get_unreplied_notices;
mod publish_file_manifest;
mod utils;
mod probe_public_files;
mod write_file_chunk;
mod respond_to_file_notice;
mod get_file_info;
mod attach_to_hrl;
mod get_any_record;

///-------------------------------------------------------------------------------------------------

use hdk::prelude::*;

#[hdk_extern]
fn get_zome_info(_:()) -> ExternResult<ZomeInfo> {
  return zome_info();
}


#[hdk_extern]
fn get_dna_info(_:()) -> ExternResult<DnaInfo> {
  return dna_info();
}


#[hdk_extern]
fn get_record_author(dh: AnyDhtHash) -> ExternResult<AgentPubKey> {
  return zome_utils::get_author(dh);
}

use hdk::prelude::*;
use zome_utils::*;

use zome_delivery_types::*;
use zome_delivery_api::*;
use zome_files_integrity::{FILES_DEFAULT_INTEGRITY_ZOME_NAME, FILE_TYPE_NAME};
use crate::commit_private_file::WriteManifestInput;


/// Public equivalent of commit_private_file()
#[hdk_extern]
#[feature(zits_blocking = "PublicParcel")]
pub fn publish_file_manifest(input: WriteManifestInput) -> ExternResult<(EntryHash, ParcelDescription)> {
    std::panic::set_hook(Box::new(zome_panic_hook));
    let description = ParcelDescription {
        name: input.filename,
        size: input.orig_filesize,
        zome_origin: FILES_DEFAULT_INTEGRITY_ZOME_NAME.into(),
        visibility: EntryVisibility::Public,
        kind_info: ParcelKind::Manifest(format!("{}::{}", FILE_TYPE_NAME, input.filetype)),
    };
    /// Commit Manifest
    let manifest = ParcelManifest {
        data_hash: input.data_hash,
        chunks: input.chunks,
        description: description.clone(),
    };
    let response = call_delivery_zome("publish_manifest", manifest)?;
    let eh: EntryHash = decode_response(response)?;
    /// Done
    return Ok((eh, description));
}

use hdk::prelude::*;
use zome_utils::*;
use zome_files_integrity::*;
use crate::attach_to_hrl::holo_hash::DnaHash;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct AttachInput {
    hrl: (DnaHash, EntryHash),
    manifestEh: EntryHash,
}


/// Link a File From a We HRL
#[hdk_extern]
#[feature(zits_blocking)]
pub fn attach_to_hrl(input: AttachInput) -> ExternResult<ActionHash> {
    std::panic::set_hook(Box::new(zome_panic_hook));
    /// Create Path
    let tp = hrl_path(input.hrl)?;
    tp.ensure()?;
    /// Create link
    let ah = create_link(tp.path_entry_hash()?, input.manifestEh, FilesLinkTypes::Attachment, LinkTag::from(()))?;
    /// Done
    Ok(ah)
}


/// Get File From a HRL link
#[hdk_extern]
pub fn get_files_from_hrl(hrl: (DnaHash, EntryHash)) -> ExternResult<Vec<EntryHash>> {
    std::panic::set_hook(Box::new(zome_panic_hook));
    let tp = hrl_path(hrl)?;
    /// Grab links
    let links = get_links(link_input(tp.path_entry_hash()?, FilesLinkTypes::Attachment, None))?;
    let res = links.into_iter()
        .map(|link| link.target.into_entry_hash().unwrap())
        .collect();
    /// Done
    Ok(res)
}


///
fn hrl_path(hrl: (DnaHash, EntryHash)) -> ExternResult<TypedPath> {
    let mut tp = root_path()?;
    let dnaComp = hash2comp(hrl.0);
    let ehComp = hash2comp(hrl.1);
    tp.path.append_component(dnaComp);
    tp.path.append_component(ehComp);
    Ok(tp)
}


///
fn root_path() -> ExternResult<TypedPath> {
    let tp = Path::from(format!("{}", ATTACHMENTS_ROOT))
        .typed(FilesLinkTypes::Attachment)?;
    Ok(tp)
}

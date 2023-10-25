use hdk::prelude::*;
use zome_utils::*;
use zome_tagging_integrity::*;
use crate::TaggingInput;


fn root_path() -> ExternResult<TypedPath> {
    let tp = Path::from(format!("{}", PUBLIC_TAG_ROOT))
        .typed(TaggingLinkTypes::PublicEntry)?;
    Ok(tp)
}


///
#[hdk_extern]
fn get_all_public_tags(_: ()) -> ExternResult<Vec<(EntryHash, String)>> {
    std::panic::set_hook(Box::new(zome_panic_hook));
    let root_tp = root_path()?;
    let children = tp_children_paths(&root_tp)?;
    debug!("children: {:?}", children);
    let mut tags = Vec::new();
    for child in children {
        let Some(comp) = child.leaf()
            else { return error("No leaf found for public tag")};
        let str = String::try_from(comp)
            .map_err(|e|wasm_error!(SerializedBytesError::Deserialize(e.to_string())))?;
        debug!("tag found: {}", str);
        tags.push((child.path_entry_hash()?, str));
    }
    /// Done
    Ok(tags)
}


/// Return eh to TypedPath
#[hdk_extern]
fn create_public_tag(tag_value: String) -> ExternResult<EntryHash> {
    std::panic::set_hook(Box::new(zome_panic_hook));
    /// Make sure Tag does not already exists
    let public_tags: Vec<String> = get_all_public_tags(())?
        .into_iter()
        .map(|(_, tag)| (tag))
        .collect();
    if public_tags.contains(&tag_value) {
        return error("Public tag already exists");
    }
    /// Make sur tag length is OK
    if let Ok(properties) = get_properties() {
        if tag_value.len() > properties.max_tag_name_length as usize ||
            tag_value.len() < properties.min_tag_name_length as usize {
            return error("Tag length is incorrect.");
        }
    }
    /// Create Path
    let mut tp = root_path()?;
    tp.path.append_component(tag_value.into());
    tp.ensure()?;
    /// Done
    Ok(tp.path_entry_hash()?)
}


///
pub fn get_public_entry(eh: EntryHash) -> ExternResult<Entry> {
    let entry = get_entry_from_eh(eh.clone())?;
    let entry_type = get_entry_type(&entry)?;
    if !entry_type.visibility().is_public() {
        return error("Entry is Private");
    }
    /// Done
    Ok(entry)
}



#[hdk_extern]
fn tag_public_entry(input: TaggingInput) -> ExternResult<()> {
    std::panic::set_hook(Box::new(zome_panic_hook));
    /// Dedup
    let mut tags = input.tags.clone();
    let set: HashSet<_> = tags.drain(..).collect();
    tags.extend(set.into_iter());
    /// Make sure entry exist and is private
    let _entry = get_public_entry(input.target.clone())?;
    /// Grab existing private tags
    let public_tuples = get_all_public_tags(())?;
    let public_tags: Vec<String> = public_tuples.iter()
        .map(|(_, tag)| tag.to_owned())
        .collect();
    /// Link to/from each tag (create PrivateTag entry if necessary)
    for tag in tags {
        let maybe_index = public_tags.iter().position(|r| r == &tag);

        let tag_eh =
            if maybe_index.is_none() {
                let eh = create_public_tag(tag.clone())?;
                eh
            } else {
                let eh = public_tuples[maybe_index.unwrap()].0.clone();
                eh
            }
            ;
        let _ = create_link(tag_eh.clone(), input.target.clone(), TaggingLinkTypes::PublicEntry, str2tag(&input.link_tag_to_entry.clone()))?;
        let _ = create_link( input.target.clone(), tag_eh, TaggingLinkTypes::PublicTags, str2tag(&tag))?;
    }
    Ok(())
}


///
#[hdk_extern]
pub fn get_public_tags(eh: EntryHash) -> ExternResult<Vec<String>> {
    std::panic::set_hook(Box::new(zome_panic_hook));
    /// Make sure entry exist and is private
    let _ = get_public_entry(eh.clone())?;
    /// Grab private tags
    let links = get_links(eh, TaggingLinkTypes::PrivateTags, None)?;
    let res = links.into_iter()
        .map(|link| (tag2str(&link.tag).unwrap()))
        .collect();
    /// Done
    Ok(res)
}


///
#[hdk_extern]
pub fn get_public_entries_with_tag(tag: String) -> ExternResult<Vec<(EntryHash, String)>> {
    std::panic::set_hook(Box::new(zome_panic_hook));
    /// Form path
    let mut tp = root_path()?;
    tp.path.append_component(tag.into());
    /// Grab entries
    //let links = tp_children(&tp)?;
    let links = get_links(tp.path_entry_hash()?, TaggingLinkTypes::PublicEntry, None)?;
    let res = links.into_iter()
        .map(|link| (link.target.into_entry_hash().unwrap(), tag2str(&link.tag).unwrap()))
        .collect();
    /// Done
    Ok(res)
}

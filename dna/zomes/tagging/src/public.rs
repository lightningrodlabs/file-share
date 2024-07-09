use hdk::prelude::*;
use zome_utils::*;
use zome_signals::*;
use zome_tagging_integrity::*;
use crate::TaggingInput;


fn root_path() -> ExternResult<TypedPath> {
    let tp = Path::from(format!("{}", PUBLIC_TAG_ROOT))
        .typed(TaggingLinkTypes::PublicPath)?;
    Ok(tp)
}


///
#[hdk_extern]
fn probe_public_tags(_: ()) -> ExternResult<Vec<(EntryHash, String)>> {
    std::panic::set_hook(Box::new(zome_panic_hook));
    let root_tp = root_path()?;
    let links = tp_children(&root_tp)?;
    let children = links_to_paths(&root_tp, links.clone())?;
    debug!("children_links: {:?}", links);
    debug!("children: {:?}", children);
    let mut tags = Vec::new();
    for child in children {
        let Some(comp) = child.leaf()
            else { return error("No leaf found for public tag")};
        let str = String::try_from(comp)
            .map_err(|e| wasm_error!(SerializedBytesError::Deserialize(e.to_string())))?;
        debug!("tag found: {}", str);
        tags.push((child.path_entry_hash()?, str));
    }
    /// Signal
    emit_links_signal(links)?;
    /// Done
    Ok(tags)
}


/// Return eh to TypedPath
#[hdk_extern]
#[feature(zits_blocking)]
fn publish_public_tag(tag_value: String) -> ExternResult<EntryHash> {
    std::panic::set_hook(Box::new(zome_panic_hook));
    /// Make sure Tag does not already exists
    for (eh, tag) in probe_public_tags(())? {
        if tag == tag_value {
            return Ok(eh);
        }
    }
    /// Make sur tag length is OK
    if let Ok(properties) = get_properties() {
        if tag_value.len() > properties.max_tag_name_length as usize ||
            tag_value.len() < properties.min_tag_name_length as usize {
            return zome_error!("Tag length is incorrect.");
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
pub fn fetch_public_entry(eh: EntryHash) -> ExternResult<Entry> {
    let entry = get_entry_from_eh(eh.clone())?;
    let entry_type = get_entry_type(&entry)?;
    if !entry_type.visibility().is_public() {
        return error("Entry is Private");
    }
    /// Done
    Ok(entry)
}



#[hdk_extern]
fn tag_public_entry(input: TaggingInput) -> ExternResult<Vec<ActionHash>> {
    std::panic::set_hook(Box::new(zome_panic_hook));
    debug!("tag_public_entry() {:?}", input.clone());
    /// Dedup
    let mut tags = input.tags.clone();
    let set: HashSet<_> = tags.drain(..).collect();
    tags.extend(set.into_iter());
    /// Make sure entry exist and is public
    let _entry = fetch_public_entry(input.target.clone())?;
    /// Grab existing public tags
    let public_tuples = probe_public_tags(())?;
    let public_tags: Vec<String> = public_tuples.iter()
        .map(|(_, tag)| tag.to_owned())
        .collect();
    /// Link to/from each tag (create PublicTag entry if necessary)
    let mut link_ahs = Vec::new();
    for tag in tags {
        let maybe_index = public_tags.iter().position(|r| r == &tag);

        let tag_eh =
            if maybe_index.is_none() {
                let eh = publish_public_tag(tag.clone())?;
                eh
            } else {
                let eh = public_tuples[maybe_index.unwrap()].0.clone();
                eh
            }
            ;
        let ah = create_link_relaxed(tag_eh.clone(), input.target.clone(), TaggingLinkTypes::PublicEntry, str2tag(&input.link_tag_to_entry.clone()))?;
        let _ = create_link_relaxed( input.target.clone(), tag_eh, TaggingLinkTypes::PublicTags, str2tag(&tag))?;
        link_ahs.push(ah);
    }
    Ok(link_ahs)
}



///
#[hdk_extern]
pub fn find_public_tags_for_entry(eh: EntryHash) -> ExternResult<Vec<String>> {
    std::panic::set_hook(Box::new(zome_panic_hook));
    /// Make sure entry exist and is public
    let _ = fetch_public_entry(eh.clone())?;
    /// Grab public tags
    let link_details = get_link_details(eh, TaggingLinkTypes::PublicTags, None, GetOptions::network())?;
    let create_links: Vec<Link> = link_details.into_inner().into_iter()
      .map(|(create_sah, maybe_deletes)| {
          if maybe_deletes.len() > 0 {
              return None;
          }
          let Action::CreateLink(create) = create_sah.hashed.content.clone()
            else { panic!("get_link_details() should return a CreateLink Action")};
          let link = link_from_create(create_sah.action_address().to_owned(), &create);
          Some(link)
      })
      .flatten()
      .collect();
    let tags = create_links.iter()
      .map(|link| tag2str(&link.tag).unwrap())
      .collect();
    /// Signal
    emit_links_signal(create_links)?;
    /// Done
    Ok(tags)
}


///
#[hdk_extern]
pub fn find_public_entries_with_tag(tag: String) -> ExternResult<Vec<(ActionHash, EntryHash, String)>> {
    std::panic::set_hook(Box::new(zome_panic_hook));
    /// Form path
    let mut tp = root_path()?;
    tp.path.append_component(tag.into());
    /// Grab entries
    let link_details = get_link_details(tp.path_entry_hash()?, TaggingLinkTypes::PublicEntry, None, GetOptions::network())?;
    let mut create_links = Vec::new();
    let mut delete_links = Vec::new();
    for (create_sah, maybe_deletes) in link_details.into_inner() {
        let Action::CreateLink(create) = create_sah.hashed.content.clone()
          else { panic!("get_link_details() should return a CreateLink Action")};
        if maybe_deletes.len() > 0 {
            let Action::DeleteLink(delete) = maybe_deletes[0].hashed.content.clone()
              else { panic!("get_link_details() should return a CreateLink Action")};
            let delete_link = link_from_delete(&delete, &create);
            delete_links.push(delete_link);
        } else {
            let create_link = link_from_create(create_sah.action_address().to_owned(), &create);
            create_links.push(create_link);
        }
    }
    /// Signal
    emit_links_signal(create_links.clone())?;
    for delete in delete_links {
        emit_link_signal(delete, StateChange::Delete(false))?;
    }
    /// Into tags
    let tags = create_links.clone().into_iter()
      .map(|link| (link.create_link_hash, link.target.into_entry_hash().unwrap(), tag2str(&link.tag).unwrap()))
      .collect();
    /// Done
    Ok(tags)
}


// ///
// #[hdk_extern]
// pub fn find_public_tags_for_entry(eh: EntryHash) -> ExternResult<Vec<String>> {
//     std::panic::set_hook(Box::new(zome_panic_hook));
//     /// Make sure entry exist and is public
//     let _ = fetch_public_entry(eh.clone())?;
//     /// Grab public tags
//     let links = get_links(link_input(eh, TaggingLinkTypes::PublicTags, None))?;
//     let res = links.clone().into_iter()
//       .map(|link| (tag2str(&link.tag).unwrap()))
//       .collect();
//     /// Signal
//     emit_links_signal(links)?;
//     /// Done
//     Ok(res)
// }


// ///
// #[hdk_extern]
// pub fn find_public_entries_with_tag(tag: String) -> ExternResult<Vec<(ActionHash, EntryHash, String)>> {
//     std::panic::set_hook(Box::new(zome_panic_hook));
//     /// Form path
//     let mut tp = root_path()?;
//     tp.path.append_component(tag.into());
//     /// Grab entries
//     let links = get_links(link_input(tp.path_entry_hash()?, TaggingLinkTypes::PublicEntry, None))?;
//     let res = links.clone().into_iter()
//         .map(|link| (link.create_link_hash, link.target.into_entry_hash().unwrap(), tag2str(&link.tag).unwrap()))
//         .collect();
//     /// signal
//     emit_links_signal(links)?;
//     /// Done
//     Ok(res)
// }


/// link_ah: PublicEntry create link action hash
#[hdk_extern]
#[feature(zits_blocking)]
fn untag_public_entry(link_ah: ActionHash) -> ExternResult<ActionHash> {
    std::panic::set_hook(Box::new(zome_panic_hook));
    debug!("untag_public_entry() {}", link_ah);
    /// Grab create_link
    let Some(record) = get(link_ah.clone(), GetOptions::network())?
        else { return zome_error!("No link found at given hash")};
    let Action::CreateLink(create_link) = record.signed_action.action()
      else { return zome_error!("No CreateLink found at given hash")};
    /// Grab reverse link
    let links = get_links(link_input(create_link.target_address.clone(), TaggingLinkTypes::PublicTags, None))?;
    let mut maybe_reverse_link_ah = None;
    debug!("untag_public_entry() reverse links: {:?} | target: {}", links, create_link.target_address.clone());
    for link in links {
        if link.target == create_link.base_address {
            maybe_reverse_link_ah = Some(link.create_link_hash);
            break;
        }
    }
    let Some(reverse_link_ah) = maybe_reverse_link_ah
      else { return zome_error!("Reverse link not found")};
    /// Delete both
    let ah = delete_link_relaxed(link_ah)?;
    let _ = delete_link_relaxed(reverse_link_ah)?;
    // Done
    Ok(ah)
}

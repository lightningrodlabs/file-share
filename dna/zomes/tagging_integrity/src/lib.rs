#![allow(non_upper_case_globals)]
#![allow(unused_doc_comments)]
#![allow(non_camel_case_types)]
#![allow(non_snake_case)]
#![allow(unused_attributes)]

mod properties;

pub use properties::*;

//--------------------------------------------------------------------------------------------------


use hdi::prelude::*;

pub const TAGGING_ZOME_NAME: &str = "tagging_integrity";
pub const PUBLIC_TAG_ROOT: &str = "public_tags";



/// Integrity zome is not really necessary but it is defined because the holochain ecosystem
/// does not support well a zome that does not have one.

#[hdk_entry_defs]
#[unit_enum(TaggingEntryTypes)]
pub enum TaggingEntry {
   #[entry_def(required_validations = 2, visibility = "private")]
   PrivateTag(PrivateTag),
}


///
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct PrivateTag {
   pub value: String,
}


#[hdk_link_types]
#[derive(Serialize, Deserialize)]
pub enum TaggingLinkTypes {
   PublicEntry,
   PrivateEntry,
   PublicTags,
   PrivateTags,
}

#![allow(non_upper_case_globals)]
#![allow(unused_doc_comments)]
#![allow(non_camel_case_types)]
#![allow(non_snake_case)]
#![allow(unused_attributes)]

mod private;
pub use private::*;

mod public;
pub use public::*;


//--------------------------------------------------------------------------------------------------

use hdk::prelude::*;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, SerializedBytes)]
pub struct TaggingInput {
    tags: Vec<String>,
    target: EntryHash,
    link_tag_to_entry: String, // Base64 string of data
}


#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, SerializedBytes)]
pub struct UntagInput {
    tag: String,
    target: EntryHash,
}


/// Zome Callback
//#[hdk_extern(infallible)]
//fn post_commit(signedActionList: Vec<SignedActionHashed>) {
//    debug!("TAGGING post_commit() called for {} actions", signedActionList.len());
//    //std::panic::set_hook(Box::new(zome_panic_hook));
//    /// Process each Action
//    for sah in signedActionList {
//        debug!(" - {}", sah.action());
//    }
//}

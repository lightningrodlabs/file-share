mod private;
mod public;
mod callbacks;

pub use public::*;
pub use private::*;

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


///// Zome Callback
//#[hdk_extern(infallible)]
//fn post_commit(signedActionList: Vec<SignedActionHashed>) {
//    debug!("TAGGING post_commit() called for {} actions", signedActionList.len());
//    //std::panic::set_hook(Box::new(zome_panic_hook));
//    /// Process each Action
//    for sah in signedActionList {
//        debug!(" - {}", sah.action());
//    }
//}

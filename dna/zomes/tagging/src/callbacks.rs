use hdk::prelude::*;
use zome_utils::*;
use zome_signals::*;
use zome_tagging_integrity::*;

///
#[hdk_extern]
pub fn init(_: ()) -> ExternResult<InitCallbackResult> {
   let _ = create_signal_cap_grant()?;
   Ok(InitCallbackResult::Pass)
}


///
#[hdk_extern(infallible)]
pub fn post_commit(signedActionList: Vec<SignedActionHashed>) {
   debug!("ProfilesAlt post_commit() called for {} actions. ({})", signedActionList.len(), zome_info().unwrap().id);
   std::panic::set_hook(Box::new(zome_panic_hook));
   emit_post_commit::<TaggingEntry, TaggingLinkTypes>(signedActionList);
}

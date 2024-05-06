use hdk::prelude::*;
use zome_delivery_api::*;


///
#[hdk_extern]
fn init(_: ()) -> ExternResult<InitCallbackResult> {
   Ok(InitCallbackResult::Pass)
}



/// Zome Callback
#[hdk_extern(infallible)]
fn post_commit(signedActionList: Vec<SignedActionHashed>) {
   debug!("FILES post_commit() called for {} actions", signedActionList.len());
   let res = call_delivery_post_commit(signedActionList);
   if let Err(e) = res {
      debug!("delivery_post_commit() failed: {:?}", e);
   }
}

use hdk::prelude::*;
use zome_utils::*;

use zome_delivery_types::*;
use zome_delivery_api::*;


/// Return list of parcels' EntryHash from a particular Agent
#[hdk_extern]
pub fn get_private_files_from(sender: AgentPubKey) -> ExternResult<Vec<EntryHash>> {
    debug!("get_files_from() START: {:?}", sender);
    let response = call_delivery_zome("pull_inbox", ())?;
    let inbox_items: Vec<ActionHash> = decode_response(response)?;
    debug!("get_files_from() - inbox_items: {}", inbox_items.len());
    debug!("get_files_from() - query_DeliveryNotice");
    let response = call_delivery_zome(
        "query_DeliveryNotice",
        DeliveryNoticeQueryField::Sender(sender),
    )?;
    let notices: Vec<DeliveryNotice> = decode_response(response)?;
    let parcels: Vec<EntryHash> = notices.iter().map(|x| x.summary.parcel_reference.parcel_eh.clone()).collect();
    debug!("get_files_from() END - secret parcels found: {}", parcels.len());
    Ok(parcels)
}


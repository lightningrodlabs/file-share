// use hdk::prelude::*;
// use zome_utils::*;
//
// use zome_delivery_types::*;
// use zome_delivery_api::*;
// use zome_files_integrity::*;
//
// /// Return ehs of all Notices waiting for a response
// #[hdk_extern]
// pub fn get_unreplied_notices(_:()) -> ExternResult<Vec<(AgentPubKey, EntryHash, u64)>> {
//     std::panic::set_hook(Box::new(zome_panic_hook));
//     let mut res = Vec::new();
//     let response = call_delivery_zome("query_all_DeliveryNotice", ())?;
//     let all_notices: Vec<(EntryHash, Timestamp, DeliveryNotice)> = decode_response(response)?;
//     debug!("all_notices.len = {}", all_notices.len());
//     for (notice_eh, _ts, notice) in all_notices {
//         let ParcelKind::Manifest(data_type) = notice.summary.parcel_reference.description.kind_info
//             else { continue };
//         if data_type != FILE_TYPE_NAME {
//             continue;
//         }
//         let response = call_delivery_zome("get_notice_state", notice_eh.clone())?;
//         let (state, _pct): (NoticeState, usize) = decode_response(response)?;
//         if state != NoticeState::Unreplied {
//             continue;
//         }
//         res.push((notice.sender, notice_eh, notice.summary.parcel_reference.description.size));
//     }
//     debug!("END");
//     return Ok(res);
// }

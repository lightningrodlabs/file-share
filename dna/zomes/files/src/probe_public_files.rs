// use hdk::prelude::*;
// use zome_utils::*;
//
// use zome_delivery_types::*;
// use zome_delivery_api::*;
// use crate::utils::ensure_parcel_is_file;
//
//
// /// Wrapper for pull_public_parcels()
// #[hdk_extern]
// pub fn probe_public_files(_:()) -> ExternResult<Vec<(ParcelReference, Timestamp, AgentPubKey)>> {
//     std::panic::set_hook(Box::new(zome_panic_hook));
//     let response = call_delivery_zome("pull_public_parcels", ())?;
//     let prs: Vec<(ParcelReference, Timestamp, AgentPubKey)> = decode_response(response)?;
//     debug!("files found: {}", prs.len());
//     let mut file_manifests = Vec::new();
//     for (pr, ts, author) in &prs {
//         ///Make sure manifest exists and is of File type.
//         if let Ok(()) = ensure_parcel_is_file(&pr.description) {
//             file_manifests.push((pr.clone(), ts, author));
//         }
//     }
//     Ok(prs)
// }

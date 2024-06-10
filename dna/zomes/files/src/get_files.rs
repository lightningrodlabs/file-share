// use hdk::prelude::*;
// use zome_utils::*;
//
// use zome_delivery_types::*;
// use zome_delivery_api::*;
// use crate::utils::ensure_parcel_is_file;


// /// Return ehs of all ParcelManifest for type FILE_TYPE_NAME
// #[hdk_extern]
// pub fn get_private_files(_:()) -> ExternResult<Vec<(EntryHash, ParcelManifest)>> {
//     std::panic::set_hook(Box::new(zome_panic_hook));
//     let response = call_delivery_zome("get_all_private_manifests", ())?;
//     let manifests: Vec<(EntryHash, ParcelManifest)> = decode_response(response)?;
//     debug!("get_private_files() manifests found: {}", manifests.len());
//     let mut file_manifests = Vec::new();
//     for (eh, manifest) in manifests {
//         ///Make sure manifest exists and is of File type.
//         if let Ok(()) = ensure_parcel_is_file(&manifest.description) {
//             file_manifests.push((eh, manifest));
//         }
//     }
//     Ok(file_manifests)
// }
//
//
// /// Return ehs of all ParcelManifest for type FILE_TYPE_NAME
// #[hdk_extern]
// pub fn get_local_public_files(_:()) -> ExternResult<Vec<(EntryHash, ParcelManifest)>> {
//     std::panic::set_hook(Box::new(zome_panic_hook));
//     let response = call_delivery_zome("get_all_local_public_manifests", ())?;
//     let manifests: Vec<(EntryHash, ParcelManifest)> = decode_response(response)?;
//     debug!("get_local_public_files() manifests found: {}", manifests.len());
//     let mut file_manifests = Vec::new();
//     for (eh, manifest) in manifests {
//         ///Make sure manifest exists and is of File type.
//         if let Ok(()) = ensure_parcel_is_file(&manifest.description) {
//             file_manifests.push((eh, manifest));
//         }
//     }
//     Ok(file_manifests)
// }



use hdk::prelude::*;
use zome_utils::*;

use zome_delivery_types::*;
use zome_delivery_api::*;
use crate::utils::ensure_parcel_is_file;

///
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct SendFileInput {
    pub manifest_eh: EntryHash,
    pub strategy: DistributionStrategy,
    pub recipients: Vec<AgentPubKey>,
}

/// Wrapper for distribute_parcel()
/// Return Distribution ActionHash
#[hdk_extern]
pub fn send_file(input: SendFileInput) -> ExternResult<ActionHash> {
    std::panic::set_hook(Box::new(zome_panic_hook));
    debug!("START {:?}", input.manifest_eh);
    debug!("zome_names: {:?}", dna_info()?.zome_names);
    debug!("zome_index: {:?}", zome_info()?.id);
    debug!(" zome_name: {:?}", zome_info()?.name);

    ///Make sure manifest exists and is of File type.
    let manifest: ParcelManifest = get_typed_from_eh(input.manifest_eh.clone())?;
    ensure_parcel_is_file(&manifest.description)?;

    /// Form Parcel Reference
    let parcel_reference = ParcelReference {
        parcel_eh: input.manifest_eh,
        description: manifest.description,
    };
    /// Form distribute input
    let distribute_input = DistributeParcelInput {
        recipients: input.recipients,
        strategy: input.strategy,
        parcel_reference,
    };
    /// Distribute
    debug!("calling distribute_parcel() with: {:?}", distribute_input);
    let response = call_delivery_zome("distribute_parcel", distribute_input)?;
    let ah: ActionHash = decode_response(response)?;
    debug!("END");
    Ok(ah)
}

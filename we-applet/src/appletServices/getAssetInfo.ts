
import {asCellProxy, wrapPathInSvg} from "@ddd-qc/we-utils";
import {AppClient} from "@holochain/client";
import {FILES_DEFAULT_ROLE_NAME, FilesProxy} from "@ddd-qc/files";
import {intoDhtId, pascal} from "@ddd-qc/cell-proxy";
import {DELIVERY_INTERGRITY_ZOME_NAME, DeliveryEntryType} from "@ddd-qc/delivery";
import {mdiFileOutline} from "@mdi/js";
import {AssetInfo, WAL} from "@lightningrodlabs/we-applet/dist/types";
import {RecordInfo} from "@lightningrodlabs/we-applet";


/** */
export async function getAssetInfo(
    appletClient: AppClient,
    wal: WAL,
    recordInfo?: RecordInfo,
): Promise<AssetInfo | undefined> {
    console.log("Files/we-applet/getAssetInfo():", wal, recordInfo);
    if (!recordInfo) {
        throw new Error(`Files/we-applet/getAssetInfo(): Missing recordInfo`);
    }
    if (recordInfo.roleName != FILES_DEFAULT_ROLE_NAME) {
        throw new Error(`Files/we-applet/getAssetInfo(): Unknown role name '${recordInfo.roleName}'.`);
    }
    if (recordInfo.integrityZomeName != DELIVERY_INTERGRITY_ZOME_NAME) {
        throw new Error(`Files/we-applet/getAssetInfo(): Unknown zome '${recordInfo.integrityZomeName}'.`);
    }

    const mainAppInfo = await appletClient.appInfo();
    if (!mainAppInfo) {
        throw Promise.reject("No main appInfo found");
    }

    const pEntryType = pascal(recordInfo.entryType);

    console.log("Files/we-applet/getAssetInfo(): pEntryType", pEntryType);
    switch (pEntryType) {
        case DeliveryEntryType.PrivateManifest:
        case DeliveryEntryType.PublicManifest:
            console.log("Files/we-applet/getAssetInfo(): pp info", wal);
            const cellProxy = await asCellProxy(
                appletClient,
                undefined, // hrl[0],
                mainAppInfo.installed_app_id,
                FILES_DEFAULT_ROLE_NAME);
            console.log("Files/we-applet/getAssetInfo(): cellProxy?", !!cellProxy);
            const proxy/*: FilesProxy */ = new FilesProxy(cellProxy);
            console.log("Files/we-applet/getAssetInfo(): getFile()", intoDhtId(wal.hrl[1]), proxy);
            const manifest = await proxy.getFileInfo(wal.hrl[1]);
            console.log("Files/we-applet/getAssetInfo(): file", manifest.description);
            return {
                icon_src: wrapPathInSvg(mdiFileOutline),
                name: manifest.description.name,
            };
        break;
        default:
            throw new Error(`Files/we-applet/getAssetInfo(): Unknown entry type ${recordInfo.entryType}.`);
    }
}





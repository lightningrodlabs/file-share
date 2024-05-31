import {createDefaultWeServicesMock, DevTestNames, AssetViewInfo, setupDevtest} from "@ddd-qc/we-utils";
import {FILES_DEFAULT_ROLE_NAME} from "@ddd-qc/files";
import {ActionHash, EntryHash, fakeActionHash} from "@holochain/client";
import {emptyEntryAppletView} from "@ddd-qc/we-utils/dist/mocks/renderInfoMock";
import {snake} from "@ddd-qc/cell-proxy";
import {createFilesApplet, ViewFileContext} from "./createFilesApplet";
import {DELIVERY_INTERGRITY_ZOME_NAME, DeliveryEntryType} from "@ddd-qc/delivery";
import {AppletView} from "@lightningrodlabs/we-applet";

export const devtestNames: DevTestNames = {
    installed_app_id: "Files",
    provisionedRoleName: FILES_DEFAULT_ROLE_NAME,
}

//----------------------------------------------------------------------------------------------------------------------
// Block Views
//----------------------------------------------------------------------------------------------------------------------

// export type BlockViewInfo = {
//     type: "block";
//     block: string;
//     context: any;
// }

/** */
export function setupFilesBlockView(blockName: string) {
    const context: ViewFileContext = {
        detail: "none",
    }
    const appletView = {
        type: "block",
        block: blockName,
        context,
    } as AppletView;
    return setupDevtest(createFilesApplet, devtestNames, createDefaultWeServicesMock, appletView);
}


//----------------------------------------------------------------------------------------------------------------------
// Entry Views
//----------------------------------------------------------------------------------------------------------------------

/** */
export async function setupFilesEntryView() {
    console.log("setupFilesEntryView()");
    const context: ViewFileContext = {
        detail: "none",
    }
    const appletView = createManifestEntryRenderInfo(await fakeActionHash(), context);
    return setupDevtest(createFilesApplet, devtestNames, createDefaultWeServicesMock, appletView);
}


/** */
function createManifestEntryRenderInfo(eh: EntryHash, context: ViewFileContext): AssetViewInfo {
    const entryInfo = emptyEntryAppletView as AssetViewInfo;
    entryInfo.recordInfo = {
        roleName: FILES_DEFAULT_ROLE_NAME,
        integrityZomeName: DELIVERY_INTERGRITY_ZOME_NAME,
        entryType: snake(DeliveryEntryType.PublicManifest),
    };
    entryInfo.wal.hrl[1] = eh;
    entryInfo.wal.context = context;

    return entryInfo;
}

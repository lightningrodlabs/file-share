import {setup, wrapPathInSvg} from "@ddd-qc/we-utils";
import {createFilesApplet} from "./createFilesApplet";
import {AppletServices} from "@lightningrodlabs/we-applet";
import {getAssetInfo} from "./appletServices/getAssetInfo";
import {blockTypes} from "./appletServices/blockTypes";
import {DeliveryEntryType} from "@ddd-qc/delivery";
import {devtestNames, setupFilesEntryView} from "./devtest";
import {search} from "./appletServices/search";
import {AppAgentClient, RoleName, ZomeName} from "@holochain/client";
import {WAL} from "@lightningrodlabs/we-applet/dist/types";
import {mdiFileOutline} from "@mdi/js";


/** */
export async function setupFilesApplet() {
    /** Determine appletView */
    let APPLET_VIEW = "main";
    try {
        APPLET_VIEW = process.env.APPLET_VIEW;
        //console.log(`HAPP_ENV defined by process.ENV: "${happEnv}"`);
    } catch (e) {
    }
    console.log("Files we-applet setup() APPLET_VIEW", APPLET_VIEW);
    switch(APPLET_VIEW) {
        /** Entry views */
        case DeliveryEntryType.PrivateManifest:
        case DeliveryEntryType.PublicManifest: return setupFilesEntryView();
        ///** Block views */
        //case FilesBlockType.PickFile:
        //case FilesBlockType.ImportFile: return setupFilesBlockView(APPLET_VIEW);
        /** Main View */
        case "main":
        default: return setupFilesMainView();
    }
}


/** */
async function setupFilesMainView() {
    const appletServices: AppletServices = {
        creatables: {
            file: {
                label: "File",
                icon_src: wrapPathInSvg(mdiFileOutline),
            }
        },
        blockTypes,
        getAssetInfo,
        search,
        bindAsset,
    };

    return setup(appletServices, createFilesApplet, devtestNames);
}



/** */
export async function bindAsset(
  appletClient: AppAgentClient,
  srcWal: WAL,
  dstWal: WAL,
  dstRoleName: RoleName,
  dstIntegrityZomeName: ZomeName,
  dstEntryType: string,
): Promise<void> {
    /* FIXME */
}

export default setupFilesApplet;

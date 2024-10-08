import {setup, wrapPathInSvg} from "@ddd-qc/we-utils";
import {createFilesApplet} from "./createFilesApplet";
import {AppletServices, RecordInfo, WAL} from "@theweave/api";
import {getAssetInfo} from "./appletServices/getAssetInfo";
import {blockTypes} from "./appletServices/blockTypes";
import {DeliveryEntryType} from "@ddd-qc/delivery";
import {devtestNames, setupFilesEntryView} from "./devtest";
import {search} from "./appletServices/search";
import {AppClient} from "@holochain/client";
import {mdiFileOutline} from "@mdi/js";


/** */
export async function setupFilesApplet() {
    /** Determine appletView */
    let APPLET_VIEW = "main";
    try {
        APPLET_VIEW = process.env.APPLET_VIEW!;
        //console.log(`HAPP_ENV defined by process.ENV: "${happEnv}"`);
    } catch (e:any) {
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
  _appletClient: AppClient,
  _srcWal: WAL,
  _dstWal: WAL,
  _dstRecordInfo?: RecordInfo,
): Promise<void> {
    /* FIXME */
}

export default setupFilesApplet;

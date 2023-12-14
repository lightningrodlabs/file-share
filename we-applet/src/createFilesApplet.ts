import {
  AppAgentWebsocket, encodeHashToBase64,
} from "@holochain/client";
//import { msg } from "@lit/localize";

import {
  RenderInfo,
  WeServices,
} from "@lightningrodlabs/we-applet";

//import "@holochain-open-dev/profiles/dist/elements/profiles-context.js";
//import "@lightningrodlabs/we-applet/dist/elements/we-client-context.js";
//import "@lightningrodlabs/we-applet/dist/elements/hrl-link.js";


import {FilesApp} from "@files/app";
import {AppletViewInfo, ProfilesApi} from "@ddd-qc/we-utils";
import {ExternalAppProxy} from "@ddd-qc/cell-proxy/";
import {destructureCloneId, HCL} from "@ddd-qc/lit-happ";



export interface ViewFileContext {
  detail: string,
}


/** */
export async function createFilesApplet(
  renderInfo: RenderInfo,
  weServices: WeServices,
): Promise<FilesApp> {

  if (renderInfo.type =="cross-applet-view") {
    throw Error("cross-applet-view not implemented by Files");
  }

  const appletViewInfo = renderInfo as unknown as AppletViewInfo;
  const profilesClient = appletViewInfo.profilesClient;

  console.log("createFilesApplet() client", appletViewInfo.appletClient);
  console.log("createFilesApplet() thisAppletId", appletViewInfo.appletHash);

  const mainAppInfo = await appletViewInfo.appletClient.appInfo();

  console.log("createFilesApplet() mainAppInfo", mainAppInfo, encodeHashToBase64(mainAppInfo.agent_pub_key));

  //const showFileOnly = false; // FIXME

  /** Determine profilesAppInfo */
  const mainAppAgentWs = appletViewInfo.appletClient as AppAgentWebsocket;
  const mainAppWs = mainAppAgentWs.appWebsocket;
  let profilesAppInfo = await profilesClient.client.appInfo();
  console.log("createFilesApplet() profilesAppInfo", profilesAppInfo, encodeHashToBase64(mainAppInfo.agent_pub_key));
  /** Check if roleName is actually a cloneId */
  let maybeCloneId = undefined;
  let baseRoleName = profilesClient.roleName;
  const maybeBaseRoleName = destructureCloneId(profilesClient.roleName);
  if (maybeBaseRoleName) {
    baseRoleName = maybeBaseRoleName[0];
    maybeCloneId = profilesClient.roleName;
  }
  /** Determine profilesCellProxy */
  const hcl = new HCL(profilesAppInfo.installed_app_id, baseRoleName, maybeCloneId);
  const profilesApi = new ProfilesApi(profilesClient);
  const profilesAppProxy = new ExternalAppProxy(profilesApi, 10 * 1000);
  await profilesAppProxy.fetchCells(profilesAppInfo.installed_app_id, baseRoleName);
  const profilesCellProxy = await profilesAppProxy.createCellProxy(hcl);
  console.log("createFilesApplet() profilesCellProxy", profilesCellProxy);
  /** Create FilesApp */
  const app = await FilesApp.fromWe(
    mainAppWs, undefined, false, mainAppInfo.installed_app_id,
    profilesAppInfo.installed_app_id, baseRoleName, maybeCloneId, profilesClient.zomeName, profilesAppProxy,
    weServices, appletViewInfo.appletHash, appletViewInfo.view, appletViewInfo.groupProfiles);
  console.log("createFilesApplet() app", app);
  /** Done */
  return app;

}

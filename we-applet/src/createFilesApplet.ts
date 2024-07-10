import {
  AppWebsocket,
} from "@holochain/client";
//import { msg } from "@lit/localize";
import {
  RenderInfo,
  WeaveServices,
} from "@lightningrodlabs/we-applet";
import {FilesApp} from "@files/app";
import {AppletViewInfo, ProfilesApi} from "@ddd-qc/we-utils";
import {ExternalAppProxy} from "@ddd-qc/cell-proxy/";
import {destructureCloneId, HCL} from "@ddd-qc/lit-happ";
import {AgentId, EntryId} from "@ddd-qc/cell-proxy";


export interface ViewFileContext {
  detail: string,
}


/** */
export async function createFilesApplet(
  renderInfo: RenderInfo,
  weServices: WeaveServices,
): Promise<FilesApp> {

  if (renderInfo.type =="cross-applet-view") {
    throw Error("cross-applet-view not implemented by Files");
  }

  const appletViewInfo = renderInfo as unknown as AppletViewInfo;
  const profilesClient = appletViewInfo.profilesClient;

  console.log("createFilesApplet() client", appletViewInfo.appletClient);
  console.log("createFilesApplet() thisAppletId", appletViewInfo.appletHash);

  const mainAppInfo = await appletViewInfo.appletClient.appInfo();
  const agentId = new AgentId(mainAppInfo.agent_pub_key);
  console.log("createFilesApplet() mainAppInfo", mainAppInfo, agentId);

  //const showFileOnly = false; // FIXME

  /** Determine profilesAppInfo */
  const mainAppWs = appletViewInfo.appletClient as AppWebsocket;
  //const mainAppWs = mainAppAgentWs.appWebsocket;
  let profilesAppInfo = await profilesClient.client.appInfo();
  console.log("createFilesApplet() profilesAppInfo", profilesAppInfo, agentId);
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
  console.log("createFilesApplet() profilesApi", profilesApi);
  const profilesAppProxy = new ExternalAppProxy(profilesApi, 10 * 1000);
  console.log("createFilesApplet() profilesAppProxy", profilesAppProxy);
  await profilesAppProxy.fetchCells(profilesAppInfo.installed_app_id, baseRoleName);
  const profilesCellProxy = await profilesAppProxy.createCellProxy(hcl);
  console.log("createFilesApplet() profilesCellProxy", profilesCellProxy);
  /** Create FilesApp */
  const app = await FilesApp.fromWe(
    mainAppWs, undefined, false, mainAppInfo.installed_app_id,
    profilesAppInfo.installed_app_id, baseRoleName, maybeCloneId, profilesClient.zomeName, profilesAppProxy,
    weServices, new EntryId(appletViewInfo.appletHash), appletViewInfo.view, appletViewInfo.groupProfiles);
  console.log("createFilesApplet() app", app);
  /** Done */
  return app;

}

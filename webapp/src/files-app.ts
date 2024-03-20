import {html, css, render} from "lit";
import {property, state, customElement} from "lit/decorators.js";
import {ContextProvider} from "@lit/context";
import {
  AdminWebsocket,
  AgentPubKeyB64,
  AppWebsocket,
  DnaDefinition, encodeHashToBase64, EntryHash,
  InstalledAppId,
  ZomeName
} from "@holochain/client";
import {
  HvmDef, HappElement, HCL, Cell,
  BaseRoleName,
  CloneId,
  AppProxy,
  DvmDef, DnaViewModel, pascal, delay
} from "@ddd-qc/lit-happ";
import {
  FilesDvm,
  FILES_DEFAULT_ROLE_NAME, ProfileInfo,
} from "@ddd-qc/files";
import {HC_ADMIN_PORT, HC_APP_PORT} from "./globals";
import {AppletId, AppletView, GroupProfile, WeServices} from "@lightningrodlabs/we-applet";
import {ProfilesDvm} from "@ddd-qc/profiles-dvm";
import {AttachableViewInfo} from "@ddd-qc/we-utils";
import {DELIVERY_INTERGRITY_ZOME_NAME, DELIVERY_ZOME_NAME, DeliveryEntryType} from "@ddd-qc/delivery";
import {buildBlock} from "./files-blocks";
import {DEFAULT_FILES_DEF} from "./happDef";
import {setLocale} from "./localization";
import { localized, msg, str } from '@lit/localize';

import "./elements/files-main-view"
import "@ddd-qc/files";
import {createContext} from "@lit/context";

const weClientContext = createContext<WeServices>('we_client');


/**
 *
 */
@customElement("files-app")
export class FilesApp extends HappElement {

  /** -- Fields -- */

  static readonly HVM_DEF: HvmDef = DEFAULT_FILES_DEF;

  @state() private _hasHolochainFailed = true;
  @state() private _loaded = false;
  @state() private _hasWeProfile = false;
  @state() private _offlinePerspectiveloaded = false;
  @state() private _onlinePerspectiveloaded = false;
  //@state() private _filesCell: Cell;
  /** ZomeName -> (AppEntryDefName, isPublic) */
  //private _allAppEntryTypes: Record<string, [string, boolean][]> = {};
  //private _dnaDef?: DnaDefinition;


  /** All arguments should be provided when constructed explicity */
  constructor(appWs?: AppWebsocket, private _adminWs?: AdminWebsocket, private _canAuthorizeZfns?: boolean, readonly appId?: InstalledAppId, public appletView?: AppletView) {
    super(appWs ? appWs : HC_APP_PORT, appId);
    console.log("FilesApp.HVM_DEF", FilesApp.HVM_DEF);
    if (_canAuthorizeZfns == undefined) {
      this._canAuthorizeZfns = true;
    }
    //const worker = new WebWorker();
    //worker.postMessage({type: 'init', args: 'This instance was created in a worker'});
  }


  /** -- We-applet specifics -- */

  private _weProfilesDvm?: ProfilesDvm;
  protected _weProvider?: unknown; // FIXME type: ContextProvider<this.getContext()> ?

  public appletId?: AppletId;
  public groupProfiles?: GroupProfile[];
  // protected _attachmentsProvider?: unknown;

  /**  */
  static async fromWe(
      appWs: AppWebsocket,
      adminWs: AdminWebsocket,
      canAuthorizeZfns: boolean,
      appId: InstalledAppId,
      profilesAppId: InstalledAppId,
      profilesBaseRoleName: BaseRoleName,
      profilesCloneId: CloneId | undefined,
      profilesZomeName: ZomeName,
      profilesProxy: AppProxy,
      weServices: WeServices,
      thisAppletHash: EntryHash,
      //showEntryOnly?: boolean,
      appletView: AppletView,
      groupProfiles: GroupProfile[],
  ) : Promise<FilesApp> {
    const app = new FilesApp(appWs, adminWs, canAuthorizeZfns, appId, appletView);
    /** Provide it as context */
    console.log(`\t\tProviding context "${weClientContext}" | in host `, app);
    //app.weServices = weServices;
    app._weProvider = new ContextProvider(app, weClientContext, weServices);
    app.appletId = encodeHashToBase64(thisAppletHash);
    app.groupProfiles = groupProfiles;
    /** Create Profiles Dvm from provided AppProxy */
    console.log("<files-app>.ctor()", profilesProxy);
    await app.createWeProfilesDvm(profilesProxy, profilesAppId, profilesBaseRoleName, profilesCloneId, profilesZomeName);
    return app;
  }


  /** Create a Profiles DVM out of a different happ */
  async createWeProfilesDvm(profilesProxy: AppProxy, profilesAppId: InstalledAppId, profilesBaseRoleName: BaseRoleName,
                            profilesCloneId: CloneId | undefined,
                            _profilesZomeName: ZomeName): Promise<void> {
    const profilesAppInfo = await profilesProxy.appInfo({installed_app_id: profilesAppId});
    const profilesDef: DvmDef = {ctor: ProfilesDvm, baseRoleName: profilesBaseRoleName, isClonable: false};
    const cell_infos = Object.values(profilesAppInfo.cell_info);
    console.log("createProfilesDvm() cell_infos:", cell_infos);
    /** Create Profiles DVM */
        //const profilesZvmDef: ZvmDef = [ProfilesZvm, profilesZomeName];
    const dvm: DnaViewModel = new profilesDef.ctor(this, profilesProxy, new HCL(profilesAppId, profilesBaseRoleName, profilesCloneId));
    console.log("createProfilesDvm() dvm", dvm);
    console.log("createProfilesDvm() profilesAppInfo", profilesAppInfo);
    await this.setupWeProfilesDvm(dvm as ProfilesDvm);
  }


  /** */
  async setupWeProfilesDvm(dvm: ProfilesDvm): Promise<void> {
    this._weProfilesDvm = dvm as ProfilesDvm;
    /** Load My profile */
    //const maybeProfiles = await this._weProfilesDvm.profilesZvm.zomeProxy.getAgentsWithProfile();
    //const maybeAgents = maybeProfiles.map((eh) => encodeHashToBase64(eh));
    //console.log("maybeAgents", maybeAgents);
    const maybeMyProfile = await this._weProfilesDvm.profilesZvm.probeProfile(dvm.profilesZvm.cell.agentPubKey);
    console.log("setupWeProfilesDvm() maybeMyProfile", maybeMyProfile);
    if (maybeMyProfile) {
      const maybeLang = maybeMyProfile.fields['lang'];
      if (maybeLang) {
        console.log("Setting locale from We Profile", maybeLang);
        setLocale(maybeLang);
      }
      this._hasWeProfile = true;
    }
    // else {
    //   /** Create Guest profile */
    //   const profile = { nickname: "guest_" + Math.floor(Math.random() * 100), fields: {}};
    //   console.log("setupWeProfilesDvm() createMyProfile", this.filesDvm.profilesZvm.cell.agentPubKey);
    //   await this.filesDvm.profilesZvm.createMyProfile(profile);
    // }
  }


  /** QoL */
  get filesDvm(): FilesDvm { return this.hvm.getDvm(FilesDvm.DEFAULT_BASE_ROLE_NAME)! as FilesDvm }


  /** -- Methods -- */


  /** */
  async hvmConstructed() {
    console.log("hvmConstructed()", this._adminWs, this._canAuthorizeZfns)
    /** Authorize all zome calls */
    if (!this._adminWs && this._canAuthorizeZfns) {
      this._adminWs = await AdminWebsocket.connect({url: new URL(`ws://localhost:${HC_ADMIN_PORT}`)});
      console.log("hvmConstructed() connect() called", this._adminWs);
    }
    if (this._adminWs && this._canAuthorizeZfns) {
      await this.hvm.authorizeAllZomeCalls(this._adminWs);
      console.log("*** Zome call authorization complete");
    } else {
      if (!this._canAuthorizeZfns) {
        console.warn("No adminWebsocket provided (Zome call authorization done)")
      } else {
        console.log("Zome call authorization done externally")
      }
    }

    /** Attempt Probe EntryDefs */
    let attempts = 5;
    while(this._hasHolochainFailed && attempts > 0) {
      attempts -= 1;
      const allAppEntryTypes = await this.filesDvm.fetchAllEntryDefs();
      console.log("happInitialized(), allAppEntryTypes", allAppEntryTypes);
      console.log(`${DELIVERY_ZOME_NAME} entries`, allAppEntryTypes[DELIVERY_ZOME_NAME]);
      if (allAppEntryTypes[DELIVERY_ZOME_NAME].length == 0) {
        console.warn(`No entries found for ${DELIVERY_ZOME_NAME}`);
        await delay(1000);
      } else {
        this._hasHolochainFailed = false;
        break;
      }
    }

    /** Done */
    this._loaded = true;
  }


  /** */
  async perspectiveInitializedOffline(): Promise<void> {
    console.log("<files-app>.perspectiveInitializedOffline()");
    const maybeProfile = await this.filesDvm.profilesZvm.probeProfile(this.filesDvm.cell.agentPubKey);
    console.log("perspectiveInitializedOffline() maybeProfile", maybeProfile, this.filesDvm.cell.agentPubKey);
    /** Done */
    this._offlinePerspectiveloaded = true;
  }


  /** */
  async perspectiveInitializedOnline(): Promise<void> {
    console.log("<files-app>.perspectiveInitializedOnline()");
    if (this.appletView && this.appletView.type == "main") {
      await this.hvm.probeAll();
    }
    this._onlinePerspectiveloaded = true;
  }


  /** */
  render() {
    console.log("*** <files-app> render()", this._loaded, this._hasHolochainFailed);

    if (!this._loaded || !this._offlinePerspectiveloaded || !this._onlinePerspectiveloaded) {
      return html`<sl-spinner></sl-spinner>`;
    }
    if(this._hasHolochainFailed) {
      return html`<div style="width: auto; height: auto; font-size: 4rem;">
          ${msg("Failed to connect to Holochain Conductor and/or \"Files\" cell.")};
      </div>`;
    }


    //console.log({coordinator_zomes: this._dnaDef?.coordinator_zomes})
    //const zomeNames = this._dnaDef?.coordinator_zomes.map((zome) => { return zome[0]; });
    //console.log({zomeNames});

    let view = html`<files-main-view .appletId=${this.appletId} .groupProfiles=${this.groupProfiles}></files-main-view>`;

    if (this.appletView) {
      switch (this.appletView.type) {
        case "main":
          break;
        case "block":
          const blockViewInfo = this.appletView as any;
          view = buildBlock(this, blockViewInfo);
          break;
        case "attachable":
          const attachableViewInfo = this.appletView as AttachableViewInfo;
          if (attachableViewInfo.roleName != FILES_DEFAULT_ROLE_NAME) {
            throw new Error(`Files/we-applet: Unknown role name '${attachableViewInfo.roleName}'.`);
          }
          if (attachableViewInfo.integrityZomeName != DELIVERY_INTERGRITY_ZOME_NAME) {
            throw new Error(`Files/we-applet: Unknown zome '${attachableViewInfo.integrityZomeName}'.`);
          }
          const entryType = pascal(attachableViewInfo.entryType);
          console.log("pascal entryType", entryType);
          switch (entryType) {
            case DeliveryEntryType.PrivateManifest:
            case DeliveryEntryType.PublicManifest:
              console.log("File entry:", encodeHashToBase64(attachableViewInfo.hrlWithContext.hrl[1]));

              // // TODO: Figure out why cell-context doesn't propagate normally via FilesApp and has to be inserted again within the slot
              // view = html`
              //   <cell-context .cell=${this.filesDvm.cell}>
              //     <file-view .hash=${encodeHashToBase64(hrl[1])}></file-view>
              //   </cell-context>
              // `;

              view = html`<file-view .hash=${encodeHashToBase64(attachableViewInfo.hrlWithContext.hrl[1])} style="height: 100vh;"></file-view>`;
            break;
            default:
              throw new Error(`Unknown entry type ${entryType}.`);
            }
          break;
        default:
          console.error("We applet-view type:", this.appletView);
          throw new Error(`Unknown We applet-view type`);
      }
    }


    /** Import profile from We */
    let guardedView = view;
    const maybeMyProfile = this.filesDvm.profilesZvm.getMyProfile();
    console.log("<files-app> Profile", this._hasWeProfile, maybeMyProfile);
    if(!maybeMyProfile) {
      if (this._hasWeProfile) {
        guardedView = html`
          <div
              style="display:flex; flex-direction:column; align-items:center; justify-content:center; flex:1; padding-bottom: 10px;margin:auto: min-width:400px;">
            <h1 style="font-family: arial;color: #5804A8;"><img src="assets/icon.png" width="32" height="32"
                                                                style="padding-left: 5px;padding-top: 5px;"/> Files</h1>
            <div class="column" style="align-items: center;">
              <sl-card style="box-shadow: rgba(0, 0, 0, 0.19) 0px 10px 20px, rgba(0, 0, 0, 0.23) 0px 6px 6px;">
                <div style="margin-bottom: 24px; align-self: flex-start; font-size: 20px;">
                  ${msg('Import Profile into Files applet')}
                </div>
                <files-edit-profile
                    .profile=${this._weProfilesDvm.profilesZvm.getMyProfile()}
                    @save-profile=${async (e: CustomEvent<ProfileInfo>) => {
                      await this.filesDvm.profilesZvm.createMyProfile(e.detail.profile);
                      this.requestUpdate();
                    }}
                    @lang-selected=${(e: CustomEvent) => {
                      console.log("set locale", e.detail);
                      setLocale(e.detail)
                    }}
                ></files-edit-profile>
              </sl-card>
            </div>
          </div>`;
      } else {
        /** Create Guest profile */
        const profile = { nickname: "guest_" + Math.floor(Math.random() * 100),
          fields: {lang: 'en', email: 'guest@ac.me', mailgun_domain: "mg.flowplace.org", mailgun_email: "whosin@mg.flowplace.org"}};
        console.log("setupWeProfilesDvm() createMyProfile", this.filesDvm.profilesZvm.cell.agentPubKey);
        this.filesDvm.profilesZvm.createMyProfile(profile).then(() => this.requestUpdate());
        guardedView = html`<sl-spinner></sl-spinner>`;
      }
    }

    /* render all */
    return html`
      <cell-context .cell="${this.filesDvm.cell}">
        <!-- <view-cell-context></view-cell-context> -->
        ${guardedView}
      </cell-context>        
    `
  }

  /** */
  static get styles() {
    return [
      css`
        :host {
          display: block;
          height: inherit;
        }
          
        sl-spinner {
            font-size: 3rem;
            position: fixed;
            top: 50%;
            left: 50%;
            --track-width: 4px;
        }
      `]

  }
}

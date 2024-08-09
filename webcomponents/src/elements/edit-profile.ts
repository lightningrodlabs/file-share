import { css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { localized, msg, str } from '@lit/localize';
import { onSubmit, sharedStyles } from '@holochain-open-dev/elements';

import '@holochain-open-dev/elements/dist/elements/select-avatar.js';
import {Profile as ProfileMat} from "@ddd-qc/profiles-dvm";
import {HAPP_BUILD_MODE, ZomeElement} from "@ddd-qc/lit-happ";
import {FilesZvm} from "../viewModels/files.zvm";


const MIN_NICKNAME_LENGTH = 2


export interface ProfileInfo {
  profile: ProfileMat,
  mailgun_token: string,
}

/**
 * @fires save-profile - Fired when the save profile button is clicked
 */
@localized()
@customElement('files-edit-profile')
export class EditProfile extends ZomeElement<unknown, FilesZvm> {

  /** */
  constructor() {
    super(FilesZvm.DEFAULT_ZOME_NAME)
  }

  /** The profile to be edited. */
  @property({ type: Object })
  profile: ProfileMat | undefined;


  @state() _mailgun_token = '';


  /** -- Methods -- */

  /**
   * Seperate Mailgun token from other fields as we don't want it to be saved in Profiles
   */
  async fireSaveProfile(formFields: Record<string, string>) {
    console.log("fireSaveProfile()", formFields);
    const nickname = formFields['nickname'];
    delete formFields['nickname'];
    if (!nickname) {
      throw Promise.reject("Missing nickname field");
    }

    const fields: Record<string, string> = {};
    //fields['email'] = formFields['email'];
    fields['avatar'] = formFields['avatar']? formFields['avatar'] : "";
    fields['lang'] = formFields['option']? formFields['option'] : "";
    // fields['mailgun_domain'] = formFields['mailgun_domain']? formFields['mailgun_domain'] : "";
    // fields['mailgun_email'] = formFields['mailgun_email']? formFields['mailgun_email'] : "";
    //
    // /** encrypt mailgun_token */
    let mailgun_token = '';
    // if (formFields['mailgun_token'] && formFields['mailgun_token'] != "") {
    //   console.log("fireSaveProfile() encrypting mailgun token");
    //   mailgun_token = formFields['mailgun_token'];
    //   const utf8 = new TextEncoder().encode(formFields['mailgun_token']);
    //   const encrypt = await this._zvm.zomeProxy.encryptData(utf8) as any;
    //   const mailgun_token_b64 = Base64.fromUint8Array(encrypt.encrypted_data, true);
    //   fields['mailgun_token'] = mailgun_token_b64;
    //   fields['mailgun_token_nonce'] = Base64.fromUint8Array(encrypt.nonce, true);
    //   console.log("fireSaveProfile() encrypting mailgun token done", fields['mailgun_token_nonce'], encrypt.nonce);
    //   const unnonce = Base64.toUint8Array(fields['mailgun_token_nonce']);
    //   console.log("fireSaveProfile() encrypting mailgun token done", unnonce);
    // }

    const profile: ProfileMat = {
      fields,
      nickname,
    };

    /** */
    this.dispatchEvent(
      new CustomEvent<ProfileInfo>('save-profile', {
        detail: {
          profile,
          mailgun_token,
        },
        bubbles: true,
        composed: true,
      })
    );

  }


  /** */
  async handleLangChange(_e: any) {
    //console.log({langChangeEvent: e});
    const langRadioGroup = this.shadowRoot!.getElementById("langRadioGroup") as any;
    console.log({langRadioGroup});
    const lang = langRadioGroup.value;
    console.log("handleLangChange: lang =", lang);
    this.dispatchEvent(new CustomEvent('lang-selected', { detail: lang, bubbles: true, composed: true }));
  }


  /** */
  override render() {
    console.log("<edit-profile>.render()", this.profile);

    // /** decrypt token */
    // if (this.profile.fields['mailgun_token'] && this.profile.fields['mailgun_token'] != "" && this._mailgun_token == '') {
    //   console.log("<edit-profile>.render() decrypt mailgun token", this.profile.fields['mailgun_token_nonce'])
    //   const encrypted_data = Base64.toUint8Array(this.profile.fields['mailgun_token']);
    //   let nonce = Base64.toUint8Array(this.profile.fields['mailgun_token_nonce']);
    //   console.log("<edit-profile>.render() decrypt mailgun token nonce", nonce);
    //   const wtf = { nonce, encrypted_data }
    //   try {
    //     this._zvm.zomeProxy.decryptData(wtf).then((data) => {
    //       this._mailgun_token = new TextDecoder().decode(data)
    //     });
    //   } catch(e:any) {
    //     console.error("Failed to decryptData()", e);
    //   }
    // }

    /** */
    return html`
      <form id="profile-form" class="column"
        ${onSubmit(fields => /*await*/ this.fireSaveProfile(fields))}>
          
        <div class="row"
          style="justify-content: center; align-self: start; margin-bottom: 16px; width: 100%;">
          <select-avatar
                  style="cursor:pointer"
                  name="avatar"
                .value=${this.profile?.fields['avatar'] || undefined}
              ></select-avatar>
          <sl-input
            name="nickname"
            .label=${msg('Nickname')}
            required
            minLength="${MIN_NICKNAME_LENGTH}"
            .value=${this.profile?.nickname || ''}
            .helpText=${msg(str`Min. ${MIN_NICKNAME_LENGTH} characters`)}
            style="margin-left: 16px;"
          ></sl-input>
            <div style="flex-grow:1;"></div>
            ${HAPP_BUILD_MODE == 'Debug'? html`<sl-tooltip .content=${this.cell.address.agentId.b64}><sl-icon name="hash" style="font-size: 24px;"></sl-icon></sl-tooltip>` : html``}
        </div>
        
        <div class="row" style="justify-content: center; margin-bottom: 8px; align-self: start;" >
          <span style="font-size:18px;padding-right:10px;">${msg('Language')}:</span>
          <sl-radio-group id="langRadioGroup" @click="${this.handleLangChange}" .value=${this.profile? this.profile.fields['lang'] : ""}>
            <sl-radio value="en">🇬🇧</sl-radio>
            <sl-radio value="fr-fr">🇫🇷</sl-radio>
          </sl-radio-group>
        </div>

        <div class="row" style="margin-top: 8px;">
          <sl-button style="flex: 1;" variant="primary" type="submit"
            >${msg('Save Profile')}
          </sl-button>
        </div>
      </form>
    `;
  }


  static override styles = [sharedStyles, css`

    sl-radio {
      font-size: larger;
    }
    .small-margin {
      margin-top: 6px;
    }
    .big-margin {
      margin-top: 23px;
    }

    .fill {
      flex: 1;
      height: 100%;
    }

    .title {
      font-size: 20px;
    }

    .center-content {
      align-items: center;
      justify-content: center;
    }

    .placeholder {
      color: rgba(0, 0, 0, 0.7);
    }

    .label {
      color: var(--mdc-text-field-label-ink-color, rgba(0, 0, 0, 0.6));
      font-family: var(
              --mdc-typography-caption-font-family,
              var(--mdc-typography-font-family, Roboto, sans-serif)
      );
      font-size: var(--mdc-typography-caption-font-size, 0.79rem);
      font-weight: var(--mdc-typography-caption-font-weight, 400);
    }

    .flex-scrollable-parent {
      position: relative;
      display: flex;
      flex: 1;
    }

    .flex-scrollable-container {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
    }

    .flex-scrollable-x {
      max-width: 100%;
      overflow-x: auto;
    }
    .flex-scrollable-y {
      max-height: 100%;
      overflow-y: auto;
    }`];
}

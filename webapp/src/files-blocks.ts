import {TemplateResult, /*html*/} from "lit";
import {FilesApp} from "./files-app";

/** */
export enum FilesBlockType {
     StoreFile = "StoreFile",
     PickFile = "PickFile",
}

// export interface PickFileContext {
//     hrl: Hrl,
//     type: string,
// }


export /*async*/ function buildBlock(happElem: FilesApp, blockViewInfo: any): TemplateResult<1> {
    //await happElem.filesDvm.probeAll();
    /*const deliveryPerspective =*/ happElem.filesDvm.deliveryZvm.perspective;
    switch (blockViewInfo.block) {
         case FilesBlockType.StoreFile:
        //     return html`
        //         <button @click=${(e:any) => {
        //             const storeDialogElem = happElem.shadowRoot.querySelector("store-dialog") as StoreDialog;
        //             storeDialogElem.open(false);
        //         }}>Add Public file</button>
        //         <button @click=${(e:any) => {
        //             const storeDialogElem = happElem.shadowRoot.querySelector("store-dialog") as StoreDialog;
        //             storeDialogElem.open(true);
        //         }}>Add Private file</button>
        //         <store-dialog></store-dialog>
        //     `;
        //     break;
        case FilesBlockType.PickFile:
        //     console.log("Files Block: deliveryPerspective", deliveryPerspective);
        //     const pickFileContext = blockViewInfo.context as PickFileContext;
        //     console.log("Files Block: pickFileContext", pickFileContext);
        //     const privateItems = Object.entries(deliveryPerspective.privateManifests)
        //         .map(([ppEh, [pm, timestamp]]) => {
        //             return {
        //                 ppEh,
        //                 description: pm.description,
        //                 timestamp,
        //                 author: this.cell.agentPubKey,
        //                 isLocal: true,
        //                 isPrivate: true
        //             } as FileTableItem;
        //         });
        //     const publicItems = Object.entries(deliveryPerspective.publicParcels)
        //         .map(([ppEh, [description, timestamp, author]]) => {
        //             const isLocal = !!this.deliveryPerspective.localPublicManifests[ppEh];
        //             return {ppEh, description, timestamp, author, isLocal, isPrivate: false} as FileTableItem;
        //         });
        //     const allItems = privateItems.concat(publicItems);
        //     console.log("Files Block: allItems", allItems);
        //     return html`
        //         <h2>Select File</h2>
        //         <file-table selectable
        //                 .items=${allItems}
        //                 @selected${async (e:any) => {
        //                     console.log("PickFile Block: File selected", e);
        //                     const input = {
        //                         hrl: pickFileContext.hrl,
        //                         manifestEh: e.detail,
        //                     }
        //                     await happElem.filesDvm.fileShareZvm.zomeProxy.attachToHrl(input);
        //                     // TODO: weServices.closeBlock();
        //                 }}
        //         ></file-table>
        //     `;
        //     break;
        default:
            throw new Error(`Unknown Block request "${blockViewInfo.block}"`);
    }
}

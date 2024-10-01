import {
    AppClient,
    Timestamp
} from "@holochain/client";
import {AppletHash, WAL} from "@theweave/api";
import {WeaveServices} from "@theweave/api";
import {asCellProxy} from "@ddd-qc/we-utils";
import {FILES_DEFAULT_ROLE_NAME, FilesProxy} from "@ddd-qc/files";
import {ParcelDescription, ParcelManifest, ParcelReference} from "@ddd-qc/delivery";
import {AgentId, EntryId} from "@ddd-qc/cell-proxy";

// /** */
// export interface FilesSearchContext {
//     isPrivate: boolean
//     author: AgentPubKeyB64,
//     description: ParcelDescription,
// }


/** Return EntryHashs of Manifests whose name match the search filter */
export async function search(appletClient: AppClient, appletHash: AppletHash, weServices: WeaveServices, searchFilter: string): Promise<Array<WAL>> {
    console.log("Files/we-applet/search():", searchFilter);
    const searchLC = searchFilter.toLowerCase();

    /** Get Cell proxy */
    const mainAppInfo = await appletClient.appInfo();
    const appletInfo = await weServices.appletInfo(appletHash);
    if (!mainAppInfo || !appletInfo) {
        throw Promise.reject("No main appInfo found");
    }

    const cellProxy = await asCellProxy(
        appletClient,
        undefined,
        mainAppInfo.installed_app_id,
        FILES_DEFAULT_ROLE_NAME);
    console.log("Files/we-applet/search(): cellProxy", !!cellProxy);
    const proxy/*: FilesProxy */ = new FilesProxy(cellProxy);

    /** Search Private Files */
    const privateFiles: [EntryId, ParcelManifest][] = []; // FIXME: await proxy.getPrivateFiles();
    const matchingPrivate: [EntryId, ParcelDescription, AgentId, boolean][] = privateFiles
        .filter(([_eh, manifest]) => manifest.description.name.toLowerCase().includes(searchLC))
        .map(([eh, manifest]) => [eh, manifest.description, proxy.cell.address.agentId, true]);

    //console.log("Files/we-applet/search(): privateFiles", matchingPrivate.length, privateFiles.length);


    /** Search Public Files */
    const publicFiles: [ParcelReference, Timestamp, AgentId][] = []; // FIXME: await proxy.pullPublicFiles();
    const matchingPublic: [EntryId, ParcelDescription, AgentId, boolean][] = publicFiles
        .filter(([ref, _, _author]) => ref.description.name.toLowerCase().includes(searchLC))
        .map(([ref, _, author]) => [new EntryId(ref.parcel_eh), ref.description, author, false]);

    //console.log("Files/we-applet/search(): publicFiles", matchingPublic.length, publicFiles.length);


    /** Merge the two lists */
    const concat = matchingPublic.concat(matchingPrivate);

    /** Transform results into WAL */
    const results: Array<WAL> = concat
        .map(([eh, description, author, isPrivate]) => { return {
            hrl: [appletInfo.groupsHashes[0]!, eh.hash],
            context: {
                subjectName: description.name,
                subjectType: "File",
                subjectAuthor: author.b64,
                size: description.size,
                isPrivate,
            }
        }})

    console.log("Files/we-applet/search(): results", results.length);

    /** Done */
    return results;
}

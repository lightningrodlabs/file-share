/* This file is generated by zits. Do not edit manually */

import {ZomeName, FunctionName} from '@holochain/client';


/** Array of all zome function names in "fileShare" */
export const fileShareFunctionNames: FunctionName[] = [
	"entry_defs", 
	"get_zome_info", 
	"get_dna_info",

	"commit_private_file",
	"get_private_files",
	"get_local_public_files",
	"get_private_files_from",
	"get_unreplied_notices",
	"probe_files",
	"process_inbox",
	"publish_file_manifest",
	"refuse_file_share",
	"accept_file_share",
	"send_file",
	"write_private_file_chunk",
	"write_public_file_chunk",];


/** Generate tuple array of function names with given zomeName */
export function generateFileShareZomeFunctionsArray(zomeName: ZomeName): [ZomeName, FunctionName][] {
   const fns: [ZomeName, FunctionName][] = [];
   for (const fn of fileShareFunctionNames) {
      fns.push([zomeName, fn]);
   }
   return fns;
}


/** Tuple array of all zome function names with default zome name "zFileShare" */
export const fileShareZomeFunctions: [ZomeName, FunctionName][] = generateFileShareZomeFunctionsArray("zFileShare");

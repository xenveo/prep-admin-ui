/** Candidate management backed by the admin API. */
import { download, queryString, request } from "@/lib/api/client";
import type { CandidateDetail, CandidateList, CandidateQuery, CsvExport, InviteBatchInput, InviteBatchResult, InviteRow, InviteRowInput, InviteSummary, SavedFilter } from "@/lib/types";
const id = encodeURIComponent;
const json = (method:string, body?:unknown):RequestInit => ({method,...(body !== undefined ? {body:JSON.stringify(body)} : {})});
export function listCandidates(query:CandidateQuery = {}):Promise<CandidateList> {
  const {sort, ...filters}=query;
  return request(`/admin/candidates${queryString({...filters, sort:sort?.columnId, dir:sort?.direction})}`);
}
export const getCandidate = (candidateId:string):Promise<CandidateDetail> => request(`/admin/candidates/${id(candidateId)}`);
export const validateInviteRows = (rows:InviteRowInput[]):Promise<{rows:InviteRow[];summary:InviteSummary}> => request("/admin/invites/validate",json("POST",{rows}));
export const getInviteContext = ():Promise<{approvedRoleNames:string[];draftRoleNames:string[];existingEmails:string[]}> => request("/admin/invites/context");
export const inviteCandidates = (batch:InviteBatchInput):Promise<InviteBatchResult> => request("/admin/invites",json("POST",batch));
export const resendInvite = (candidateIds:string[]):Promise<{resent:number;skipped:number}> => request("/admin/invites/resend",json("POST",{candidateIds}));
export const revokeInvite = (candidateId:string):Promise<void> => request(`/admin/candidates/${id(candidateId)}/revoke-invite`,json("POST"));
export const deactivateCandidates = (ids:string[]):Promise<{deactivated:number;skipped:number}> => request("/admin/candidates/deactivate",json("POST",{ids}));
export const reactivateCandidates = (ids:string[]):Promise<{reactivated:number}> => request("/admin/candidates/reactivate",json("POST",{ids}));
export const assignRoles = (ids:string[],roleIds:string[]):Promise<{added:number}> => request("/admin/candidates/assign-roles",json("POST",{ids,roleIds}));
export const removeRole = (candidateId:string,roleId:string):Promise<void> => request(`/admin/candidates/${id(candidateId)}/roles/${id(roleId)}`,json("DELETE"));
export async function exportCandidatesCsv(ids:string[]):Promise<CsvExport> {
 const file=await download(`/admin/candidates/export.csv${queryString({ids})}`); return {filename:"candidates.csv",csv:await file.text()};
}
export const listSavedFilters = ():Promise<SavedFilter[]> => request("/admin/saved-filters");
export const saveFilter = (label:string,query:CandidateQuery):Promise<SavedFilter> => request("/admin/saved-filters",json("POST",{label,query}));
/** Downloadable example format only; never used as application data. */
export const sampleInviteCsv = () => ({fileName:"invite-template.csv",text:"email,name,roles\ncandidate@example.com,Candidate Name,Approved Role Name\n"});

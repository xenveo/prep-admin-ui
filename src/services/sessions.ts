import { request, resolveApiUrl } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import type { EvaluationFlag, FlagInput, SessionReview } from "@/lib/types";
const id=encodeURIComponent;
export async function getSessionReview(candidateId:string,sessionId:string):Promise<SessionReview> {
 const review=await request<SessionReview>(`/admin/candidates/${id(candidateId)}/sessions/${id(sessionId)}`);
 return {...review,questions:review.questions.map(q=>({...q,tries:q.tries?.map(t=>({...t,audioUrl:t.audioUrl?resolveApiUrl(t.audioUrl):null}))}))};
}
export const submitFlag = (input:FlagInput):Promise<EvaluationFlag> => request(`/admin/sessions/${id(input.sessionId)}/flags`,{method:"POST",body:JSON.stringify(input)});
export const listFlags = (sessionId:string):Promise<EvaluationFlag[]> => request(`/admin/sessions/${id(sessionId)}/flags`);
export const resolveFlag = (flagId:string,resolution:string):Promise<EvaluationFlag> => request(`/admin/flags/${id(flagId)}`,{method:"PATCH",body:JSON.stringify({status:"resolved",resolution})});
export const flagDateLabel = (flag:EvaluationFlag):string => formatDate(flag.createdAt);

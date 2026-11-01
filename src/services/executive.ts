import { queryString, request } from "@/lib/api/client";
import type {
  ExecutiveOverview,
  ExecutiveCandidates,
  ExecutiveInsights,
} from "@/lib/api/executive-contracts";

export type ExecutiveQuery = { period: string; roleId?: string };
export type ExecutiveCandidateQuery = ExecutiveQuery & {
  recruiterId?: string;
  search?: string;
  page: number;
  pageSize: number;
};
const base = "/admin/reports/executive";
export const getExecutiveOverview = (
  query: ExecutiveQuery,
): Promise<ExecutiveOverview> => request(`${base}${queryString(query)}`);
export const getExecutiveCandidates = (
  query: ExecutiveCandidateQuery,
): Promise<ExecutiveCandidates> =>
  request(`${base}/candidates${queryString(query)}`);
export const getExecutiveInsights = (
  query: ExecutiveQuery,
): Promise<ExecutiveInsights> =>
  request(`${base}/insights${queryString(query)}`);

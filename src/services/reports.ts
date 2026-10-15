import { download, queryString, request } from "@/lib/api/client";
import { DIMENSION_IDS, DIMENSION_LABEL, type CsvExport, type DimensionId, type Report, type ReportQuery } from "@/lib/types";
export function weakestDimension(avgs:Record<DimensionId,number>) { const id=DIMENSION_IDS.reduce((worst,d)=>avgs[d]<avgs[worst]?d:worst,DIMENSION_IDS[0]); return {id,label:DIMENSION_LABEL[id],value:avgs[id]}; }
export const getReport = (query:ReportQuery):Promise<Report> => request(`/admin/reports${queryString(query)}`);
export async function exportReportCsv(query:ReportQuery):Promise<CsvExport> { const file=await download(`/admin/reports/export.csv${queryString(query)}`); return {filename:"report.csv",csv:await file.text()}; }

import { getAppInfo } from "@/domains/dashboard/api/getAppInfo";
import { QUERY_KEYS, useApiQuery } from "@/shared/query";

export function useAppInfo() {
  return useApiQuery({ queryKey: QUERY_KEYS.app.info(), queryFn: getAppInfo, staleTime: Infinity, retry: false });
}

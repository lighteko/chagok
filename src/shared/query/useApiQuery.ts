import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

export function useApiQuery<TData, TError = Error>(options: UseQueryOptions<TData, TError>) {
  return useQuery({ ...options, initialData: options.initialData ?? undefined });
}

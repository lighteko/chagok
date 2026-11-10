import { useInfiniteQuery, type InfiniteData, type UseInfiniteQueryOptions } from "@tanstack/react-query";

export function useApiInfiniteQuery<TPage, TPageParam, TError = Error>(
  options: UseInfiniteQueryOptions<TPage, TError, InfiniteData<TPage, TPageParam>, readonly unknown[], TPageParam>,
) {
  return useInfiniteQuery(options);
}

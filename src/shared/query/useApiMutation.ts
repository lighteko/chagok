import { useMutation, type UseMutationOptions } from "@tanstack/react-query";

export function useApiMutation<TData = unknown, TVariables = void, TError = Error, TContext = unknown>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>,
) {
  return useMutation(options);
}

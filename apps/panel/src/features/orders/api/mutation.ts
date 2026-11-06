import { useMutation, useQueryClient } from "@tanstack/react-query"

/** A change to an order; the order lists and the dashboard read again once it settles. */
export function useOrderMutation<T, R = unknown>(run: (input: T) => Promise<R>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: run,
    // Settled, not only succeeded: a step that half-failed must not leave the page stale
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: ["orders"] })
      await client.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

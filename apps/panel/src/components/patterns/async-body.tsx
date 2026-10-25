import type { UseQueryResult } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { errorText } from "@/lib/errors"
import { cn } from "@/lib/utils"
import { ErrorState } from "./states"

interface AsyncBodyProps<T> {
  query: UseQueryResult<T>
  /** Shaped like the content, so nothing jumps when it arrives. */
  skeleton: ReactNode
  children: (data: T) => ReactNode
  className?: string
}

/**
 * A card's three states (docs/06): skeleton, error with retry, content.
 * While a new period loads, the previous content stays, dimmed (dataviz:
 * refetch keeps the frame).
 */
export function AsyncBody<T>({ query, skeleton, children, className }: AsyncBodyProps<T>) {
  const { t } = useTranslation()
  if (query.isPending) {
    return (
      <div aria-busy="true" className={className}>
        {skeleton}
      </div>
    )
  }
  if (query.isError) {
    return <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
  }
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col transition-opacity duration-[var(--duration-base)]",
        query.isPlaceholderData && "opacity-60",
        className
      )}
    >
      {children(query.data)}
    </div>
  )
}

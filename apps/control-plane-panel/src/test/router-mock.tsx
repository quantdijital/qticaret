/* eslint-disable react-refresh/only-export-components -- a test stand-in for a module, not a component file */
import type { MouseEventHandler, ReactNode } from "react"
import { vi } from "vitest"

/**
 * TanStack Router stood in for in a page's test:
 * `vi.mock("@tanstack/react-router", () => import("@/test/router-mock"))`.
 * The page reads its search and params from `routerState` and its moves
 * land in `routerState.navigate`.
 */
export const routerState = {
  search: {} as Record<string, unknown>,
  params: {} as Record<string, string>,
  navigate: vi.fn(),
}

export const useNavigate = () => routerState.navigate

export const useSearch = () => routerState.search

/** No navigation happens in a test: a leave guard's blocker never blocks. */
export const useBlocker = () => ({ status: "idle" as const })

export const getRouteApi = () => ({
  useSearch: () => routerState.search,
  useParams: () => routerState.params,
})

export function Link({
  to,
  params,
  className,
  onClick,
  children,
}: {
  to: string
  params?: Record<string, string>
  className?: string
  onClick?: MouseEventHandler<HTMLAnchorElement>
  children: ReactNode
}) {
  const href = Object.entries(params ?? {}).reduce(
    (path, [name, value]) => path.replace(`$${name}`, value),
    to
  )
  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  )
}

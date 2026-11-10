import "@fontsource-variable/inter"
import "./styles/globals.css"
import "./lib/i18n"
import { SectionOwner } from "@qticaret/admin-ui/hooks/use-section-open"
import { trackInputMode } from "@qticaret/admin-ui/lib/input-mode"
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider, createRouter } from "@tanstack/react-router"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ME_KEY } from "./features/auth/api"
import type { Me } from "./features/auth/api"
import { onSessionError } from "./lib/session-events"
import { paintControlPlaneTheme } from "./lib/theme"
import { routeTree } from "./routeTree.gen"

// Before the first paint: the control plane's fixed colours
paintControlPlaneTheme()
trackInputMode()

// Set once the router exists: a refusal of the session leads away from the page
let leave: (error: unknown) => void = () => undefined

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    // Who is signed in is the route guard's to decide (routes/-require-member.ts)
    onError: (error, query) => {
      if (query.queryKey[0] !== ME_KEY[0]) {
        leave(error)
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      leave(error)
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // A refusal is an answer; only a failure to reach the server is tried again
      retry: (count, error) => count < 1 && (error as { status?: unknown }).status === undefined,
    },
  },
})

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  scrollRestoration: true,
})

leave = (error) => {
  onSessionError(error, {
    pathname: () => router.state.location.pathname,
    navigate: (to) => void router.navigate({ to }),
    clear: () => {
      queryClient.clear()
    },
  })
}

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

// Whose open and closed sections the browser remembers (docs/18 §7)
const sectionOwner = () => queryClient.getQueryData<Me>(ME_KEY)?.id

const root = document.getElementById("root")
if (!root) {
  throw new Error("index.html has no #root element")
}
createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SectionOwner value={sectionOwner}>
        <RouterProvider router={router} />
      </SectionOwner>
    </QueryClientProvider>
  </StrictMode>
)

import "@fontsource-variable/inter"
import "./styles/globals.css"
import "./lib/i18n"
import { SectionOwner } from "@qticaret/admin-ui/hooks/use-section-open"
import { trackInputMode } from "@qticaret/admin-ui/lib/input-mode"
import { bootTheme } from "@qticaret/admin-ui/theme"
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider, createRouter } from "@tanstack/react-router"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { CURRENT_USER_KEY } from "./features/auth/api/me"
import { refreshStandingAfter } from "./features/auth/api/staff"
import type { CurrentUser } from "./features/auth/api/me"
import { routeTree } from "./routeTree.gen"

// Before the first paint: the remembered colours, or the defaults
bootTheme()
trackInputMode()

const queryClient: QueryClient = new QueryClient({
  // adr/0061 Ek C15: a refused write reads the role and the shop's status again
  mutationCache: new MutationCache({
    onError: (error) => {
      refreshStandingAfter(queryClient, error)
    },
  }),
  defaultOptions: { queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false } },
})

// Whose open and closed sections the browser remembers (docs/18 §7 CollapsibleSection)
const sectionOwner = () => queryClient.getQueryData<CurrentUser>(CURRENT_USER_KEY)?.id

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  scrollRestoration: true,
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

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

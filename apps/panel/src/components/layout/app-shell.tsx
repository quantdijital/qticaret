import { useQuery } from "@tanstack/react-query"
import { useRouterState } from "@tanstack/react-router"
import { useState } from "react"
import type { CSSProperties, ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { SidebarInset, SidebarProvider } from "@qticaret/admin-ui/ui/sidebar"
import { AssistantProvider } from "@/features/assistant/assistant-context"
import { AssistantPanel } from "@/features/assistant/assistant-panel"
import { appearanceQuery } from "@/features/settings/api/appearance"
import { AppSidebar } from "./app-sidebar"
import { MaintenanceBanner } from "./maintenance-banner"
import { PlanStatusBanner } from "./plan-status-banner"
import { ReauthHost } from "./reauth-host"
import { Topbar } from "./topbar"
import { useDocumentIcon } from "./use-document-icon"
import { useDocumentTitleName } from "@qticaret/admin-ui/hooks/use-document-title"
import { useStoreName } from "@/features/settings/api/store"

// shadcn's sidebar reads its widths from these two; the layout tokens feed them
const SIDEBAR_STYLE = {
  "--sidebar-width": "var(--layout-sidebar-width)",
  "--sidebar-width-icon": "var(--layout-sidebar-width-icon)",
} as CSSProperties

/**
 * Menu, top bar and the page, which uses the whole width (docs/18 §2
 * "Yerleşim"). The menu behaves as the shop chose in Appearance: open,
 * icons only, or icons that open over the page while pointed at. The
 * toggle still opens or closes it until the next visit. Settings has a
 * menu of its own beside the page (the owner, 2026-10-31: on a laptop the
 * two side by side left the page cramped), so there the menu is icons that
 * open while pointed at; one open on the way in opens again on the way out.
 * The assistant, when the shop has it on, sits on the right beside the page.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { data: appearance } = useQuery(appearanceQuery())
  useDocumentTitleName(useStoreName())
  // The tab's icon is the shop's site icon, as the menu's mark is
  useDocumentIcon(appearance?.values.favicon_url)
  const inSettings = useRouterState({
    select: (state) =>
      state.location.pathname === "/settings" || state.location.pathname.startsWith("/settings/"),
  })
  const chosen = appearance?.values.sidebar_mode ?? "expanded"
  // In settings the menu is icons that open while pointed at, whatever the choice
  const mode = inSettings ? "auto" : chosen
  const [pinned, setPinned] = useState(mode === "expanded")
  const [peek, setPeek] = useState(false)
  // A saved choice applies at once
  const [appliedChoice, setAppliedChoice] = useState(chosen)
  if (appliedChoice !== chosen) {
    setAppliedChoice(chosen)
    setPinned(chosen === "expanded" && !inSettings)
    setPeek(false)
  }
  // Entering settings folds a menu open by choice or by the toggle; leaving
  // opens it again as it was
  const [settingsOpen, setSettingsOpen] = useState(inSettings)
  const [pinnedBefore, setPinnedBefore] = useState(pinned)
  if (settingsOpen !== inSettings) {
    setSettingsOpen(inSettings)
    if (inSettings) {
      setPinnedBefore(pinned)
      setPinned(false)
    } else {
      setPinned(pinnedBefore)
    }
    setPeek(false)
  }
  const peeking = mode === "auto" && peek && !pinned
  return (
    <AssistantProvider>
      <SidebarProvider
        style={SIDEBAR_STYLE}
        open={pinned || peeking}
        onOpenChange={(open) => {
          setPinned(open)
          setPeek(false)
        }}
      >
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm"
        >
          {t("app.skipToContent")}
        </a>
        <AppSidebar peek={peeking} {...(mode === "auto" ? { onPeek: setPeek } : {})} />
        <SidebarInset className="min-w-0 bg-background">
          <Topbar />
          <PlanStatusBanner />
          <MaintenanceBanner />
          {/* SidebarInset is the page's one <main>; this is the skip link's target */}
          <div
            id="content"
            tabIndex={-1}
            className="w-full flex-1 px-[var(--page-padding)] py-6 outline-none lg:px-[var(--page-padding-wide)] lg:py-8"
          >
            {children}
          </div>
        </SidebarInset>
        {/* The assistant (adr/0079 §9): a column that pushes the page aside */}
        <AssistantPanel />
        <ReauthHost />
      </SidebarProvider>
    </AssistantProvider>
  )
}

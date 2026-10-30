import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import type { CSSProperties, ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { appearanceQuery } from "@/features/settings/api/appearance"
import { AppSidebar } from "./app-sidebar"
import { ReauthHost } from "./reauth-host"
import { Topbar } from "./topbar"

// shadcn's sidebar reads its widths from these two; the layout tokens feed them
const SIDEBAR_STYLE = {
  "--sidebar-width": "var(--layout-sidebar-width)",
  "--sidebar-width-icon": "var(--layout-sidebar-width-icon)",
} as CSSProperties

/**
 * Menu, top bar and the page, which uses the whole width (docs/18 §2
 * "Yerleşim"). The menu behaves as the shop chose in Appearance: open,
 * icons only, or icons that open over the page while pointed at. The
 * toggle still opens or closes it until the next visit.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { data: appearance } = useQuery(appearanceQuery())
  const mode = appearance?.values.sidebar_mode ?? "expanded"
  const [pinned, setPinned] = useState(mode === "expanded")
  const [peek, setPeek] = useState(false)
  // A saved choice applies at once
  const [appliedMode, setAppliedMode] = useState(mode)
  if (appliedMode !== mode) {
    setAppliedMode(mode)
    setPinned(mode === "expanded")
    setPeek(false)
  }
  const peeking = mode === "auto" && peek && !pinned
  return (
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
        {/* SidebarInset is the page's one <main>; this is the skip link's target */}
        <div
          id="content"
          tabIndex={-1}
          className="w-full flex-1 px-[var(--page-padding)] py-6 outline-none lg:px-[var(--page-padding-wide)] lg:py-8"
        >
          {children}
        </div>
      </SidebarInset>
      <ReauthHost />
    </SidebarProvider>
  )
}

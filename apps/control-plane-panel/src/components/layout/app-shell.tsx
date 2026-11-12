import type { CSSProperties, ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { SidebarInset, SidebarProvider } from "@qticaret/admin-ui/ui/sidebar"
import { AppSidebar } from "./app-sidebar"
import { StepUpHost } from "./step-up-host"
import { Topbar } from "./topbar"

// shadcn's sidebar reads its widths from these two; the layout tokens feed them
const SIDEBAR_STYLE = {
  "--sidebar-width": "var(--layout-sidebar-width)",
  "--sidebar-width-icon": "var(--layout-sidebar-width-icon)",
} as CSSProperties

/**
 * The menu on the left, the top bar and the page beside it (docs/18 §2 "Yerleşim"). The menu is
 * open by default; the toggle folds it to icons until the next visit.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-svh flex-col">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm"
      >
        {t("app.skipToContent")}
      </a>
      <SidebarProvider style={SIDEBAR_STYLE} className="min-h-0 flex-1">
        <AppSidebar />
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
        <StepUpHost />
      </SidebarProvider>
    </div>
  )
}

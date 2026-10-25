import type { CSSProperties, ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "./app-sidebar"
import { Topbar } from "./topbar"

// shadcn's sidebar reads its widths from these two; the layout tokens feed them
const SIDEBAR_STYLE = {
  "--sidebar-width": "var(--layout-sidebar-width)",
  "--sidebar-width-icon": "var(--layout-sidebar-width-icon)",
} as CSSProperties

/** Menu, top bar and the page, which uses the whole width (docs/18 §2 "Yerleşim"). */
export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <SidebarProvider style={SIDEBAR_STYLE}>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm"
      >
        {t("app.skipToContent")}
      </a>
      <AppSidebar />
      <SidebarInset className="min-w-0 bg-background">
        <Topbar />
        <main
          id="content"
          className="w-full flex-1 px-[var(--page-padding)] py-6 lg:px-[var(--page-padding-wide)] lg:py-8"
        >
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

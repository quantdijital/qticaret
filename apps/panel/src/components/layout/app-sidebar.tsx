import { Link, useRouterState } from "@tanstack/react-router"
import { ExternalLink, LayoutDashboard, Settings } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { advancedPanelUrl } from "@/lib/advanced-panel"
import { useStoreName } from "@/features/settings/api/store"

// Only pages that exist; each panel slice adds its own (docs/03 P1–P6)
const ITEMS = [
  { key: "dashboard", to: "/", icon: LayoutDashboard, exact: true },
  { key: "settings", to: "/settings", icon: Settings, exact: false },
] as const

export function AppSidebar() {
  const { t } = useTranslation()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const storeName = useStoreName()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-[var(--layout-topbar-height)] justify-center border-b px-3">
        <div className="flex items-center gap-2 overflow-hidden">
          <span
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground"
          >
            {(storeName ?? t("app.name")).slice(0, 1).toLocaleUpperCase("tr")}
          </span>
          <span className="truncate text-sm font-semibold group-data-[collapsible=icon]:hidden">
            {storeName ?? t("app.name")}
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {ITEMS.map((item) => {
                const active = item.exact ? pathname === item.to : pathname.startsWith(item.to)
                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton asChild isActive={active} tooltip={t(`nav.${item.key}`)}>
                      <Link to={item.to}>
                        <item.icon />
                        <span>{t(`nav.${item.key}`)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            {/* The platform team's door to what this panel does not cover yet (adr/0022 §3) */}
            <SidebarMenuButton asChild tooltip={t("nav.advanced")}>
              <a href={advancedPanelUrl("/")} target="_blank" rel="noreferrer">
                <ExternalLink />
                <span>{t("nav.advanced")}</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

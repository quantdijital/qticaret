import { useQuery } from "@tanstack/react-query"
import { Link, useRouterState } from "@tanstack/react-router"
import { ArrowUpRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { tasksQuery } from "@/features/dashboard/api/tasks"
import { advancedPanelUrl } from "@/lib/advanced-panel"
import { formatCount } from "@/lib/format"
import { cn } from "@/lib/utils"
import { NAV_GROUPS, SETTINGS_ITEM, isActive } from "./navigation"
import type { NavItem } from "./navigation"
import { StoreMark } from "./store-mark"

// The active item: a raised surface, a brand-coloured icon and a marker bar
const ITEM_CLASS = cn(
  "relative h-9 gap-3 px-2.5 text-sidebar-foreground/90 [&>svg]:text-sidebar-muted-foreground",
  "data-[active=true]:[&>svg]:text-sidebar-primary",
  "before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-r-full before:bg-sidebar-primary before:opacity-0",
  "data-[active=true]:before:opacity-100 group-data-[collapsible=icon]:before:hidden"
)

function NavLink({
  item,
  pathname,
  badge,
}: {
  item: NavItem
  pathname: string
  badge?: number | undefined
}) {
  const { t } = useTranslation()
  const label = t(`nav.${item.key}`)
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive(item, pathname)}
        tooltip={label}
        className={ITEM_CLASS}
      >
        <Link to={item.to}>
          <item.icon />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
      {badge ? (
        <SidebarMenuBadge className="top-2 rounded-full bg-sidebar-primary px-1.5 text-[11px] text-sidebar-primary-foreground peer-hover/menu-button:text-sidebar-primary-foreground peer-data-[active=true]/menu-button:text-sidebar-primary-foreground">
          {formatCount(badge)}
        </SidebarMenuBadge>
      ) : null}
    </SidebarMenuItem>
  )
}

export function AppSidebar() {
  const { t } = useTranslation()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  // Orders waiting for the shop: the one number worth showing in the menu
  const { data: tasks } = useQuery(tasksQuery())
  const badges: Record<string, number | undefined> = { orders: tasks?.to_ship }

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="h-[var(--layout-topbar-height)] justify-center px-3">
        <StoreMark />
      </SidebarHeader>
      <SidebarContent className="gap-0 px-1 pt-2">
        {/* A landmark screen readers list as the menu; `contents` keeps the sidebar's layout */}
        <nav aria-label={t("nav.label")} className="contents">
          {NAV_GROUPS.map((group) => (
            <SidebarGroup key={group.key ?? "main"} className="py-1.5">
              {group.key ? (
                <SidebarGroupLabel className="h-7 text-[11px] font-medium tracking-wide text-sidebar-muted-foreground">
                  {t(`nav.groups.${group.key}`)}
                </SidebarGroupLabel>
              ) : null}
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.key}
                      item={item}
                      pathname={pathname}
                      badge={badges[item.key]}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </nav>
      </SidebarContent>
      <SidebarFooter className="gap-0.5 border-t border-sidebar-border px-3 py-3">
        <SidebarMenu className="gap-0.5">
          <NavLink item={SETTINGS_ITEM} pathname={pathname} />
          <SidebarMenuItem>
            {/* The platform team's door to what this panel does not cover yet (adr/0022 §3) */}
            <SidebarMenuButton asChild tooltip={t("nav.advanced")} className={ITEM_CLASS}>
              <a href={advancedPanelUrl("/")} target="_blank" rel="noreferrer">
                <ArrowUpRight />
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

import { useQuery } from "@tanstack/react-query"
import { Link, useRouterState } from "@tanstack/react-router"
import { useEffect, useRef } from "react"
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
import { formatCount } from "@/lib/format"
import { cn } from "@/lib/utils"
import { NAV_GROUPS, SETTINGS_ITEM, itemFor } from "./navigation"
import type { NavItem } from "./navigation"
import { StoreMark } from "./store-mark"
import { useNavAccess } from "./use-nav-access"

// The active item: a raised surface, a brand-coloured icon and a marker bar
const ITEM_CLASS = cn(
  "relative h-9 gap-3 px-2.5 text-sidebar-foreground/90 [&>svg]:text-sidebar-muted-foreground",
  "data-[active=true]:[&>svg]:text-sidebar-primary",
  "before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-r-full before:bg-sidebar-primary before:opacity-0",
  "data-[active=true]:before:opacity-100 group-data-[collapsible=icon]:before:hidden"
)

function NavLink({
  item,
  active,
  badge,
}: {
  item: NavItem
  active: boolean
  badge?: number | undefined
}) {
  const { t } = useTranslation()
  const label = t(`nav.${item.key}`)
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={label} className={ITEM_CLASS}>
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

// A pointer sweeping across the menu does not open it; one stopping on it does, at once
const PEEK_OPEN_MS = 50
const PEEK_CLOSE_MS = 200

/**
 * The menu. With `onPeek` (the "auto" behaviour) it opens over the page
 * while the pointer rests on it, and folds back once it leaves.
 */
export function AppSidebar({
  peek = false,
  onPeek,
}: {
  peek?: boolean
  onPeek?: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  // One item lit: Storefront settings, not Settings too, on its page
  const active = itemFor(pathname)?.key
  // Orders waiting for the shop: the one number worth showing in the menu
  const { data: tasks } = useQuery(tasksQuery())
  const badges: Record<string, number | undefined> = { orders: tasks?.to_ship }
  // An item behind a flag or a capability shows once both are known and allow it
  const allowed = useNavAccess()
  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(allowed),
  })).filter((group) => group.items.length > 0)
  const timer = useRef<number | undefined>(undefined)
  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
    },
    []
  )
  const hover = (open: boolean) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(
      () => {
        onPeek?.(open)
      },
      open ? PEEK_OPEN_MS : PEEK_CLOSE_MS
    )
  }

  return (
    <Sidebar
      collapsible="icon"
      peek={peek}
      className="border-r-0"
      {...(onPeek
        ? {
            onMouseEnter: () => {
              hover(true)
            },
            onMouseLeave: () => {
              hover(false)
            },
          }
        : {})}
    >
      <SidebarHeader className="h-[var(--layout-topbar-height)] justify-center px-3">
        <StoreMark />
      </SidebarHeader>
      <SidebarContent className="gap-0 px-1 pt-2">
        {/* A landmark screen readers list as the menu; `contents` keeps the sidebar's layout */}
        <nav aria-label={t("nav.label")} className="contents">
          {groups.map((group) => (
            <SidebarGroup key={group.key ?? "main"} className="py-1.5">
              {group.key ? (
                // Collapsed, the label fades and slides over the item above it: it must not take its click
                <SidebarGroupLabel className="h-7 text-[11px] font-medium tracking-wide text-sidebar-muted-foreground group-data-[collapsible=icon]:pointer-events-none">
                  {t(`nav.groups.${group.key}`)}
                </SidebarGroupLabel>
              ) : null}
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.key}
                      item={item}
                      active={item.key === active}
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
          <NavLink item={SETTINGS_ITEM} active={active === SETTINGS_ITEM.key} />
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

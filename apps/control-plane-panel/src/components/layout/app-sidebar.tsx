import { Link, useRouterState } from "@tanstack/react-router"
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
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@qticaret/admin-ui/ui/sidebar"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { useMe } from "@/features/auth/api"
import { ACCOUNT_ITEM, activeKey, navFor } from "./navigation"
import type { NavItem } from "./navigation"

// The active item: a raised surface, a brand-coloured icon and a marker bar (the shop panel's)
const ITEM_CLASS = cn(
  "relative h-9 gap-3 px-2.5 text-sidebar-foreground/90 [&>svg]:text-sidebar-muted-foreground",
  "data-[active=true]:[&>svg]:text-sidebar-primary",
  "before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-r-full before:bg-sidebar-primary before:opacity-0",
  "data-[active=true]:before:opacity-100 group-data-[collapsible=icon]:before:hidden"
)

// Under the "Üst panel" bar, never over it (the bar's height is a token)
const UNDER_THE_BAR = {
  top: "var(--cp-bar-height)",
  height: "calc(100svh - var(--cp-bar-height))",
} as const

function NavEntry({ item, active }: { item: NavItem; active: boolean }) {
  const { t } = useTranslation()
  const { setOpenMobile } = useSidebar()
  const label = t(`nav.${item.key}`)
  if (!item.to) {
    // A section still to come: seen, named as such, not reachable
    const soon = t("nav.soon")
    return (
      <SidebarMenuItem>
        <SidebarMenuButton disabled tooltip={`${label} · ${soon}`} className={ITEM_CLASS}>
          <item.icon />
          <span>{label}</span>
          <span className="ml-auto text-[11px] text-sidebar-muted-foreground group-data-[collapsible=icon]:hidden">
            {soon}
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={label} className={ITEM_CLASS}>
        {/* On a phone the menu is a drawer: a choice closes it, the page shows */}
        <Link
          to={item.to}
          onClick={() => {
            setOpenMobile(false)
          }}
        >
          <item.icon />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

/** The control plane's menu: the platform's name on top, the sections, one's own account below. */
export function AppSidebar() {
  const { t } = useTranslation()
  const me = useMe()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const active = activeKey(pathname)
  return (
    <Sidebar collapsible="icon" className="border-r-0" style={UNDER_THE_BAR}>
      <SidebarHeader className="h-[var(--layout-topbar-height)] justify-center px-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground"
          >
            {t("app.product").slice(0, 1)}
          </span>
          <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-semibold">{t("app.product")}</span>
            <span className="truncate text-xs text-sidebar-muted-foreground">{t("app.name")}</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="gap-0 px-1 pt-2">
        <nav aria-label={t("nav.label")} className="contents">
          {navFor(me?.role).map((group) => (
            <SidebarGroup key={group.key ?? "main"} className="py-1.5">
              {group.key ? (
                <SidebarGroupLabel className="h-7 text-[11px] font-medium tracking-wide text-sidebar-muted-foreground group-data-[collapsible=icon]:pointer-events-none">
                  {t(`nav.groups.${group.key}`)}
                </SidebarGroupLabel>
              ) : null}
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {group.items.map((item) => (
                    <NavEntry key={item.key} item={item} active={item.key === active} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </nav>
      </SidebarContent>
      <SidebarFooter className="gap-0.5 border-t border-sidebar-border px-3 py-3">
        <SidebarMenu className="gap-0.5">
          <NavEntry item={ACCOUNT_ITEM} active={active === ACCOUNT_ITEM.key} />
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

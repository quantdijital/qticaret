import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router"
import { ChevronDown } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { useCapabilities } from "@/features/auth/api/staff"
import { revealIn } from "@/features/settings/reveal-in"
import { inSection, visibleGroups } from "@/features/settings/sections"
import { cn } from "@qticaret/admin-ui/lib/utils"

/** The groups as a list on wide screens: all open at first, each can be closed. */
function GroupedMenu({ pathname }: { pathname: string }) {
  const { t } = useTranslation()
  const groups = visibleGroups(useCapabilities())
  // Every group starts open (the shop sees all its settings); one closed by hand stays closed
  const [toggled, setToggled] = useState<ReadonlyMap<string, boolean>>(() => new Map())
  return (
    <ul className="flex flex-col gap-1">
      <li>
        <Link
          to="/settings"
          activeOptions={{ exact: true }}
          className={cn(
            "block rounded-md px-3 py-2 text-sm hover:bg-muted",
            pathname === "/settings" && "bg-muted font-medium"
          )}
        >
          {t("settings.home.all")}
        </Link>
      </li>
      {groups.map((group) => {
        const expanded = toggled.get(group.key) ?? true
        const listId = `settings-group-${group.key}`
        return (
          <li key={group.key}>
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={listId}
              onClick={() => {
                setToggled((was) => new Map(was).set(group.key, !expanded))
              }}
              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase hover:bg-muted"
            >
              {t(`settings.groups.${group.key}`)}
              <ChevronDown
                aria-hidden
                className={cn("size-4 transition-transform", expanded && "rotate-180")}
              />
            </button>
            <ul id={listId} hidden={!expanded} className="mt-0.5 mb-1 flex flex-col gap-0.5">
              {group.sections.map((section) => {
                const Icon = section.icon
                const active = inSection(pathname, section)
                return (
                  <li key={section.key}>
                    <Link
                      to={section.to}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm hover:bg-muted",
                        active && "bg-muted font-medium"
                      )}
                    >
                      <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                      {t(`settings.sections.${section.key}`)}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </li>
        )
      })}
    </ul>
  )
}

/** The groups as one picker on a phone: a long row of tabs does not fit. */
function GroupedPicker({ pathname }: { pathname: string }) {
  const { t } = useTranslation()
  const groups = visibleGroups(useCapabilities())
  const navigate = useNavigate()
  const current = groups
    .flatMap((group) => group.sections)
    .find((section) => inSection(pathname, section))
  return (
    <Select
      value={current?.to ?? "/settings"}
      onValueChange={(to) => {
        void navigate({ to })
      }}
    >
      <SelectTrigger className="w-full" aria-label={t("settings.home.menu")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="/settings">{t("settings.home.all")}</SelectItem>
        {groups.map((group) => (
          <SelectGroup key={group.key}>
            <SelectLabel>{t(`settings.groups.${group.key}`)}</SelectLabel>
            {group.sections.map((section) => (
              <SelectItem key={section.key} value={section.to}>
                {t(`settings.sections.${section.key}`)}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * Settings: the sections in groups on the left, the section on the right.
 * On a wide screen the menu stays in view beside the page and scrolls on
 * its own, so the page is as tall as its own content: a menu longer than a
 * short page once made it scroll on into an empty band (the owner,
 * 2026-11-03: "ekranın alt kısmında siyah boşluk").
 */
export function SettingsLayout() {
  const { t } = useTranslation()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const menu = useRef<HTMLElement>(null)
  // A page opened from elsewhere (the command menu) has its link in view in the menu
  useEffect(() => {
    const current = menu.current?.querySelector<HTMLElement>("[aria-current=page]")
    if (menu.current && current) {
      revealIn(menu.current, current)
    }
  }, [pathname])
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
      <nav
        ref={menu}
        aria-label={t("settings.title")}
        // A ring of room inside its edge, so a keyboard focus outline is not cut off
        className={cn(
          "lg:sticky lg:top-[calc(var(--layout-topbar-height)+var(--page-padding-wide)-0.25rem)] lg:-m-1 lg:w-[calc(15rem+0.5rem)] lg:shrink-0 lg:self-start lg:p-1",
          "lg:max-h-[calc(100svh-var(--layout-topbar-height)-2*var(--page-padding-wide)+0.5rem)] lg:overflow-y-auto lg:overscroll-contain"
        )}
      >
        <div className="lg:hidden">
          <GroupedPicker pathname={pathname} />
        </div>
        <div className="hidden lg:block">
          <GroupedMenu pathname={pathname} />
        </div>
      </nav>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}

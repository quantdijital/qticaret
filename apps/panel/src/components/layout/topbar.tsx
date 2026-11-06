import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { ExternalLink, LogOut, Search, Settings, ShieldCheck } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useCurrentUser, useLogout } from "@/features/auth/api/me"
import { useStaff } from "@/features/auth/api/staff"
import { NotificationBell } from "@/features/notifications/notification-bell"
import { seoSettingsQuery } from "@/features/settings/api/seo"
import { CommandMenu } from "./command-menu"

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts
  return letters.map((part) => (part ?? "").slice(0, 1).toLocaleUpperCase("tr")).join("")
}

/** Search, the shop's storefront and the account, above every page. */
export function Topbar() {
  const { t } = useTranslation()
  const [commandOpen, setCommandOpen] = useState(false)
  const { data: seo } = useQuery(seoSettingsQuery())
  const host = seo?.values.canonical_host

  return (
    <header className="sticky top-0 z-20 flex h-[var(--layout-topbar-height)] shrink-0 items-center gap-3 border-b bg-card px-4 lg:px-[var(--page-padding-wide)]">
      <SidebarTrigger
        aria-label={t("common.menu")}
        className="-ml-1 size-9 text-muted-foreground"
      />
      <Separator orientation="vertical" className="h-5" />
      <button
        type="button"
        onClick={() => {
          setCommandOpen(true)
        }}
        className="flex h-9 w-full max-w-md min-w-0 items-center gap-2 rounded-md border bg-background px-3 text-sm text-muted-foreground transition-colors hover:border-input hover:text-foreground"
      >
        <Search className="size-4" />
        <span className="flex-1 truncate text-left">{t("command.trigger")}</span>
        <KbdGroup className="hidden sm:inline-flex">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </button>
      <div className="ml-auto flex items-center gap-2">
        {host ? (
          <Button asChild variant="outline" className="hidden h-9 md:inline-flex">
            <a href={`https://${host}`} target="_blank" rel="noreferrer">
              <ExternalLink />
              {t("topbar.viewStore")}
            </a>
          </Button>
        ) : null}
        <NotificationBell />
        <AccountMenu />
      </div>
      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
    </header>
  )
}

function AccountMenu() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useCurrentUser()
  const staff = useStaff()
  const logout = useLogout(() => void navigate({ to: "/login" }))
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ")
  const name = fullName !== "" ? fullName : (user?.email ?? "")

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-1.5" aria-label={t("nav.account")}>
          <Avatar className="size-7">
            <AvatarFallback className="bg-primary text-[11px] font-semibold text-primary-foreground">
              {initials(name)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-40 truncate text-sm font-medium lg:inline">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium">{name}</span>
          <span className="block truncate text-xs text-muted-foreground">{user?.email}</span>
          {staff?.role ? (
            <span className="mt-1 block text-xs text-muted-foreground">
              {t(`staff.roles.${staff.role}`)}
            </span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings/security">
            <ShieldCheck />
            {t("settings.sections.security")}
          </Link>
        </DropdownMenuItem>
        {staff?.can.settings ? (
          <DropdownMenuItem asChild>
            <Link to="/settings">
              <Settings />
              {t("topbar.storeSettings")}
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            logout.mutate()
          }}
        >
          <LogOut />
          {t("nav.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

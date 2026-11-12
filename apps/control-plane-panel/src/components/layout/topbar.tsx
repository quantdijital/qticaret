import { Link, useNavigate } from "@tanstack/react-router"
import { LogOut, UserRound } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Avatar, AvatarFallback } from "@qticaret/admin-ui/ui/avatar"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@qticaret/admin-ui/ui/dropdown-menu"
import { SidebarTrigger } from "@qticaret/admin-ui/ui/sidebar"
import { displayName, useMe, useSignOut } from "@/features/auth/api"
import { initials } from "@/lib/names"

function AccountMenu() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const me = useMe()
  const signOut = useSignOut(() => void navigate({ to: "/login" }))
  const name = me ? displayName(me) : ""
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-1.5" aria-label={t("nav.accountMenu")}>
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
          <span className="block truncate text-xs text-muted-foreground">{me?.email}</span>
          {me?.role ? (
            <span className="mt-1 block text-xs text-muted-foreground">
              {t(`roles.${me.role}`)}
            </span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/account">
            <UserRound />
            {t("nav.account")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            signOut.mutate()
          }}
        >
          <LogOut />
          {t("nav.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The menu's toggle and the account, under the "Üst panel" bar. */
export function Topbar() {
  const { t } = useTranslation()
  return (
    <header className="sticky top-0 z-20 flex h-[var(--layout-topbar-height)] shrink-0 items-center gap-3 border-b bg-card px-4 lg:px-[var(--page-padding-wide)]">
      <SidebarTrigger
        aria-label={t("common.menu")}
        className="-ml-1 size-9 text-muted-foreground"
      />
      <div className="ml-auto flex items-center gap-2">
        <AccountMenu />
      </div>
    </header>
  )
}

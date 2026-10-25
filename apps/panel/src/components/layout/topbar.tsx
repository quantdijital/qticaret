import { useNavigate, useRouterState } from "@tanstack/react-router"
import { LogOut } from "lucide-react"
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
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useCurrentUser, useLogout } from "@/features/auth/api/me"

// The section a path belongs to, for the top bar's title
const SECTION_OF: [string, string][] = [
  ["/settings", "nav.settings"],
  ["/", "nav.dashboard"],
]

export function Topbar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const user = useCurrentUser()
  const logout = useLogout(() => void navigate({ to: "/login" }))
  const section = SECTION_OF.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? "nav.dashboard"
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ")
  const name = fullName !== "" ? fullName : (user?.email ?? "")

  return (
    <div className="sticky top-0 z-10 flex h-[var(--layout-topbar-height)] items-center gap-3 border-b bg-background/95 px-4 backdrop-blur-none">
      <SidebarTrigger aria-label={t("common.menu")} />
      <span className="text-sm font-medium text-muted-foreground">{t(section)}</span>
      <div className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t("nav.account")}>
              <Avatar className="size-7">
                <AvatarFallback className="text-xs">
                  {name.slice(0, 1).toLocaleUpperCase("tr")}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate font-normal">
              <span className="block text-sm font-medium">{name}</span>
              <span className="block text-xs text-muted-foreground">{user?.email}</span>
            </DropdownMenuLabel>
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
      </div>
    </div>
  )
}

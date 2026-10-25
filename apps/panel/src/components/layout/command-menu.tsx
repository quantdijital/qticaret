import { useNavigate } from "@tanstack/react-router"
import { ArrowUpRight, LogOut, Palette } from "lucide-react"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { useLogout } from "@/features/auth/api/me"
import { advancedPanelUrl } from "@/lib/advanced-panel"
import { ALL_NAV_ITEMS } from "./navigation"

interface CommandMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** ⌘K / Ctrl+K anywhere: jump to a page or run a common action. */
export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const logout = useLogout(() => void navigate({ to: "/login" }))

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
    }
  }, [open, onOpenChange])

  const run = (action: () => void) => {
    onOpenChange(false)
    action()
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("command.title")}
      description={t("command.description")}
    >
      <CommandInput placeholder={t("command.placeholder")} />
      <CommandList>
        <CommandEmpty>{t("command.empty")}</CommandEmpty>
        <CommandGroup heading={t("command.pages")}>
          {ALL_NAV_ITEMS.map((item) => (
            <CommandItem
              key={item.key}
              value={t(`nav.${item.key}`)}
              onSelect={() => {
                run(() => void navigate({ to: item.to }))
              }}
            >
              <item.icon />
              {t(`nav.${item.key}`)}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading={t("command.actions")}>
          <CommandItem
            value={t("command.appearance")}
            onSelect={() => {
              run(() => void navigate({ to: "/settings/appearance" }))
            }}
          >
            <Palette />
            {t("command.appearance")}
          </CommandItem>
          <CommandItem
            value={t("nav.advanced")}
            onSelect={() => {
              run(() => window.open(advancedPanelUrl("/"), "_blank", "noreferrer"))
            }}
          >
            <ArrowUpRight />
            {t("nav.advanced")}
            <CommandShortcut>↗</CommandShortcut>
          </CommandItem>
          <CommandItem
            value={t("nav.logout")}
            onSelect={() => {
              run(() => {
                logout.mutate()
              })
            }}
          >
            <LogOut />
            {t("nav.logout")}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

import { useNavigate } from "@tanstack/react-router"
import {
  BadgePercent,
  FolderPlus,
  LogOut,
  PackageMinus,
  PackagePlus,
  Palette,
  Truck,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@qticaret/admin-ui/ui/command"
import { useLogout } from "@/features/auth/api/me"
import { SearchResults } from "@/features/search/search-results"
import { ALL_NAV_ITEMS } from "./navigation"
import { useNavAccess } from "./use-nav-access"

// The jobs people start most, a keystroke away (docs/06 §5)
const SHORTCUTS: { key: string; icon: LucideIcon; to: string; search?: Record<string, string> }[] =
  [
    { key: "addProduct", icon: PackagePlus, to: "/products/new" },
    { key: "toShip", icon: Truck, to: "/orders", search: { stage: "to_ship" } },
    { key: "lowStock", icon: PackageMinus, to: "/inventory", search: { view: "low" } },
    { key: "addPromotion", icon: BadgePercent, to: "/promotions/new" },
    { key: "addCategory", icon: FolderPlus, to: "/categories", search: { selected: "new" } },
  ]

interface CommandMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * ⌘K / Ctrl+K anywhere: find an order, a customer, a product or a parcel
 * (F12.9), jump to a page or run a common action.
 */
export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const logout = useLogout(() => void navigate({ to: "/login" }))
  const [search, setSearch] = useState("")
  // What the menu beside it offers: the shell has asked already
  const allowed = useNavAccess({ fetch: false })
  // Closed, it forgets what was typed: a new opening starts empty
  const change = (next: boolean) => {
    if (!next) {
      setSearch("")
    }
    onOpenChange(next)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        change(!open)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
    }
  })

  const run = (action: () => void) => {
    change(false)
    action()
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={change}
      // Held near the top: results arriving grow it downwards instead of moving it.
      // On a phone it hangs from the top edge, clear of the keyboard coming up below.
      className="top-0 bottom-auto rounded-t-none rounded-b-lg border-t-0 border-b sm:top-[12vh] sm:max-w-xl sm:translate-y-0"
      title={t("command.title")}
      description={t("command.description")}
    >
      <CommandInput
        placeholder={t("command.placeholder")}
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>{t("command.empty")}</CommandEmpty>
        <SearchResults
          search={search}
          onPick={() => {
            change(false)
          }}
        />
        <CommandGroup heading={t("command.pages")}>
          {ALL_NAV_ITEMS.filter(allowed).map((item) => (
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
          {SHORTCUTS.map((shortcut) => (
            <CommandItem
              key={shortcut.key}
              value={t(`command.shortcuts.${shortcut.key}`)}
              onSelect={() => {
                run(
                  () =>
                    void navigate({
                      to: shortcut.to,
                      ...(shortcut.search ? { search: shortcut.search } : {}),
                    })
                )
              }}
            >
              <shortcut.icon />
              {t(`command.shortcuts.${shortcut.key}`)}
            </CommandItem>
          ))}
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

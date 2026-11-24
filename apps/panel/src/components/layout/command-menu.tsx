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
import { panelScreen } from "@/features/panel-map/map"
import type { PanelScreen } from "@/features/panel-map/map"
import { ScreenResults } from "@/features/panel-map/screen-results"
import { SearchResults } from "@/features/search/search-results"
import { ALL_NAV_ITEMS } from "./navigation"
import { useNavAccess } from "./use-nav-access"

// The jobs people start most, a keystroke away (docs/06 §5): screens of the panel's map
const SHORTCUTS: { screen: PanelScreen; icon: LucideIcon }[] = [
  { screen: panelScreen("products.new"), icon: PackagePlus },
  { screen: panelScreen("orders.toShip"), icon: Truck },
  { screen: panelScreen("inventory.low"), icon: PackageMinus },
  { screen: panelScreen("promotions.new"), icon: BadgePercent },
  { screen: panelScreen("categories.new"), icon: FolderPlus },
]

const NAV_ICONS: ReadonlyMap<string, LucideIcon> = new Map(
  ALL_NAV_ITEMS.map((item) => [item.key, item.icon])
)

interface CommandMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * ⌘K / Ctrl+K anywhere: find an order, a customer, a product or a parcel
 * (F12.9), jump to a page or run a common action. Typed words also find
 * the panel's screens by their everyday names (adr/0079 Y1-0): "kargo
 * ücreti" opens Ayarlar › Kargo ve teslimat › Seçenekler ve ücretler.
 */
export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const logout = useLogout(() => void navigate({ to: "/login" }))
  const [search, setSearch] = useState("")
  // What the menu beside it offers: the shell has asked already
  const allowed = useNavAccess({ fetch: false })
  const typing = search.trim() !== ""
  // Closed, it forgets what was typed: a new opening starts empty
  const change = (next: boolean) => {
    if (!next) {
      setSearch("")
    }
    onOpenChange(next)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Browser autofill fires keydown events without a key
      if (typeof event.key !== "string") {
        return
      }
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
  const go = (screen: PanelScreen) => {
    run(
      () => void navigate({ to: screen.path, ...(screen.search ? { search: screen.search } : {}) })
    )
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
        {/* Typed words find the screens, the menu's pages and settings tabs among them */}
        <ScreenResults
          search={search}
          allowed={allowed}
          icons={NAV_ICONS}
          onPick={() => {
            change(false)
          }}
        />
        <SearchResults
          search={search}
          onPick={() => {
            change(false)
          }}
        />
        {typing ? null : (
          <CommandGroup heading={t("command.pages")}>
            {ALL_NAV_ITEMS.filter(allowed).map((item) => (
              <CommandItem
                key={item.key}
                value={t(item.label)}
                onSelect={() => {
                  run(() => void navigate({ to: item.to }))
                }}
              >
                <item.icon />
                {t(item.label)}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandSeparator />
        <CommandGroup heading={t("command.actions")}>
          {/* Once typing, the shortcuts are found among the screens */}
          {typing
            ? null
            : SHORTCUTS.filter(({ screen }) => allowed(screen)).map(({ screen, icon: Icon }) => (
                <CommandItem
                  key={screen.key}
                  value={t(screen.label)}
                  onSelect={() => {
                    go(screen)
                  }}
                >
                  <Icon />
                  {t(screen.label)}
                </CommandItem>
              ))}
          {typing ? null : (
            <CommandItem
              value={t("command.appearance")}
              onSelect={() => {
                run(() => void navigate({ to: "/settings/appearance" }))
              }}
            >
              <Palette />
              {t("command.appearance")}
            </CommandItem>
          )}
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

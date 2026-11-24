import { useNavigate } from "@tanstack/react-router"
import { CornerDownRight } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { CommandGroup, CommandItem } from "@qticaret/admin-ui/ui/command"
import { PANEL_MAP } from "./map"
import type { PanelScreen } from "./map"
import { firstSentence, searchPanelMap } from "./search"

interface ScreenResultsProps {
  search: string
  /** Whether the staff member is offered a screen: its flag on and its capability granted. */
  allowed: (screen: PanelScreen) => boolean
  /** The menu items' icons by key: a screen shows the icon of the item it sits under. */
  icons: ReadonlyMap<string, LucideIcon>
  onPick: () => void
}

/**
 * The command menu's screens for what was typed (adr/0079 Y1-0): the panel's
 * map searched by everyday words, each with its trail ("Ayarlar › Kargo ve
 * teslimat › Seçenekler ve ücretler") and what is done there. Each item's
 * value starts with what was typed, so the menu's own filter keeps the
 * map's order and choice.
 */
export function ScreenResults({ search, allowed, icons, onPick }: ScreenResultsProps) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const typed = search.trim()
  const language = i18n.language === "en" ? "en" : "tr"
  const hits = typed
    ? searchPanelMap(typed, PANEL_MAP, { text: (key) => t(key), language, allowed })
    : []
  if (hits.length === 0) {
    return null
  }
  return (
    <CommandGroup heading={t("command.screens")}>
      {hits.map(({ screen, trail }) => {
        const Icon =
          [screen, ...[...trail].reverse()]
            .map((each) => icons.get(each.key))
            .find((icon) => icon !== undefined) ?? CornerDownRight
        return (
          <CommandItem
            key={screen.key}
            value={`${typed} screen ${screen.key}`}
            onSelect={() => {
              onPick()
              void navigate({
                to: screen.path,
                ...(screen.search ? { search: screen.search } : {}),
              })
            }}
          >
            <Icon />
            <span className="flex min-w-0 flex-col">
              <span className="truncate">
                {trail.length > 0 ? (
                  <span className="text-muted-foreground">
                    {trail.map((above) => `${t(above.label)} › `).join("")}
                  </span>
                ) : null}
                <span>{t(screen.label)}</span>
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {firstSentence(screen.help[language])}
              </span>
            </span>
          </CommandItem>
        )
      })}
    </CommandGroup>
  )
}

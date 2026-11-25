import { useTranslation } from "react-i18next"
import { usePageCommands } from "@/components/layout/page-commands"
import type { PageCommand } from "@/components/layout/page-commands"
import { fieldsShown } from "./go-to-entries"
import type { PartKey, ProductLayout } from "./parts"

const L = "products.layout"

/**
 * "Alana git" in the command menu (⌘K) on the product page: its sections
 * in page order, hidden ones too (gone to, they are shown for this
 * visit), then its key fields; only what this product draws.
 */
export function useGoToCommands({
  layout,
  draws,
  goToKey,
  goTo,
}: {
  layout: ProductLayout
  draws: (key: PartKey) => boolean
  goToKey: (key: PartKey) => void
  goTo: (target: string) => void
}): void {
  const { t } = useTranslation()
  const hidden = new Set<PartKey>(layout.hidden)
  const sections: PageCommand[] = [...layout.main, ...layout.side].filter(draws).map((key) => ({
    key: `part.${key}`,
    label: hidden.has(key)
      ? t(`${L}.go.hiddenPart`, { name: t(`${L}.parts.${key}`) })
      : t(`${L}.parts.${key}`),
    run: () => {
      goToKey(key)
    },
  }))
  const fields: PageCommand[] = fieldsShown(draws).map((entry) => ({
    key: `field.${entry.key}`,
    label: t(`${L}.go.fields.${entry.key}`),
    keywords: entry.keywords ?? [],
    run: () => {
      goTo(entry.target)
      const { focus } = entry
      if (focus) {
        // Once the part is drawn and opened, the caret in the field
        window.setTimeout(() => {
          document.querySelector<HTMLElement>(focus)?.focus({ preventScroll: true })
        }, 350)
      }
    },
  }))
  usePageCommands(t(`${L}.go.heading`), [...sections, ...fields])
}

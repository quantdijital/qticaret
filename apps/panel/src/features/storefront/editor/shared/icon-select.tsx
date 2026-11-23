import { useTranslation } from "react-i18next"
import { SECTION_ICONS } from "@qticaret/types"
import type { SectionIcon } from "@qticaret/types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { SECTION_ICON_GLYPHS } from "./section-icons"

const I = "storefront.editor.icons"
const NONE = "none"

/**
 * One icon from the sections' set (adr/0077 §10 Ek), each drawn beside its
 * Turkish name, or none: a figure's icon, a category's disc. Its name for
 * a screen reader is the row's (`label`), as the marquee's icon choice.
 */
export function IconSelect({
  id,
  label,
  value,
  onChange,
  noneLabel,
}: {
  id: string
  label: string
  value: SectionIcon | null | undefined
  onChange: (icon: SectionIcon | null) => void
  /** What "none" means here ("Görseli ya da baş harfi"); default "İkonsuz". */
  noneLabel?: string
}) {
  const { t } = useTranslation()
  return (
    <Select
      value={value ?? NONE}
      onValueChange={(next) => {
        onChange(next === NONE ? null : (next as SectionIcon))
      }}
    >
      <SelectTrigger id={id} className="min-w-0 flex-1" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{noneLabel ?? t(`${I}.none`)}</SelectItem>
        {SECTION_ICONS.map((icon) => {
          const Glyph = SECTION_ICON_GLYPHS[icon]
          return (
            <SelectItem key={icon} value={icon}>
              <Glyph aria-hidden />
              {t(`${I}.${icon}`)}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

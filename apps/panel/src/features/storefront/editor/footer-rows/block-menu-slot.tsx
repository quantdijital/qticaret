import { Link } from "@tanstack/react-router"
import { TriangleAlert } from "lucide-react"
import { FOOTER_ROWS_LIMITS as L } from "@qticaret/types"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import type { FooterMenuBlock } from "@/features/storefront/api/layout"
import { useBlockKit } from "./use-block-kit"
import type { BlockFormProps } from "./use-block-kit"
import { FR } from "./footer-rows-fields"

const SLOTS = Array.from({ length: L.slots }, (_, at) => at + 1)

/**
 * Which footer menu a menu block shows (adr/0070 §2.3): by its order on
 * the Menüler screen, never its id (a ready-made look rewrites the menus,
 * their order stays), each place named after the menu standing there now.
 * The (i) says so; a place with no menu warns, with the way to Menüler.
 */
export function BlockMenuSlot({
  menus,
  ...props
}: BlockFormProps<FooterMenuBlock> & { menus: readonly string[] | null }) {
  const kit = useBlockKit(props)
  const { t } = kit
  const { block, onChange } = props
  const { label, term } = kit.names("slot")
  const missing = menus !== null && block.slot > menus.length
  return (
    <Field label={label} term={term} htmlFor={kit.id("slot")} hint={t(`${FR}.fields.slot.hint`)}>
      <Select
        value={String(block.slot)}
        onValueChange={(next) => {
          const slot = Number(next)
          if (SLOTS.includes(slot)) {
            onChange({ ...block, slot })
          }
        }}
      >
        <SelectTrigger id={kit.id("slot")} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SLOTS.map((slot) => (
            <SelectItem key={slot} value={String(slot)}>
              {t(`${FR}.fields.slot.option`, {
                slot,
                name: menus?.[slot - 1] ?? t(`${FR}.fields.slot.none`),
              })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {missing ? (
        <p className="flex items-start gap-1.5 text-xs text-warning-text">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            {t(`${FR}.fields.slot.missing`)}{" "}
            <Link to="/storefront/menus" className="underline underline-offset-4">
              {t(`${FR}.fields.slot.menus`)}
            </Link>
          </span>
        </p>
      ) : null}
    </Field>
  )
}

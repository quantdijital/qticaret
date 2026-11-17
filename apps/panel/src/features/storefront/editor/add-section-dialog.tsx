import { useTranslation } from "react-i18next"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@qticaret/admin-ui/ui/dialog"
import type { BodyGroup, BodySectionType, Placement } from "@/features/storefront/api/layout"
import { MARQUEE_LIMITS, PRICE_BANDS_LIMITS } from "@/features/storefront/api/layout"
import { GROUP_TYPES } from "@/features/storefront/layout/sections"
import type { FooterAddType } from "@/features/storefront/layout/footer-group"
import { SECTION_ICONS } from "./section-meta"

const A = "storefront.editor.add"

interface AddSectionDialogProps {
  open: boolean
  /** The page the section is for, or the footer group (adr/0070 §4). */
  page: BodyGroup | "footer"
  /** The footer group's types it does not hold yet: each at most once. */
  footerTypes?: readonly FooterAddType[]
  /** A category page's side of its products. */
  placement: Placement
  /** The page already shows its scrolling strips (adr/0049 Ek 2026-11-14 §4.1): no other is offered. */
  marqueeFull: boolean
  /** The page already shows its price bands strips: no other is offered. */
  priceBandsFull?: boolean
  onOpenChange: (open: boolean) => void
  onPick: (type: BodySectionType) => void
}

/** The section types the page (or the footer group) takes, each with what it shows in one line. */
export function AddSectionDialog({
  open,
  page,
  footerTypes = [],
  placement,
  marqueeFull,
  priceBandsFull = false,
  onOpenChange,
  onPick,
}: AddSectionDialogProps) {
  const { t } = useTranslation()
  const types: readonly BodySectionType[] = page === "footer" ? footerTypes : GROUP_TYPES[page]
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t(`${A}.title`)}</DialogTitle>
          <DialogDescription>
            {t(`${A}.description.${page === "category" ? placement : page}`)}
          </DialogDescription>
        </DialogHeader>
        <ul className="grid gap-2 sm:grid-cols-2">
          {types.map((type) => {
            // The footer's newsletter box has its own name (adr/0049 Ek 2026-11-17)
            const kind = page === "footer" && type === "newsletter" ? "footer_newsletter" : type
            const Icon = SECTION_ICONS[kind]
            const full =
              type === "marquee"
                ? marqueeFull &&
                  t("storefront.editor.marquee.full", { max: MARQUEE_LIMITS.perPage })
                : type === "price_bands" &&
                  priceBandsFull &&
                  t("storefront.editor.priceBands.full", { max: PRICE_BANDS_LIMITS.perPage })
            return (
              <li key={type} className="flex">
                <button
                  type="button"
                  disabled={Boolean(full)}
                  className="flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors enabled:hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => {
                    onPick(type)
                  }}
                >
                  <Icon
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      {t(`storefront.editor.types.${kind}.name`)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {full || t(`storefront.editor.types.${kind}.description`)}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </DialogContent>
    </Dialog>
  )
}

import { useId } from "react"
import { useTranslation } from "react-i18next"
import { CAPABILITY_GROUPS } from "@qticaret/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@qticaret/admin-ui/ui/dialog"
import type { BodySectionType, PageGroup, Placement } from "@/features/storefront/api/layout"
import { MARQUEE_LIMITS, PRICE_BANDS_LIMITS } from "@/features/storefront/api/layout"
import {
  PAGE_TYPES,
  allowedTypes,
  chooserGroups,
  typesFor,
} from "@/features/storefront/layout/sections"
import type { FooterAddType } from "@/features/storefront/layout/footer-group"
import { SECTION_ICONS } from "./section-meta"
import { useSectionFlags } from "./section-flags"

/** What the chooser adds: a type, or a content page's own text (`rich_text` as `article`). */
export type AddKind = BodySectionType | "article"

const A = "storefront.editor.add"

interface AddSectionDialogProps {
  open: boolean
  /** The page the section is for (a content page's: `pages`), or the footer group (adr/0070 §4). */
  page: PageGroup | "footer"
  /** The footer group's types it does not hold yet: each at most once. */
  footerTypes?: readonly FooterAddType[]
  /** A category page's side of its products. */
  placement: Placement
  /** A content page's own types it holds already (contact, the facts): each stands once. */
  taken?: ReadonlySet<string>
  /** The page already shows its scrolling strips (adr/0049 Ek 2026-11-14 §4.1): no other is offered. */
  marqueeFull: boolean
  /** The page already shows its price bands strips: no other is offered. */
  priceBandsFull?: boolean
  onOpenChange: (open: boolean) => void
  onPick: (kind: AddKind) => void
}

/** The section types the page (or the footer group) takes, each with what it shows in one line. */
export function AddSectionDialog({
  open,
  page,
  footerTypes = [],
  placement,
  taken = new Set(),
  marqueeFull,
  priceBandsFull = false,
  onOpenChange,
  onPick,
}: AddSectionDialogProps) {
  const { t } = useTranslation()
  const flags = useSectionFlags()
  // A content page's text first (adr/0073 Ek 2026-11-19 (2) K5); a section whose flag is off
  // not offered, a flagged one under its capability's name (adr/0077 §8)
  const types: readonly AddKind[] =
    page === "footer"
      ? allowedTypes(footerTypes, flags)
      : page === "pages"
        ? ["article", ...allowedTypes(PAGE_TYPES, flags)]
        : typesFor(page, flags)
  const groups = chooserGroups(types, flags)
  const named = groups.some((group) => group.capability !== null)
  const ids = useId()
  // One type's button, with what it shows in one line (or why it cannot be added)
  const item = (type: AddKind) => {
    // The footer's newsletter box has its own name (adr/0049 Ek 2026-11-17)
    const kind = page === "footer" && type === "newsletter" ? "footer_newsletter" : type
    const Icon = SECTION_ICONS[kind]
    const full = taken.has(type)
      ? t(`${A}.once`)
      : type === "marquee"
        ? marqueeFull && t("storefront.editor.marquee.full", { max: MARQUEE_LIMITS.perPage })
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
          <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-medium">{t(`storefront.editor.types.${kind}.name`)}</span>
            <span className="text-xs text-muted-foreground">
              {full || t(`storefront.editor.types.${kind}.description`)}
            </span>
          </span>
        </button>
      </li>
    )
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t(`${A}.title`)}</DialogTitle>
          <DialogDescription>
            {t(`${A}.description.${page === "category" ? placement : page}`)}
          </DialogDescription>
        </DialogHeader>
        {named ? (
          <div className="flex flex-col gap-4">
            {groups.map(({ capability, types: listed }) => {
              const key = capability ?? "general"
              return (
                <section
                  key={key}
                  aria-labelledby={`${ids}-${key}`}
                  className="flex flex-col gap-2"
                >
                  <h3 id={`${ids}-${key}`} className="text-xs font-medium text-muted-foreground">
                    {capability ? t(CAPABILITY_GROUPS[capability].label) : t(`${A}.general`)}
                  </h3>
                  <ul className="grid gap-2 sm:grid-cols-2">{listed.map(item)}</ul>
                </section>
              )
            })}
          </div>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">{types.map(item)}</ul>
        )}
      </DialogContent>
    </Dialog>
  )
}

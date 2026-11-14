import { LayoutGrid, Package, Plus } from "lucide-react"
import type { Dispatch } from "react"
import type { LucideIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import type {
  BodyGroup,
  BodySection,
  LayoutDocument,
  MainSection,
  Placement,
} from "@/features/storefront/api/layout"
import type { EditorAction } from "@/features/storefront/layout/editor-state"
import { groupLimit, placed } from "@/features/storefront/layout/sections"
import { bodyOf, mainOf } from "@/features/storefront/layout/main-sections"
import { SectionList } from "./section-list"
import { ThemeRow } from "./tree-rows"
import { BuyBoxBadges } from "./shared/buy-box-badges"

const T = "storefront.editor.tree"

/**
 * The page's main section (adr/0049 Ek 2026-11-14 §7), drawn by the
 * storefront where the sections sit around it: a fixed row that opens its
 * settings, never moved, copied, hidden or removed.
 */
function MainRow({
  section,
  icon,
  name,
  problem,
  onOpen,
}: {
  section: MainSection | undefined
  icon: LucideIcon
  name: string
  problem: boolean
  onOpen: (id: string) => void
}) {
  return section ? (
    <div className="rounded-md border border-dashed">
      <ThemeRow
        icon={icon}
        label={name}
        problem={problem}
        onClick={() => {
          onOpen(section.id)
        }}
      />
    </div>
  ) : null
}

function AddButton({
  label,
  disabled,
  onClick,
}: {
  label: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <div className="pl-5">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full justify-start text-primary-text"
        disabled={disabled}
        onClick={onClick}
      >
        <Plus />
        {label}
      </Button>
    </div>
  )
}

interface PageSectionsProps {
  page: BodyGroup
  doc: LayoutDocument
  problems: ReadonlySet<string>
  dispatch: Dispatch<EditorAction>
  onOpen: (id: string) => void
  onRemove: (section: BodySection) => void
  /** Opens the chooser for the page; a category page's for one side of its products. */
  onAdd: (placement?: Placement) => void
}

/**
 * The chosen page's own sections: the home page's, the ones under every
 * product's own block, or a category page's above and below its products
 * (adr/0049 ek 2026-11-03).
 */
export function PageSections({
  page,
  doc,
  problems,
  dispatch,
  onOpen,
  onRemove,
  onAdd,
}: PageSectionsProps) {
  const { t } = useTranslation()
  const sections: readonly BodySection[] = bodyOf(doc, page)
  const full = sections.length >= groupLimit(page)
  const main = (type: "product_main" | "category_main", icon: LucideIcon) => {
    const section = mainOf(doc, type)
    return (
      <MainRow
        section={section}
        icon={icon}
        name={t(`storefront.editor.types.${type}.name`)}
        problem={section ? problems.has(section.id) : false}
        onOpen={onOpen}
      />
    )
  }
  const list = (label: string, items: readonly BodySection[], placement?: Placement) =>
    items.length === 0 ? null : (
      <SectionList
        label={label}
        sections={items}
        full={full}
        {...(placement ? { placement } : {})}
        problems={problems}
        dispatch={dispatch}
        onOpen={onOpen}
        onRemove={onRemove}
      />
    )
  if (page === "category") {
    const sides = (["top", "bottom"] as const).map((placement) => {
      const label = t(`${T}.placements.${placement}`)
      return (
        <div key={placement} className="flex flex-col gap-1">
          <h3 className="px-2 text-xs font-medium text-muted-foreground">{label}</h3>
          {list(label, placed(doc.category, placement), placement)}
          <AddButton
            label={t(`${T}.addTo.${placement}`)}
            disabled={full}
            onClick={() => {
              onAdd(placement)
            }}
          />
        </div>
      )
    })
    return (
      <div className="flex flex-col gap-2">
        {sides[0]}
        {main("category_main", LayoutGrid)}
        {sides[1]}
      </div>
    )
  }
  const label = t(`storefront.editor.page.${page}`)
  return (
    <div className="flex flex-col gap-1">
      {page === "product" ? (
        <>
          {main("product_main", Package)}
          <BuyBoxBadges settings={doc.settings} dispatch={dispatch} />
        </>
      ) : null}
      {sections.length === 0 ? (
        <p className="px-2 py-1 text-xs text-muted-foreground">{t(`${T}.empty.${page}`)}</p>
      ) : (
        list(label, sections)
      )}
      <AddButton
        label={t(`${T}.add`)}
        disabled={full}
        onClick={() => {
          onAdd()
        }}
      />
    </div>
  )
}

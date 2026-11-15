import { Fragment } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { HEADER_CATALOG_LIMITS, HEADER_MENU_GROUNDS } from "@qticaret/types"
import type { HeaderMenuGround } from "@qticaret/types"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"
import type { HeaderCatalogSection } from "@/features/storefront/api/layout"
import type { SectionProblems } from "@/features/storefront/layout/problems"
import { HEADER_CATALOG_DEFAULTS } from "@/features/storefront/layout/variants"
import { FIELD_IDS, headerCatalogIn } from "./field-registry"
import type { FieldGroupName, HeaderCatalogField } from "./field-registry"
import { HEADER_CATALOG_STEPS, headerCatalogOffers } from "./header-catalog-steps"
import { StepChoice } from "./step-choice"
import { LinkField } from "./link-field"
import { useProblemText } from "./problem-text"

const H = "storefront.editor.headerBar"

type Change = (section: HeaderCatalogSection, field?: string) => void

/** A field's everyday name with its technical term small beside it ("Menü çubuğu zemini" background). */
function Name({ id, field }: { id: string; field: HeaderCatalogField }) {
  const { t } = useTranslation()
  return (
    <span id={`${id}-label`} className="text-sm font-medium">
      {t(`${H}.${field}.label`)}{" "}
      <small className="text-[11px] font-normal text-muted-foreground">
        {t(`${H}.${field}.term`)}
      </small>
    </span>
  )
}

function Hint({ field }: { field: HeaderCatalogField }) {
  const { t } = useTranslation()
  return <p className="text-xs text-muted-foreground">{t(`${H}.${field}.hint`)}</p>
}

/** One catalog setting as fits it: words, a link, the ground's three steps or a switch. */
function CatalogField({
  section,
  field,
  problems,
  onChange,
}: {
  section: HeaderCatalogSection
  field: HeaderCatalogField
  problems: SectionProblems
  onChange: Change
}) {
  const { t } = useTranslation()
  const problemText = useProblemText()
  const id = FIELD_IDS.header(section.id, field)
  if (field === "search_placeholder") {
    const error = problemText(problems[field], HEADER_CATALOG_LIMITS.search_placeholder)
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id}>
          <Name id={id} field={field} />
        </label>
        <Input
          id={id}
          value={section.search_placeholder ?? ""}
          maxLength={HEADER_CATALOG_LIMITS.search_placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => {
            const words = event.target.value.replace(/\s*[\r\n\t]+\s*/g, " ")
            onChange({ ...section, search_placeholder: words.trim() === "" ? null : words }, id)
          }}
        />
        {error ? (
          <p id={`${id}-error`} role="alert" className="text-xs text-destructive-text">
            {error}
          </p>
        ) : (
          <Hint field={field} />
        )}
      </div>
    )
  }
  if (field === "highlight_link") {
    return (
      <div id={id}>
        <LinkField
          id={`${id}-input`}
          label={t(`${H}.highlight_link.label`)}
          hint={t(`${H}.highlight_link.hint`)}
          link={section.highlight_link}
          error={problemText(problems[field])}
          onChange={(link, typing) => {
            onChange({ ...section, highlight_link: link }, typing ? id : undefined)
          }}
        />
      </div>
    )
  }
  if (field === "tools_place" || field === "top_links" || field === "search_width") {
    // A layout choice (Ek 2026-11-15): its steps side by side, "Varsayılana dön" off the default
    const steps: readonly string[] = HEADER_CATALOG_STEPS[field]
    return (
      <StepChoice
        id={id}
        label={t(`${H}.${field}.label`)}
        term={t(`${H}.${field}.term`)}
        hint={t(`${H}.${field}.hint`)}
        steps={steps}
        value={section[field]}
        fallback={HEADER_CATALOG_DEFAULTS[field]}
        nameOf={(step) => t(`${H}.${field}.${step}`)}
        onChange={(step) => {
          onChange({ ...section, [field]: step })
        }}
      />
    )
  }
  if (field === "menu_ground") {
    return (
      <div id={id} className="flex flex-col gap-2">
        <Name id={id} field={field} />
        <ToggleGroup
          type="single"
          variant="outline"
          aria-labelledby={`${id}-label`}
          value={section.menu_ground}
          onValueChange={(next) => {
            // Picking the chosen ground again keeps it: the bar always has one
            if (next !== "") onChange({ ...section, menu_ground: next as HeaderMenuGround })
          }}
          className="grid w-full grid-cols-3"
        >
          {HEADER_MENU_GROUNDS.map((ground) => (
            <ToggleGroupItem
              key={ground}
              value={ground}
              className="text-xs data-[state=on]:bg-accent data-[state=on]:font-medium data-[state=on]:text-accent-foreground"
            >
              {t(`${H}.menu_ground.${ground}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Hint field={field} />
      </div>
    )
  }
  return (
    <div id={id} className="flex items-start justify-between gap-4">
      <label htmlFor={`${id}-input`} className="flex flex-col gap-0.5">
        <Name id={id} field={field} />
        <Hint field={field} />
      </label>
      <Switch
        id={`${id}-input`}
        checked={section[field]}
        onCheckedChange={(checked) => {
          onChange({ ...section, [field]: checked })
        }}
      />
    </div>
  )
}

/**
 * The catalog header's settings of one panel group (adr/0049 Ek
 * 2026-11-15): what it shows and its menu bar's ground open with the
 * header's content, the rest closed in "Diğer ayarlar" (`SectionPanel`).
 * `afterCategories`, a setting of every variant's that belongs beside the
 * "Kategoriler" button (the menus' pictures), stands right under it.
 */
export function HeaderCatalogFields({
  section,
  group,
  problems,
  onChange,
  afterCategories,
}: {
  section: HeaderCatalogSection
  group: FieldGroupName
  problems: SectionProblems
  onChange: Change
  afterCategories?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-5">
      {headerCatalogIn(group)
        .filter((field) => headerCatalogOffers(section, field))
        .map((field) => (
          <Fragment key={field}>
            <CatalogField section={section} field={field} problems={problems} onChange={onChange} />
            {field === "categories_button" && afterCategories}
          </Fragment>
        ))}
    </div>
  )
}

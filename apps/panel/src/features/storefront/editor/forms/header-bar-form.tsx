import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { HEADER_MENU_IMAGES, HEADER_SEARCH_STYLES } from "@qticaret/types"
import type { HeaderBarSection } from "@/features/storefront/api/layout"
import type { SectionProblems } from "@/features/storefront/layout/problems"
import { PANEL_GROUPS } from "../panel-groups"
import { PanelGroup } from "../panel-header"
import { SwitchRow } from "../theme-fields"
import { FIELD_IDS } from "./field-registry"
import type { FieldGroupName } from "./field-registry"
import { HeaderCatalogFields } from "./header-catalog-fields"
import { headerSetIn } from "./header-marks"
import { LinkField } from "./link-field"
import { useProblemText } from "./problem-text"
import { StepChoice } from "./step-choice"

const H = "storefront.editor.headerBar"

/**
 * The shop's header bar (adr/0049 Ek 2026-11-14 §5, Ek 2026-11-15) in its
 * panel groups (adr/0065 Ek, sekmeler): under "İçerik" by the part of the
 * bar they fill, the search (its look first), the thin strip above, the
 * menu bar (the menus' pictures beside the "Kategoriler" button), the
 * icons and the phone; staying at the top of a long page with the fine
 * settings under "Gelişmiş". A header of the other variants has its
 * search's look, its menus' pictures and staying at the top. Its look is
 * the variant's ("Biçim"); the logo and menus are edited on their own
 * screens.
 */
export function HeaderGroups({
  section,
  problems,
  reveal,
  onChange,
}: {
  section: HeaderBarSection
  problems: SectionProblems
  reveal: (group: FieldGroupName) => number | null
  onChange: (section: HeaderBarSection, field?: string) => void
}) {
  const { t } = useTranslation()
  const problemText = useProblemText()
  const searchStyle = (
    <StepChoice
      id={FIELD_IDS.searchStyle(section.id)}
      label={t(`${H}.search_style.label`)}
      term={t(`${H}.search_style.term`)}
      hint={t(`${H}.search_style.hint`)}
      steps={HEADER_SEARCH_STYLES}
      value={section.search_style}
      fallback="field"
      nameOf={(step) => t(`${H}.search_style.${step}`)}
      onChange={(step) => {
        onChange({ ...section, search_style: step })
      }}
    />
  )
  const menuImages = (
    <StepChoice
      id={FIELD_IDS.menuImages(section.id)}
      label={t(`${H}.menu_images.label`)}
      term={t(`${H}.menu_images.term`)}
      hint={t(`${H}.menu_images.hint`)}
      steps={HEADER_MENU_IMAGES}
      value={section.menu_images}
      fallback="submenus"
      nameOf={(step) => t(`${H}.menu_images.${step}`)}
      onChange={(step) => {
        onChange({ ...section, menu_images: step })
      }}
    />
  )
  // The other variants' action button (the catalog header's highlighted link, its own field there)
  const actionId = FIELD_IDS.header(section.id, "highlight_link")
  const action =
    section.variant === "catalog" ? null : (
      <div id={actionId}>
        <LinkField
          id={`${actionId}-input`}
          label={t(`${H}.action_button.label`)}
          hint={t(`${H}.action_button.hint`)}
          link={section.highlight_link ?? null}
          error={problemText(problems["highlight_link"])}
          onChange={(link, typing) => {
            onChange({ ...section, highlight_link: link }, typing ? actionId : undefined)
          }}
        />
      </div>
    )
  const group = (name: FieldGroupName, fields: ReactNode) => (
    <PanelGroup
      name={name}
      title={t(PANEL_GROUPS[name].title)}
      marked={headerSetIn(section, name)}
      reveal={reveal(name)}
    >
      {fields}
    </PanelGroup>
  )
  const catalog = section.variant === "catalog" ? section : null
  const fields = (name: FieldGroupName, extra: { before?: ReactNode; after?: ReactNode } = {}) =>
    catalog ? (
      <HeaderCatalogFields
        section={catalog}
        group={name}
        problems={problems}
        onChange={onChange}
        beforeSearch={extra.before}
        afterCategories={extra.after}
      />
    ) : (
      (extra.before ?? extra.after)
    )
  return (
    <>
      {group("search", fields("search", { before: searchStyle }))}
      {catalog ? group("topBar", fields("topBar")) : null}
      {group(
        "menu",
        fields("menu", {
          after: action ? (
            <>
              {menuImages}
              {action}
            </>
          ) : (
            menuImages
          ),
        })
      )}
      {catalog
        ? group(
            "icons",
            <>
              {fields("icons")}
              <p className="text-xs text-muted-foreground">{t(`${H}.phoneNote`)}</p>
            </>
          )
        : null}
      {group(
        "look",
        <>
          <SwitchRow
            id={FIELD_IDS.sticky(section.id)}
            label={t(`${H}.sticky`)}
            hint={t(`${H}.stickyHint`)}
            checked={section.sticky}
            onChange={(next) => {
              onChange({ ...section, sticky: next })
            }}
          />
          {section.variant === "inline" && (
            <SwitchRow
              id={FIELD_IDS.overCover(section.id)}
              label={t(`${H}.overCover`)}
              hint={t(`${H}.overCoverHint`)}
              checked={section.over_cover === true}
              onChange={(next) => {
                onChange({ ...section, over_cover: next })
              }}
            />
          )}
        </>
      )}
    </>
  )
}

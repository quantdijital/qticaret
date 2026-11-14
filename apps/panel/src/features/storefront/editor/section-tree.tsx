import { Columns3, Contact, Palette, Store, SwatchBook } from "lucide-react"
import type { Dispatch } from "react"
import { useTranslation } from "react-i18next"
import type {
  AnySection,
  BodyGroup,
  LayoutDocument,
  Placement,
} from "@/features/storefront/api/layout"
import type { EditorAction } from "@/features/storefront/layout/editor-state"
import {
  BODY_GROUPS,
  idsOf,
  isScheduled,
  marqueesOn,
  newAnnouncementBar,
  newFooterNewsletter,
  newHeaderMarquee,
  newSectionId,
} from "@/features/storefront/layout/sections"
import { MARQUEE_LIMITS } from "@/features/storefront/api/layout"
import { PageSections } from "./page-sections"
import { SECTION_ICONS, kindOf, sectionLabel } from "./section-meta"
import { SectionRow } from "./section-row"
import { AddRow, ElsewhereRow, ThemeRow, TreeGroup } from "./tree-rows"

const T = "storefront.editor.tree"

interface SectionTreeProps {
  /** The page being edited: its own sections between the header and the footer. */
  page: BodyGroup
  doc: LayoutDocument
  problems: ReadonlySet<string>
  dispatch: Dispatch<EditorAction>
  onOpen: (id: string) => void
  onRemove: (section: AnySection) => void
  onAddSection: (placement?: Placement) => void
  onTheme: () => void
  /** A theme setting in the draft the server would refuse (adr/0063 §3). */
  themeProblem: boolean
  /** The stock line and colour names in the draft (adr/0049 Ek 2026-11-06), and whether one is wrong. */
  onLooks: () => void
  looksProblem: boolean
}

/**
 * The page's parts as the storefront draws them, top to bottom: the
 * header, the chosen page's own sections, the footer; then the theme's
 * own settings and the stock line and colour names every page shares
 * (the trust badges are edited in each trust strip section). The menus, the logo and the contact details are edited
 * on their own screens, linked from where they show.
 */
export function SectionTree({
  page,
  doc,
  problems,
  dispatch,
  onOpen,
  onRemove,
  onAddSection,
  onTheme,
  themeProblem,
  onLooks,
  looksProblem,
}: SectionTreeProps) {
  const { t } = useTranslation()
  const store = t(`${T}.storeProfile`)
  const menus = t(`${T}.menus`)
  const row = (section: AnySection, inFooter = false) => {
    const { name, detail } = sectionLabel(t, section, inFooter)
    return (
      <SectionRow
        key={section.id}
        id={section.id}
        icon={SECTION_ICONS[kindOf(section, inFooter)]}
        name={name}
        detail={detail}
        visible={section.visible}
        scheduled={isScheduled(section)}
        problem={problems.has(section.id)}
        onOpen={() => {
          onOpen(section.id)
        }}
        onToggle={() => {
          dispatch({ type: "toggle", id: section.id })
        }}
        onRemove={() => {
          onRemove(section)
        }}
      />
    )
  }
  const add = (which: "announcement" | "marquee" | "newsletter") => {
    const id = newSectionId(idsOf(doc))
    if (which === "newsletter") {
      dispatch({ type: "add", group: "footer", section: newFooterNewsletter(id) })
    } else {
      const section = which === "marquee" ? newHeaderMarquee(id) : newAnnouncementBar(id)
      dispatch({ type: "add", group: "header", section })
    }
    onOpen(id)
  }
  // The header draws its bar first, its strip under it (adr/0049 Ek 2026-11-14 §4.1)
  const bar = doc.header.find((section) => section.type === "announcement_bar")
  const strip = doc.header.find((section) => section.type === "marquee")
  // A strip in the header shows on every page: not while a page already has its two
  const stripFull = BODY_GROUPS.some((body) => marqueesOn(doc, body) >= MARQUEE_LIMITS.perPage)
  const [newsletter] = doc.footer
  return (
    <nav aria-label={t(`${T}.label`)} className="flex flex-col gap-6 px-3 py-4">
      <TreeGroup title={t(`${T}.header`)}>
        <ul className="flex flex-col gap-0.5">
          {bar ? (
            row(bar)
          ) : (
            <AddRow
              label={t(`${T}.addAnnouncement`)}
              onClick={() => {
                add("announcement")
              }}
            />
          )}
          {strip ? (
            row(strip)
          ) : (
            <AddRow
              label={t(`${T}.addMarquee`)}
              full={
                stripFull
                  ? t("storefront.editor.marquee.full", { max: MARQUEE_LIMITS.perPage })
                  : null
              }
              onClick={() => {
                add("marquee")
              }}
            />
          )}
          <ElsewhereRow
            icon={Store}
            name={t(`${T}.logo`)}
            links={[
              { to: "/settings/store", label: store },
              { to: "/storefront/menus", label: menus },
            ]}
          />
        </ul>
      </TreeGroup>
      <TreeGroup title={t(`storefront.editor.page.${page}`)}>
        <PageSections
          page={page}
          doc={doc}
          problems={problems}
          dispatch={dispatch}
          onOpen={onOpen}
          onRemove={onRemove}
          onAdd={onAddSection}
        />
      </TreeGroup>
      <TreeGroup title={t(`${T}.footer`)}>
        <ul className="flex flex-col gap-0.5">
          {newsletter ? (
            row(newsletter, true)
          ) : (
            <AddRow
              label={t(`${T}.addNewsletter`)}
              onClick={() => {
                add("newsletter")
              }}
            />
          )}
          <ElsewhereRow
            icon={Columns3}
            name={t(`${T}.columns`)}
            links={[{ to: "/storefront/menus", label: menus }]}
          />
          <ElsewhereRow
            icon={Contact}
            name={t(`${T}.contact`)}
            links={[{ to: "/settings/store", label: store }]}
          />
        </ul>
      </TreeGroup>
      <TreeGroup title={t(`${T}.theme`)}>
        <ThemeRow
          icon={Palette}
          label={t(`${T}.themeSettings`)}
          problem={themeProblem}
          onClick={onTheme}
        />
        <ThemeRow
          icon={SwatchBook}
          label={t(`${T}.looks`)}
          problem={looksProblem}
          onClick={onLooks}
        />
      </TreeGroup>
    </nav>
  )
}

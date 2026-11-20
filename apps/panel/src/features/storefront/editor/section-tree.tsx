import { Columns3, Contact, Palette, SlidersHorizontal, Store, SwatchBook } from "lucide-react"
import type { Dispatch } from "react"
import { useTranslation } from "react-i18next"
import type { AnySection, LayoutDocument, Placement } from "@/features/storefront/api/layout"
import type { TreeContentPage } from "./editor-page"
import type { EditorAction } from "@/features/storefront/layout/editor-state"
import {
  idsOf,
  isScheduled,
  newAnnouncementBar,
  newHeaderMarquee,
  newSectionId,
} from "@/features/storefront/layout/sections"
import { MARQUEE_LIMITS } from "@/features/storefront/api/layout"
import { anyPageMarqueesFull } from "@/features/storefront/layout/page-layouts"
import { ContentPageSections } from "./content-page-sections"
import type { EditorPage } from "./editor-page"
import { footerAbove, footerTypesLeft } from "@/features/storefront/layout/footer-group"
import { mainOf } from "@/features/storefront/layout/main-sections"
import type { SectionProblems } from "@/features/storefront/layout/problems"
import { FooterRowsTree } from "./footer-rows/footer-rows-tree"
import type { FooterPart } from "./footer-rows/footer-rows-fields"
import { PageSections } from "./page-sections"
import { SECTION_ICONS, kindOf, sectionLabel } from "./section-meta"
import { SectionList } from "./section-list"
import { SectionRow } from "./section-row"
import { AddRow, ElsewhereRow, ThemeRow, TreeGroup } from "./tree-rows"

const T = "storefront.editor.tree"

const NO_CONTENT_PAGE: TreeContentPage = {
  id: null,
  title: null,
  synthesized: false,
  shownOnly: false,
}

interface SectionTreeProps {
  /** The page being edited: its own sections between the header and the footer. */
  page: EditorPage
  /** The content page picked (`page: "content"`, adr/0073 Ek 2026-11-19 (2) K5). */
  contentPage?: TreeContentPage
  /** Opens the content page's own settings. */
  onPageSettings?: () => void
  doc: LayoutDocument
  problems: ReadonlySet<string>
  dispatch: Dispatch<EditorAction>
  onOpen: (id: string) => void
  onRemove: (section: AnySection) => void
  onAddSection: (placement?: Placement) => void
  /** Opens the chooser for the footer group (adr/0070 §4). */
  onAddFooterSection?: () => void
  onTheme: () => void
  /** A theme setting in the draft the server would refuse (adr/0063 §3). */
  themeProblem: boolean
  /** The stock line and colour names in the draft (adr/0049 Ek 2026-11-06), and whether one is wrong. */
  onLooks: () => void
  looksProblem: boolean
  /** How the storefront behaves (contact and info pages), saved at once apart from the draft. */
  onPreferences: () => void
  /** Each section's problems by field: a free rows footer marks its rows and blocks (adr/0070). */
  fieldProblems?: ReadonlyMap<string, SectionProblems>
  /** The free rows footer's row or block whose panel is open. */
  openedPart?: string | null
  onOpenPart?: (section: string, part: FooterPart) => void
}

/**
 * The page's parts as the storefront draws them, top to bottom: the
 * header, the chosen page's own sections, the footer; then the theme's
 * own settings, the stock line and colour names every page shares and
 * the storefront's preferences (the trust badges are edited in each trust strip section). The menus, the logo and the contact details are edited
 * on their own screens, linked from where they show.
 */
export function SectionTree({
  page,
  contentPage = NO_CONTENT_PAGE,
  onPageSettings = () => undefined,
  doc,
  problems,
  dispatch,
  onOpen,
  onRemove,
  onAddSection,
  onAddFooterSection = () => undefined,
  onTheme,
  themeProblem,
  onLooks,
  looksProblem,
  onPreferences,
  fieldProblems = new Map(),
  openedPart = null,
  onOpenPart = () => undefined,
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
  const add = (which: "announcement" | "marquee") => {
    const id = newSectionId(idsOf(doc))
    const section = which === "marquee" ? newHeaderMarquee(id) : newAnnouncementBar(id)
    dispatch({ type: "add", group: "header", section })
    onOpen(id)
  }
  // The header draws its bar first, its strip under it (adr/0049 Ek 2026-11-14 §4.1)
  const bar = doc.header.find((section) => section.type === "announcement_bar")
  const strip = doc.header.find((section) => section.type === "marquee")
  // A strip in the header shows on every page: not while a page already has its two
  const stripFull = anyPageMarqueesFull(doc)
  // The footer group's sections above its bar, in their order (adr/0070 §4); the bar stays last
  const above = footerAbove(doc)
  // The free rows footer opens its rows and blocks under its line (adr/0070 §7)
  const footerBar = mainOf(doc, "footer_bar")
  const freeRows =
    footerBar?.type === "footer_bar" && footerBar.variant === "free_rows" ? footerBar : null
  // The header's bar and the footer: main sections, fixed rows (adr/0049 Ek 2026-11-14 §5)
  const mainRow = (type: "header_bar" | "footer_bar") => {
    const section = mainOf(doc, type)
    return section ? (
      <li className="rounded-md border border-dashed">
        <ThemeRow
          icon={SECTION_ICONS[type]}
          label={t(`storefront.editor.types.${type}.name`)}
          problem={problems.has(section.id)}
          onClick={() => {
            onOpen(section.id)
          }}
        />
      </li>
    ) : null
  }
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
          {mainRow("header_bar")}
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
      <TreeGroup
        title={
          page === "content" && contentPage.title
            ? contentPage.title
            : t(`storefront.editor.page.${page}`)
        }
      >
        {page === "content" ? (
          <ContentPageSections
            doc={doc}
            pageId={contentPage.id}
            synthesized={contentPage.synthesized}
            shownOnly={contentPage.shownOnly}
            problems={problems}
            dispatch={dispatch}
            onOpen={onOpen}
            onRemove={onRemove}
            onAdd={() => {
              onAddSection()
            }}
            onSettings={onPageSettings}
          />
        ) : (
          <PageSections
            page={page}
            doc={doc}
            problems={problems}
            dispatch={dispatch}
            onOpen={onOpen}
            onRemove={onRemove}
            onAdd={onAddSection}
          />
        )}
      </TreeGroup>
      <TreeGroup title={t(`${T}.footer`)}>
        <ul className="flex flex-col gap-0.5">
          {above.length > 0 ? (
            <li>
              <SectionList
                label={t(`${T}.footerGroup`)}
                sections={above}
                inFooter
                full
                problems={problems}
                dispatch={dispatch}
                onOpen={onOpen}
                onRemove={onRemove}
              />
            </li>
          ) : null}
          <AddRow
            label={t(`${T}.addFooterSection`)}
            full={footerTypesLeft(doc).length === 0 ? t(`${T}.footerFull`) : null}
            onClick={onAddFooterSection}
          />
          {mainRow("footer_bar")}
          {freeRows ? (
            <li>
              <FooterRowsTree
                section={freeRows}
                doc={doc}
                problems={fieldProblems.get(freeRows.id) ?? {}}
                dispatch={dispatch}
                openedPart={openedPart}
                onOpenPart={(part) => {
                  onOpenPart(freeRows.id, part)
                }}
              />
            </li>
          ) : null}
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
        <ThemeRow icon={SlidersHorizontal} label={t(`${T}.preferences`)} onClick={onPreferences} />
      </TreeGroup>
    </nav>
  )
}

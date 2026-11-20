import type { Dispatch } from "react"
import type { LayoutDocument } from "@/features/storefront/api/layout"
import type { EditorAction } from "@/features/storefront/layout/editor-state"
import type { SectionProblems } from "@/features/storefront/layout/problems"
import { SETTINGS_KEY, partProblems } from "@/features/storefront/layout/settings-problems"
import { useTranslation } from "react-i18next"
import {
  groupLimit,
  isBodyGroup,
  isPageGroup,
  marqueesOn,
  priceBandsOn,
} from "@/features/storefront/layout/sections"
import { MARQUEE_LIMITS, PRICE_BANDS_LIMITS } from "@/features/storefront/api/layout"
import type { findSection } from "@/features/storefront/layout/sections"
import type { AnySection, FooterBarSection } from "@/features/storefront/api/layout"
import { isMain } from "@/features/storefront/layout/main-sections"
import { bodyAround, pageMarqueesFull } from "@/features/storefront/layout/page-layouts"
import { tabMates } from "@/features/storefront/layout/shelf-tabs"
import type { Opened } from "./opened"
import { SectionPanel } from "./section-panel"
import { LooksPanel } from "./shared/looks-panel"
import { PreferencesPanel } from "./shared/preferences-panel"
import { PageSettingsPanel } from "./page-settings-panel"
import { ThemePanel } from "./theme-panel"
import { cardVariantsInUse } from "./forms/theme-registry"
import { FooterPartPanel } from "./footer-rows/footer-part-panel"
import { useFooterVariant } from "./footer-rows/use-footer-variant"

interface OpenedFormProps {
  opened: Opened
  /** The open section where it is in the draft; null: no section is open. */
  found: ReturnType<typeof findSection>
  doc: LayoutDocument
  problems: Map<string, SectionProblems>
  dispatch: Dispatch<EditorAction>
  onUndo: () => void
  onRemove: (section: AnySection) => void
  onClose: () => void
  /** A section's own panel (a free rows footer's, back from one of its rows or blocks). */
  onOpenSection?: (id: string) => void
  /** A content page deleted from its settings (adr/0073 Ek 2026-11-19 (2) K5). */
  onPageDeleted?: (id: string) => void
}

/**
 * The theme editor's open panel (adr/0049): the open section's settings,
 * the theme's settings (adr/0063 §3) or the stock line and colour names,
 * each writing to the draft; the storefront's preferences, saved at once
 * apart from it; nothing open: nothing.
 */
export function OpenedForm({
  opened,
  found,
  doc,
  problems,
  dispatch,
  onUndo,
  onRemove,
  onClose,
  onOpenSection = () => undefined,
  onPageDeleted = () => undefined,
}: OpenedFormProps) {
  const { t } = useTranslation()
  const footer = useFooterVariant(doc, dispatch)
  const settingsProblems = problems.get(SETTINGS_KEY) ?? {}
  const part = opened?.kind === "section" ? opened.part : undefined
  const focus = opened?.kind === "section" ? (opened.focus ?? null) : null
  if (
    found &&
    part &&
    found.section.type === "footer_bar" &&
    found.section.variant === "free_rows"
  ) {
    const id = found.section.id
    return (
      <FooterPartPanel
        section={found.section}
        part={part}
        doc={doc}
        problems={problems.get(id) ?? {}}
        focus={focus}
        onChange={(section, field) => {
          dispatch({ type: "update", section, merge: field ? `${id}:${field}` : undefined })
        }}
        onBack={() => {
          onOpenSection(id)
        }}
        onGone={() => {
          onOpenSection(id)
        }}
      />
    )
  }
  if (found) {
    // A page shows two scrolling strips at most (the header's counted) and two price bands strips
    const stripsFull =
      found.section.type === "marquee" &&
      (isBodyGroup(found.group)
        ? marqueesOn(doc, found.group) >= MARQUEE_LIMITS.perPage
        : found.page !== null && pageMarqueesFull(doc, found.page))
    const bandsFull =
      found.section.type === "price_bands" &&
      isBodyGroup(found.group) &&
      priceBandsOn(doc, found.group) >= PRICE_BANDS_LIMITS.perPage
    // A page body's own sections, the found one among them (a content page's: its page's)
    const around = bodyAround(doc, found)
    return (
      <>
        {footer.dialog}
        <SectionPanel
          section={found.section}
          group={found.group}
          problems={problems.get(found.section.id) ?? {}}
          canDuplicate={
            isPageGroup(found.group) &&
            !isMain(found.section) &&
            around.length < groupLimit(found.group) &&
            !stripsFull &&
            !bandsFull
          }
          duplicateNote={
            stripsFull
              ? t("storefront.editor.marquee.full", { max: MARQUEE_LIMITS.perPage })
              : bandsFull
                ? t("storefront.editor.priceBands.full", { max: PRICE_BANDS_LIMITS.perPage })
                : null
          }
          onChange={(section, field) => {
            dispatch({
              type: "update",
              section,
              merge: field ? `${section.id}:${field}` : undefined,
            })
          }}
          onPlace={(placement) => {
            dispatch({ type: "place", id: found.section.id, placement })
          }}
          onBack={onClose}
          onDuplicate={() => {
            dispatch({ type: "duplicate", id: found.section.id })
          }}
          onRemove={() => {
            onRemove(found.section)
          }}
          focus={focus}
          onFooterVariant={
            found.section.type === "footer_bar"
              ? (next) => {
                  footer.switchFooter(found.section as FooterBarSection, next)
                }
              : undefined
          }
          shelfMates={found.section.type === "products" ? tabMates(around, found.section.id) : []}
          badges={doc.settings.trust_badges}
          onBadges={(trust_badges, field) => {
            dispatch({
              type: "settings",
              settings: { ...doc.settings, trust_badges },
              merge: field,
            })
          }}
        />
      </>
    )
  }
  if (opened?.kind === "preferences") {
    return <PreferencesPanel onBack={onClose} />
  }
  if (opened?.kind === "page-settings") {
    return <PageSettingsPanel pageId={opened.page} onBack={onClose} onDeleted={onPageDeleted} />
  }
  if (opened?.kind === "looks") {
    return (
      <LooksPanel
        settings={doc.settings}
        problems={settingsProblems}
        onChange={(settings, field) => {
          dispatch({ type: "settings", settings, merge: field })
        }}
        onBack={onClose}
      />
    )
  }
  if (opened?.kind === "theme") {
    return (
      <ThemePanel
        theme={doc.settings.theme}
        variants={cardVariantsInUse(doc)}
        focus={opened.focus ?? null}
        problems={partProblems(settingsProblems, "theme")}
        announcement={
          doc.header
            .flatMap((section) => (section.type === "announcement_bar" ? section.lines : []))
            .find((line) => line.trim() !== "") ?? null
        }
        onChange={(theme, field) => {
          dispatch({
            type: "settings",
            settings: { ...doc.settings, theme },
            merge: field ? `theme.${field}` : undefined,
          })
        }}
        onUndo={onUndo}
        onBack={onClose}
      />
    )
  }
  return null
}

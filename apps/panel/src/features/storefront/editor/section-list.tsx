import { useState } from "react"
import type { Dispatch } from "react"
import { useTranslation } from "react-i18next"
import type { BodySection, FooterSection, Placement } from "@/features/storefront/api/layout"
import type { EditorAction } from "@/features/storefront/layout/editor-state"
import { CAPABILITY_GROUPS } from "@qticaret/types"
import { isScheduled, offCapability } from "@/features/storefront/layout/sections"
import { SECTION_ICONS, kindOf, sectionLabel } from "./section-meta"
import { SectionRow } from "./section-row"
import { useSectionFlags } from "./section-flags"
import type { DropPlace, RowDrag } from "./section-row"

interface SectionListProps<S extends BodySection | FooterSection> {
  /** The list's name for screen readers: the page, or its side of a category's products. */
  label: string
  sections: readonly S[]
  /** The footer group's sections above its bar (adr/0070 §4): its newsletter box named as the footer's. */
  inFooter?: boolean
  /** The page holds as many as it may: nothing is copied. */
  full: boolean
  /** Whether a section may be copied when the page has room (a content page's contact section stands once). */
  copies?: (section: S) => boolean
  /** A category page's side: each row may move to the other one. */
  placement?: Placement
  /** What moving to the other side is called, when not a category page's ("Metnin altına taşı"). */
  placeLabel?: (to: Placement) => string
  /** The ids of sections with a mistake to fix. */
  problems: ReadonlySet<string>
  dispatch: Dispatch<EditorAction>
  onOpen: (id: string) => void
  onRemove: (section: S) => void
  /**
   * Opens the section chooser aimed before a row (null: after the last);
   * a "+" between the rows and the rows' "Üstüne / Altına bölüm ekle".
   * None or null: nothing more may be added here.
   */
  onInsert?: ((before: string | null) => void) | null | undefined
}

/** Where a section dropped before or after `target` lands, as an index among the others. */
function dropIndex(
  sections: readonly { id: string }[],
  dragged: string,
  target: string,
  place: DropPlace
): number | null {
  const from = sections.findIndex((section) => section.id === dragged)
  const at = sections.findIndex((section) => section.id === target)
  if (from < 0 || at < 0 || dragged === target) {
    return null
  }
  // The index once the dragged section has left its place
  const to = (place === "before" ? at : at + 1) - (from < at ? 1 : 0)
  return to === from ? null : to
}

/** A page's (or the footer group's) sections in order: dragged by their handles or moved by their buttons. */
export function SectionList<S extends BodySection | FooterSection>({
  label,
  sections,
  inFooter = false,
  full,
  copies = () => true,
  placement,
  placeLabel,
  problems,
  dispatch,
  onOpen,
  onRemove,
  onInsert = null,
}: SectionListProps<S>) {
  const { t } = useTranslation()
  const flags = useSectionFlags()
  const [dragged, setDragged] = useState<string | null>(null)
  const [over, setOver] = useState<{ id: string; place: DropPlace } | null>(null)
  const other: Placement | null = placement ? (placement === "top" ? "bottom" : "top") : null
  const stop = () => {
    setDragged(null)
    setOver(null)
  }
  const dragOf = (id: string): RowDrag => ({
    active: dragged !== null,
    dragging: dragged === id,
    over: over?.id === id ? over.place : null,
    onStart: () => {
      setDragged(id)
    },
    onEnd: stop,
    onOver: (place) => {
      // Marked only where a drop would move something
      const lands = dragged !== null && dropIndex(sections, dragged, id, place) !== null
      if (!lands) {
        setOver(null)
      } else if (over?.id !== id || over.place !== place) {
        setOver({ id, place })
      }
    },
    onDrop: (place) => {
      const to = dragged ? dropIndex(sections, dragged, id, place) : null
      if (dragged && to !== null) {
        dispatch({ type: "move", id: dragged, to })
      }
      stop()
    },
  })
  return (
    <ol aria-label={label} className="flex flex-col gap-0.5">
      {sections.map((section, index) => {
        const { name, detail: type } = sectionLabel(t, section, inFooter)
        // Kept while its feature flag is off, not drawn (adr/0077 §8): the row says why
        const off = offCapability(section.type, flags)
        const offNote = off
          ? t("storefront.editor.row.offNote", { capability: t(CAPABILITY_GROUPS[off].label) })
          : null
        const detail = [type, offNote].filter((part) => part !== null).join(" · ") || null
        const move = (to: number) => () => {
          dispatch({ type: "move", id: section.id, to })
        }
        const next = sections[index + 1]?.id ?? null
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
            off={off !== null}
            onOpen={() => {
              onOpen(section.id)
            }}
            onToggle={() => {
              dispatch({ type: "toggle", id: section.id })
            }}
            onRemove={() => {
              onRemove(section)
            }}
            moves={{
              up: index > 0 ? move(index - 1) : null,
              down: index < sections.length - 1 ? move(index + 1) : null,
            }}
            onDuplicate={
              full || !copies(section)
                ? null
                : () => {
                    dispatch({ type: "duplicate", id: section.id })
                  }
            }
            drag={dragOf(section.id)}
            onPlace={
              other
                ? {
                    to: other,
                    run: () => {
                      dispatch({ type: "place", id: section.id, placement: other })
                    },
                    ...(placeLabel ? { label: placeLabel(other) } : {}),
                  }
                : undefined
            }
            insertLine={onInsert ? { hidden: dragged !== null } : undefined}
            onInsert={
              onInsert
                ? {
                    above: () => {
                      onInsert(section.id)
                    },
                    below: () => {
                      onInsert(next)
                    },
                  }
                : undefined
            }
          />
        )
      })}
    </ol>
  )
}

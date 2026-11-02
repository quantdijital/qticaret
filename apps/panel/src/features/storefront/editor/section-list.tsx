import { useState } from "react"
import type { Dispatch } from "react"
import { useTranslation } from "react-i18next"
import type { BodySection, Placement } from "@/features/storefront/api/layout"
import type { EditorAction } from "@/features/storefront/layout/editor-state"
import { isScheduled } from "@/features/storefront/layout/sections"
import { SECTION_ICONS, sectionLabel } from "./section-meta"
import { SectionRow } from "./section-row"
import type { DropPlace, RowDrag } from "./section-row"

interface SectionListProps {
  /** The list's name for screen readers: the page, or its side of a category's products. */
  label: string
  sections: readonly BodySection[]
  /** The page holds as many as it may: nothing is copied. */
  full: boolean
  /** A category page's side: each row may move to the other one. */
  placement?: Placement
  /** The ids of sections with a mistake to fix. */
  problems: ReadonlySet<string>
  dispatch: Dispatch<EditorAction>
  onOpen: (id: string) => void
  onRemove: (section: BodySection) => void
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

/** A page's sections in order: dragged by their handles or moved by their buttons. */
export function SectionList({
  label,
  sections,
  full,
  placement,
  problems,
  dispatch,
  onOpen,
  onRemove,
}: SectionListProps) {
  const { t } = useTranslation()
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
        const { name, detail } = sectionLabel(t, section)
        const move = (to: number) => () => {
          dispatch({ type: "move", id: section.id, to })
        }
        return (
          <SectionRow
            key={section.id}
            id={section.id}
            icon={SECTION_ICONS[section.type]}
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
            moves={{
              up: index > 0 ? move(index - 1) : null,
              down: index < sections.length - 1 ? move(index + 1) : null,
            }}
            onDuplicate={
              full
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
                  }
                : undefined
            }
          />
        )
      })}
    </ol>
  )
}

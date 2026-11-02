import { useState } from "react"
import type { Dispatch } from "react"
import { useTranslation } from "react-i18next"
import type { HomeSection } from "@/features/storefront/api/layout"
import { LAYOUT_LIMITS } from "@/features/storefront/api/layout"
import type { EditorAction } from "@/features/storefront/layout/editor-state"
import { isScheduled } from "@/features/storefront/layout/sections"
import { SECTION_ICONS, sectionLabel } from "./section-meta"
import { SectionRow } from "./section-row"
import type { DropPlace, RowDrag } from "./section-row"

interface HomeListProps {
  sections: readonly HomeSection[]
  /** The ids of sections with a mistake to fix. */
  problems: ReadonlySet<string>
  dispatch: Dispatch<EditorAction>
  onOpen: (id: string) => void
  onRemove: (section: HomeSection) => void
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

/** The home page's sections in order: dragged by their handles or moved by their buttons. */
export function HomeList({ sections, problems, dispatch, onOpen, onRemove }: HomeListProps) {
  const { t } = useTranslation()
  const [dragged, setDragged] = useState<string | null>(null)
  const [over, setOver] = useState<{ id: string; place: DropPlace } | null>(null)
  const full = sections.length >= LAYOUT_LIMITS.home
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
    <ol aria-label={t("storefront.editor.tree.home")} className="flex flex-col gap-0.5">
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
          />
        )
      })}
    </ol>
  )
}

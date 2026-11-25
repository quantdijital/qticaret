"use client"

import { Plus } from "lucide-react"
import { useState } from "react"
import type { ProgramSectionView } from "@qticaret/ui"
import { StepBody } from "./ProgramParts"

/**
 * The program as rows that open (adr/0078 `accordion`): each step's head a
 * button naming its state (`aria-expanded`, `aria-controls`), the first
 * open. Every step's words stay in the HTML (a closed one `hidden`), so
 * the page reads whole without script and to a search engine.
 */
export function ProgramAccordion({ section }: { section: ProgramSectionView }) {
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set([0]))
  const toggle = (index: number) => {
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }
  return (
    <ol className="flex flex-col gap-2">
      {section.steps.map((step, index) => {
        const shown = open.has(index)
        const panel = `program-${section.id}-${String(index)}`
        return (
          <li key={panel} className="rounded-media gf-pane">
            {/* The base h3's 40ch measure would end the row's button (and its sign) mid-row */}
            <h3 className="max-w-none">
              <button
                type="button"
                aria-expanded={shown}
                aria-controls={panel}
                onClick={() => {
                  toggle(index)
                }}
                className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-4 rounded-media px-5 py-3 text-start hover:bg-paper-3"
              >
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-text-3">{step.label}</span>
                  <span className="text-md font-semibold">{step.title}</span>
                </span>
                <Plus
                  className={`size-5 shrink-0 motion-safe:transition-transform ${shown ? "rotate-45" : ""}`}
                  aria-hidden="true"
                  strokeWidth={1.75}
                />
              </button>
            </h3>
            <div id={panel} hidden={!shown} className="px-5 pb-5">
              <StepBody step={step} />
            </div>
          </li>
        )
      })}
    </ol>
  )
}

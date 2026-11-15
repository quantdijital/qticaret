import { useRef } from "react"

/**
 * A slider's rows' open buttons, by place: a slide's dialog, shown from
 * the form's state with no trigger of its own, gives the caret back to the
 * row of the slide it shows on closing. That is the button that opened it,
 * the row stepped to with its arrows, or, opened from the preview's edit
 * label (whose press is inside the frame), the slide's row in the form.
 */
export function useSlideRows() {
  const rows = useRef<(HTMLButtonElement | null)[]>([])
  return {
    /** The ref of the row's open button at `index`. */
    rowRef: (index: number) => (element: HTMLButtonElement | null) => {
      rows.current[index] = element
    },
    /** The open button of the row at `index`; null when it is gone. */
    rowAt: (index: number): HTMLElement | null => rows.current[index] ?? null,
  }
}

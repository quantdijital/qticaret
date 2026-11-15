import { fieldLabelPlace, sectionFields } from "./overlay-core"

/**
 * The editor layer's field part (adr/0065 §9, Faz 2b): the field the
 * pointer is on inside a section (a heading, a button, a picture marked
 * `data-qf`) gets a thin solid frame and, on its top left edge, a small
 * "edit" label; pressing it opens the section's form at that field. From
 * the keyboard (a section reached with Alt+↓/↑) every field of the section
 * gets such a label, after the section's own in the tab order. It lives in
 * the overlay's closed shadow root; names are written as text, positions
 * through the CSSOM. On a touch screen nothing shows on hover (the
 * section's handle stays the way in).
 */

export interface FieldTarget {
  id: string
  key: string
  element: Element
}

export interface FieldLayer {
  /** Frames the field pointed at (null: none). */
  show(target: FieldTarget | null): void
  shown(): FieldTarget | null
  /** The keyboard's labels on each of a section's fields (null: none). */
  handles(section: { id: string; element: Element } | null): void
  /** Follows the page; `avoid` is the section's label, which the field's keeps clear of. */
  reposition(avoid: DOMRect | null): void
  setWord(edit: string): void
  setFactor(factor: number): void
  destroy(): void
}

export const FIELD_CSS = `.fbox{position:absolute;top:0;left:0;box-sizing:border-box;border:calc(1.5px*var(--k)) solid rgb(47 111 235);border-radius:calc(2px*var(--k));display:none}
.flabel,.fhandle{position:absolute;pointer-events:auto;display:none;box-sizing:border-box;margin:0;border:0;border-radius:calc(3px*var(--k));background:rgb(47 111 235);color:#fff;font:600 calc(11px*var(--k))/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;padding:calc(4px*var(--k)) calc(7px*var(--k));cursor:pointer;white-space:nowrap}
.flabel:focus-visible,.fhandle:focus-visible{outline:calc(2px*var(--k)) solid #fff;outline-offset:calc(-4px*var(--k))}
.fbox.on{display:block}.flabel.on,.fhandle.on{display:block}`

/** The label's size before it is drawn, in CSS pixels at scale 1. */
const LABEL = { width: 64, height: 22 }

/** What a field says to a screen reader: its own words, else its picture's, cut short. */
function fieldName(element: Element): string {
  const words = element.textContent.replace(/\s+/g, " ").trim()
  const alt = element.querySelector("img")?.getAttribute("alt") ?? ""
  const name = words || alt.trim()
  return name.length > 60 ? `${name.slice(0, 59)}…` : name
}

export function createFieldLayer({
  root,
  onEdit,
}: {
  root: ShadowRoot
  onEdit: (id: string, key: string) => void
}): FieldLayer {
  const box = document.createElement("div")
  box.className = "fbox"
  const label = document.createElement("button")
  label.type = "button"
  label.className = "flabel"
  root.append(box, label)

  let current: FieldTarget | null = null
  let factor = 1
  let edit = ""
  let avoid: DOMRect | null = null
  let keyed: { id: string; element: Element } | null = null
  const buttons: { button: HTMLButtonElement; target: FieldTarget }[] = []

  const press = (event: Event, target: FieldTarget | null) => {
    event.preventDefault()
    event.stopPropagation()
    if (target) {
      onEdit(target.id, target.key)
    }
  }
  label.addEventListener("click", (event) => {
    press(event, current)
  })

  const viewport = () => ({
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
  })
  const place = (button: HTMLElement, rect: DOMRect) => {
    const measured = button.getBoundingClientRect()
    const size =
      measured.width > 0
        ? { width: measured.width / factor, height: measured.height / factor }
        : LABEL
    const at = fieldLabelPlace(rect, viewport(), factor, size, avoid)
    button.style.top = `${String(at.top)}px`
    button.style.left = `${String(at.left)}px`
  }
  const name = (target: FieldTarget) => {
    const said = fieldName(target.element)
    return said ? `${edit}: ${said}` : edit
  }

  /** The field's frame, and its label unless a keyboard label already names it. */
  const drawCurrent = (labelled = true) => {
    const rect = current?.element.isConnected ? current.element.getBoundingClientRect() : null
    if (!current || !rect || rect.width === 0 || rect.height === 0 || !edit) {
      box.classList.remove("on")
      label.classList.remove("on")
      return
    }
    box.style.transform = `translate(${String(Math.round(rect.left))}px,${String(Math.round(rect.top))}px)`
    box.style.width = `${String(Math.round(rect.width))}px`
    box.style.height = `${String(Math.round(rect.height))}px`
    box.classList.add("on")
    if (!labelled) {
      label.classList.remove("on")
      return
    }
    label.textContent = edit
    label.setAttribute("aria-label", name(current))
    label.classList.add("on")
    place(label, rect)
  }

  const clearButtons = () => {
    for (const { button } of buttons) {
      button.remove()
    }
    buttons.length = 0
  }
  const drawButtons = () => {
    clearButtons()
    if (!keyed || !keyed.element.isConnected || !edit) {
      return
    }
    const id = keyed.id
    for (const { key, element } of sectionFields(keyed.element)) {
      const target = { id, key, element }
      const button = document.createElement("button")
      button.type = "button"
      button.className = "fhandle on"
      button.textContent = edit
      button.setAttribute("aria-label", name(target))
      button.addEventListener("click", (event) => {
        press(event, target)
      })
      button.addEventListener("focus", () => {
        current = target
        drawCurrent(false)
      })
      root.append(button)
      buttons.push({ button, target })
      place(button, element.getBoundingClientRect())
    }
  }

  return {
    show(target) {
      if (target?.element === current?.element && target?.key === current?.key) {
        return
      }
      current = target
      // The pointer is back: the keyboard's labels go
      if (keyed && target) {
        keyed = null
        clearButtons()
      }
      drawCurrent()
    },
    shown: () => current,
    handles(section) {
      keyed = section
      drawButtons()
    },
    reposition(next) {
      avoid = next
      drawCurrent(buttons.length === 0)
      for (const { button, target } of buttons) {
        place(button, target.element.getBoundingClientRect())
      }
    },
    setWord(next) {
      edit = next
      drawCurrent(buttons.length === 0)
      drawButtons()
    },
    setFactor(next) {
      factor = next
      drawCurrent(buttons.length === 0)
      drawButtons()
    },
    destroy() {
      clearButtons()
      box.remove()
      label.remove()
    },
  }
}

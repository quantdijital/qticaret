import { sectionSelector } from "./bridge-core"
import { FIELD_CSS, createFieldLayer } from "./field-layer"
import { drawnSections, knownName, labelPlace, strokeFactor, type LabelPlace } from "./overlay-core"

/**
 * The editor layer in the preview frame (adr/0065 §4, Faz 2; owner's
 * decision 1): the section the pointer (or Alt+↓/↑) is on gets a dashed
 * frame and, at its top right corner, an "edit" label; pressing it opens
 * the section's form in the panel. On a touch screen every section shows
 * a small handle instead. It lives in a closed shadow root on its own
 * element: neither the theme's style nor the shop's CSS reaches it, and
 * it reaches nothing of the page. Names are written as text, positions
 * through the CSSOM (no `style` attribute, CSP `style-src-attr`), the one
 * style element with the response's nonce. Created only by the bridge,
 * framed, on a live session.
 */

export interface Overlay {
  setScale(scale: number): void
  setLabels(edit: string, names: Readonly<Record<string, string>>): void
  /** Frames a section (null: none). */
  show(id: string | null): void
  shown(): string | null
  /** Faz 2b: frames a field of the section shown, with its own label (null: none). */
  showField(field: { key: string; element: Element } | null): void
  /** Moves the keyboard's focus to the label (Alt+↓/↑). */
  focusLabel(): void
  /** Follows the page: a scroll, a resize, a redraw. */
  reposition(): void
  destroy(): void
}

const ACCENT = "rgb(47 111 235)"

const CSS = `:host{all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647;display:block;--k:1}
.box{position:absolute;top:0;left:0;box-sizing:border-box;border:calc(2px*var(--k)) dashed ${ACCENT};display:none}
.label,.handle{position:absolute;pointer-events:auto;display:none;align-items:center;gap:calc(6px*var(--k));box-sizing:border-box;margin:0;border:0;border-radius:calc(4px*var(--k));background:${ACCENT};color:#fff;font:600 calc(12px*var(--k))/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;padding:calc(5px*var(--k)) calc(8px*var(--k));cursor:pointer;white-space:nowrap;max-width:calc(320px*var(--k))}
.label:focus-visible,.handle:focus-visible{outline:calc(2px*var(--k)) solid #fff;outline-offset:calc(-4px*var(--k))}
.name{overflow:hidden;text-overflow:ellipsis;font-weight:400;opacity:.9}
.on{display:flex}.box.on{display:block}
${FIELD_CSS}`

function setBox(element: HTMLElement, rect: DOMRect) {
  element.style.transform = `translate(${String(Math.round(rect.left))}px,${String(Math.round(rect.top))}px)`
  element.style.width = `${String(Math.round(rect.width))}px`
  element.style.height = `${String(Math.round(rect.height))}px`
}

function setCorner(element: HTMLElement, place: LabelPlace) {
  element.style.top = `${String(place.top)}px`
  element.style.right = "right" in place ? `${String(place.right)}px` : ""
  element.style.left = "left" in place ? `${String(place.left)}px` : ""
}

export function createOverlay({
  nonce,
  touch,
  onEdit,
  onEditField,
}: {
  nonce: string | undefined
  /** A screen without hover: a handle on every section rather than a label on hover. */
  touch: boolean
  onEdit: (id: string) => void
  /** Faz 2b: a field's label was pressed. */
  onEditField: (id: string, key: string) => void
}): Overlay {
  const host = document.createElement("qt-editor-layer")
  const root = host.attachShadow({ mode: "closed" })
  const style = document.createElement("style")
  if (nonce) {
    style.nonce = nonce
  }
  style.textContent = CSS
  const box = document.createElement("div")
  box.className = "box"
  const label = document.createElement("button")
  label.type = "button"
  label.className = "label"
  const name = document.createElement("span")
  name.className = "name"
  const word = document.createElement("span")
  label.append(name, word)
  root.append(style, box, label)
  // After the section's label: its fields' labels follow it in the tab order
  const fields = createFieldLayer({ root, onEdit: onEditField })
  document.body.append(host)

  let current: string | null = null
  let factor = 1
  let edit = ""
  let names: Readonly<Record<string, string>> = {}
  const handles = new Map<string, HTMLButtonElement>()

  const press = (event: Event, id: string | null) => {
    event.preventDefault()
    event.stopPropagation()
    if (id) {
      onEdit(id)
    }
  }
  label.addEventListener("click", (event) => {
    press(event, current)
  })

  const labelText = (id: string) => {
    const known = knownName(names, id)
    return known ? `${edit}: ${known}` : edit
  }
  const viewport = () => ({
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
  })

  const drawCurrent = () => {
    const selector = current ? sectionSelector(current) : null
    const element = selector ? document.querySelector(selector) : null
    const rect = element?.getBoundingClientRect()
    if (!current || !rect || rect.width === 0 || rect.height === 0) {
      box.classList.remove("on")
      label.classList.remove("on")
      fields.reposition(null)
      return
    }
    setBox(box, rect)
    box.classList.add("on")
    if (touch || !edit) {
      label.classList.remove("on")
      fields.reposition(null)
      return
    }
    name.textContent = knownName(names, current)
    word.textContent = edit
    label.setAttribute("aria-label", labelText(current))
    setCorner(label, labelPlace(rect, viewport(), factor))
    label.classList.add("on")
    // A field's label keeps clear of the section's (Faz 2b)
    fields.reposition(label.getBoundingClientRect())
  }

  const drawHandles = () => {
    if (!touch) {
      return
    }
    const seen = new Set<string>()
    for (const { id, element } of edit ? drawnSections(document) : []) {
      seen.add(id)
      let handle = handles.get(id)
      if (!handle) {
        handle = document.createElement("button")
        handle.type = "button"
        handle.className = "handle on"
        handle.addEventListener("click", (event) => {
          press(event, id)
        })
        handles.set(id, handle)
        root.append(handle)
      }
      handle.textContent = edit
      handle.setAttribute("aria-label", labelText(id))
      setCorner(handle, labelPlace(element.getBoundingClientRect(), viewport(), factor))
    }
    for (const [id, handle] of handles) {
      if (!seen.has(id)) {
        handle.remove()
        handles.delete(id)
      }
    }
  }

  return {
    setScale(scale) {
      factor = strokeFactor(scale)
      host.style.setProperty("--k", String(factor))
      fields.setFactor(factor)
      drawCurrent()
      drawHandles()
    },
    setLabels(nextEdit, nextNames) {
      edit = nextEdit
      names = nextNames
      fields.setWord(nextEdit)
      drawCurrent()
      drawHandles()
    },
    show(id) {
      // Another section: the last one's field and keyboard labels go
      if (id !== current) {
        fields.show(null)
        fields.handles(null)
      }
      current = id
      drawCurrent()
    },
    shown: () => current,
    showField(field) {
      fields.show(field && current ? { id: current, ...field } : null)
    },
    focusLabel() {
      // The section's fields get the keyboard's labels, after its own (Faz 2b)
      const selector = current ? sectionSelector(current) : null
      const element = selector ? document.querySelector(selector) : null
      fields.handles(current && element ? { id: current, element } : null)
      if (current && label.classList.contains("on")) {
        label.focus({ preventScroll: true })
      } else if (current) {
        handles.get(current)?.focus({ preventScroll: true })
      }
    },
    reposition() {
      drawCurrent()
      drawHandles()
    },
    destroy() {
      fields.destroy()
      host.remove()
      handles.clear()
    },
  }
}

import { isEditable, needsScroll } from "./bridge-core"
import { formAddress, holdAddress, isPlainClick, linkAddress } from "./bridge-nav"
import type { Held } from "./bridge-nav"
import type { Overlay } from "./overlay"
import { drawnSections, sectionAround, sectionStep, stepSection } from "./overlay-core"

/**
 * The preview page's own events, while the bridge runs (adr/0065 §6, Faz
 * 2): the pointer frames the section it is over (rate kept to one frame
 * per animation frame) and the panel's tree row lights up with it; Alt+↓
 * and Alt+↑ step through the sections, the label taking the focus; a link
 * followed or a search sent stays in the frame and is asked of the panel.
 * Clicks still go where they go (owner's decision 1): only their leaving
 * the preview is held. Returns the cleanup.
 */
export function installPageHooks({
  overlay,
  reduced,
  onHover,
  onAsk,
}: {
  overlay: Overlay
  reduced: () => boolean
  /** The section the pointer or the keyboard is on changed (null: none). */
  onHover: (id: string | null) => void
  /** A page of the shop asked for from the frame. */
  onAsk: (path: string, previewable: boolean) => void
}): () => void {
  let frame = 0
  let pointed: EventTarget | null = null
  const isLayer = (target: EventTarget | null) =>
    target instanceof Element && target.localName === "qt-editor-layer"

  const point = (id: string | null) => {
    if (id !== overlay.shown()) {
      overlay.show(id)
      onHover(id)
    }
  }
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === "touch") {
      return
    }
    pointed = event.target
    if (frame !== 0) {
      return
    }
    frame = requestAnimationFrame(() => {
      frame = 0
      // The layer's own label: the section stays framed
      if (!isLayer(pointed)) {
        point(sectionAround(pointed)?.id ?? null)
      }
    })
  }
  const onLeave = () => {
    point(null)
  }

  const act = (event: Event, held: Held) => {
    if (held.kind === "pass") {
      return
    }
    // Held here: neither the browser nor the page's router leaves the preview
    event.preventDefault()
    event.stopPropagation()
    if (held.kind === "ask") {
      onAsk(held.path, held.previewable)
    }
  }
  const onClick = (event: MouseEvent) => {
    if (!isPlainClick(event) || !(event.target instanceof Element) || isLayer(event.target)) {
      return
    }
    const anchor = event.target.closest("a[href]")
    const address = anchor ? linkAddress(anchor) : null
    if (address !== null) {
      act(event, holdAddress(address, window.location))
    }
  }
  const onSubmit = (event: SubmitEvent) => {
    if (event.defaultPrevented || !(event.target instanceof HTMLFormElement)) {
      return
    }
    const address = formAddress(event.target, event.submitter)
    if (address !== null) {
      act(event, holdAddress(address, window.location))
    }
  }

  const onKey = (event: KeyboardEvent) => {
    const step = sectionStep(event)
    if (step === null || isEditable(event.target)) {
      return
    }
    event.preventDefault()
    const sections = drawnSections(document)
    const next = stepSection(
      sections.map((section) => section.id),
      overlay.shown(),
      step
    )
    const element = sections.find((section) => section.id === next)?.element
    if (!next || !element) {
      return
    }
    if (needsScroll(element.getBoundingClientRect(), window.innerHeight, "if_hidden")) {
      element.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" })
    }
    point(next)
    overlay.focusLabel()
  }

  let follow = 0
  const onMove = () => {
    if (follow === 0) {
      follow = requestAnimationFrame(() => {
        follow = 0
        overlay.reposition()
      })
    }
  }

  window.addEventListener("pointermove", onPointerMove, { passive: true })
  document.documentElement.addEventListener("mouseleave", onLeave)
  window.addEventListener("click", onClick, true)
  window.addEventListener("submit", onSubmit, true)
  window.addEventListener("keydown", onKey, true)
  window.addEventListener("scroll", onMove, { capture: true, passive: true })
  window.addEventListener("resize", onMove)
  return () => {
    cancelAnimationFrame(frame)
    cancelAnimationFrame(follow)
    window.removeEventListener("pointermove", onPointerMove)
    document.documentElement.removeEventListener("mouseleave", onLeave)
    window.removeEventListener("click", onClick, true)
    window.removeEventListener("submit", onSubmit, true)
    window.removeEventListener("keydown", onKey, true)
    window.removeEventListener("scroll", onMove, true)
    window.removeEventListener("resize", onMove)
  }
}

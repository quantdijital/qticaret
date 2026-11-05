"use client"

import { useEffect } from "react"

/** What a finger could mean to press under the button. */
const CONTROL =
  "a[href], button, input, select, textarea, summary, label, [role=button], [role=tab]"

/** The button's round face, where it stands at rest (its hidden transform aside). */
function faceOf(button: HTMLElement) {
  const style = getComputedStyle(button)
  const right = document.documentElement.clientWidth - Number.parseFloat(style.right)
  const bottom = window.innerHeight - Number.parseFloat(style.bottom)
  const radius = button.offsetWidth / 2
  return { x: right - radius, y: bottom - button.offsetHeight / 2, radius }
}

/**
 * Keeps the WhatsApp button off the controls of the parts marked
 * `data-gf-clear` (UX denetimi 2026-11-05): the product page's
 * photographs and buy column with the favourite heart beside "add to
 * cart", its tabs, reviews and related products, and the footer.
 * While one of their controls is the first thing under the button's round
 * face, `<html>` carries `data-js-clear` and the stylesheet lets the
 * button step aside (`frame.css`); it comes back as soon as the control
 * moves on. Asked as the page scrolls, as the window or a marked part
 * changes size; points are hit-tested only while a marked part reaches
 * the button's corner, and pages that mark nothing pay nothing.
 */
export function WhatsAppClear() {
  useEffect(() => {
    const root = document.documentElement
    const button = document.querySelector<HTMLElement>("[data-whatsapp]")
    const parts = document.querySelectorAll<HTMLElement>("[data-gf-clear]")
    if (!button || parts.length === 0) {
      return
    }
    let frame = 0
    // The middle and two rings inside the round face: a 24 px control under it is met
    const points = [[0, 0]]
    for (let step = 0; step < 8; step += 1) {
      const angle = (step * Math.PI) / 4
      points.push([Math.cos(angle), Math.sin(angle)], [Math.cos(angle) / 2, Math.sin(angle) / 2])
    }

    const check = () => {
      frame = 0
      const face = faceOf(button)
      const reach = face.radius - 4
      // Hit-tested only while a marked part reaches the button's square at all
      const near = [...parts].some((part) => {
        const box = part.getBoundingClientRect()
        return (
          box.bottom > face.y - face.radius &&
          box.top < face.y + face.radius &&
          box.right > face.x - face.radius &&
          box.left < face.x + face.radius
        )
      })
      const covered =
        near &&
        points.some(([dx = 0, dy = 0]) => {
          const under = document
            .elementsFromPoint(face.x + dx * reach, face.y + dy * reach)
            .find((element) => !button.contains(element))
          const control = under?.closest(CONTROL)
          return control ? control.closest("[data-gf-clear]") !== null : false
        })
      root.toggleAttribute("data-js-clear", covered)
    }
    const schedule = () => {
      frame ||= window.requestAnimationFrame(check)
    }

    check()
    const sized = new ResizeObserver(schedule)
    for (const part of parts) {
      sized.observe(part)
    }
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule, { passive: true })
    return () => {
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
      sized.disconnect()
      window.cancelAnimationFrame(frame)
      root.removeAttribute("data-js-clear")
    }
  }, [])
  return null
}

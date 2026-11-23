import { readFileSync } from "node:fs"
import { join } from "node:path"
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ScrollArea } from "./ui/scroll-area"

const read = (path: string) => readFileSync(join(import.meta.dirname, path), "utf8")
const squash = (text: string) => text.replace(/\s+/g, "")
const CSS = squash(read("theme/scrollbar.css"))

/** The owner, 2026-11-23: no browser-default scrollbars anywhere in the panel */
describe("the panel's scrollbar", () => {
  it("is part of the shared styles", () => {
    expect(read("styles.css")).toContain('@import "./theme/scrollbar.css";')
  })

  it("is thin with token colours on every scrolling box", () => {
    expect(CSS).toContain(
      squash(`* {
        scrollbar-width: thin;
        scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
      }`)
    )
    expect(CSS).toContain("--scrollbar-base:var(--muted-foreground);")
    expect(CSS).toContain("--scrollbar-thumb:color-mix(inoklch,var(--scrollbar-base)")
    expect(CSS).toContain("--scrollbar-thumb-hover:color-mix(inoklch,var(--scrollbar-base)")
    expect(CSS).toContain(
      '[data-slot="sidebar"]{--scrollbar-base:var(--sidebar-muted-foreground);}'
    )
  })

  it("names no colour of its own, only theme tokens", () => {
    const colours = read("theme/scrollbar.css").match(/#[0-9a-f]{3,8}\b|\b(?:rgb|hsl|oklch)a?\(/gi)
    expect(colours).toBeNull()
  })

  it("draws Safari's bar the same way, never alongside the standard one", () => {
    expect(CSS).toContain("@supports(scrollbar-color:auto)")
    expect(CSS).toContain("@supportsnot(scrollbar-color:auto){::-webkit-scrollbar{")
    expect(CSS).toContain("::-webkit-scrollbar-thumb:hover")
  })

  it("leaves high contrast mode to the system's scrollbars", () => {
    expect(CSS).toContain("@media(forced-colors:none)")
    expect(CSS).toContain(
      "@media(forced-colors:active){*{scrollbar-width:auto;scrollbar-color:auto;}}"
    )
  })

  it("hides only the folded menu's bar", () => {
    expect(CSS.match(/scrollbar-width:none/g)).toHaveLength(1)
    expect(CSS).toContain(
      '[data-collapsible="icon"][data-slot="sidebar-content"]{scrollbar-width:none;}'
    )
  })
})

describe("ScrollArea", () => {
  it("draws its bar with the shared scrollbar classes", () => {
    const { container } = render(
      <ScrollArea type="always" className="h-20">
        <div style={{ height: 400 }}>Uzun içerik</div>
      </ScrollArea>
    )
    const bar = container.querySelector('[data-slot="scroll-area-scrollbar"]')
    expect(bar?.classList.contains("qt-scrollbar")).toBe(true)
    expect(bar?.getAttribute("data-orientation")).toBe("vertical")
    // Radix mounts the thumb only once it measures an overflow, which jsdom never does
    expect(read("ui/scroll-area.tsx")).toContain('className="qt-scrollbar-thumb"')
  })
})

// @vitest-environment jsdom
import { readdirSync, readFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { StoreThemeSettings } from "@qticaret/types"
import { DEFAULT_THEME, themeView } from "@/lib/views/theme"
import { LayerMarks } from "../../../../../packages/themes/atolye/src/frame/Layers"
import { layerMarks, rootMarks } from "../../../../../packages/themes/atolye/src/frame/root-marks"
import { Sheet } from "../../../../../packages/themes/atolye/src/frame/Sheet"

/**
 * The style kit's marks reach the page's layers (adr/0067 Ek 2026-11-15):
 * a Radix portal draws a dialog or a drawer at the end of `body`, outside
 * the theme's root element, so while the box style is `lined` or a kit
 * step is off its default the
 * layers go into a host of their own carrying the root's marks. At
 * today's drawing nothing changes: no host, the layer a child of `body`.
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const theme = (patch: Partial<StoreThemeSettings> = {}) => themeView({ ...DEFAULT_THEME, ...patch })

let mount: HTMLDivElement
let root: Root

beforeEach(() => {
  mount = document.createElement("div")
  document.body.append(mount)
  root = createRoot(mount)
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  mount.remove()
})

/** The sheet stays as the test draws it: open or closed, Escape or not. */
const keep = (open: boolean) => open

function draw(marks: Record<string, string> | null, open = true) {
  act(() => {
    root.render(
      <LayerMarks marks={marks}>
        <Sheet open={open} onOpenChange={keep} side="right" title="Sepet" closeLabel="Kapat">
          <span className="gf-chip">Çip</span>
        </Sheet>
      </LayerMarks>
    )
  })
}

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')

describe("the layers' marks (adr/0067 Ek 2026-11-15)", () => {
  it("has no layer marks at today's drawing: filled boxes, the kit's defaults", () => {
    expect(layerMarks(theme())).toBeNull()
    expect(layerMarks(theme({ surface_style: "filled" }))).toBeNull()
    expect(rootMarks(theme())).toEqual({ "data-surface": "filled" })
  })

  it("gives the layers the lined box style alone (Tezgâh: the cart drawer's quantity)", () => {
    expect(layerMarks(theme({ surface_style: "lined" }))).toEqual({ "data-surface": "lined" })
  })

  it("gives the layers the root's marks while a kit step is off its default", () => {
    const view = theme({ chip_style: "lined", surface_style: "lined" })
    expect(layerMarks(view)).toEqual(rootMarks(view))
    expect(layerMarks(view)).toEqual({ "data-surface": "lined", "data-chip-style": "lined" })
  })

  it("carries shadow none to the layers (the cart and menu sheets, the dialogs), float not", () => {
    expect(layerMarks(theme({ shadow: "float" }))).toBeNull()
    expect(layerMarks(theme({ shadow: "none" }))).toEqual({
      "data-surface": "filled",
      "data-shadow": "none",
    })
  })

  it("leaves a layer a child of body at today's drawing: no host", () => {
    draw(null)
    expect(dialog()?.parentElement).toBe(document.body)
    expect(document.body.querySelector(":scope > [data-surface]")).toBeNull()
  })

  it("draws a layer inside a host that carries the marks, itself a child of body", () => {
    draw({ "data-surface": "filled", "data-chip-style": "lined" })
    const chip = document.querySelector(".gf-chip")
    const host = chip?.closest('[data-chip-style="lined"]')
    expect(host).toBeInstanceOf(HTMLElement)
    expect(host?.parentElement).toBe(document.body)
    expect(host?.getAttribute("data-surface")).toBe("filled")
    expect((host as HTMLElement).style.display).toBe("contents")
    expect(dialog()?.parentElement).toBe(host)
  })

  it("follows the marks as they change, and leaves body when they are gone", () => {
    draw({ "data-surface": "filled", "data-chip-style": "lined" })
    draw({ "data-surface": "lined", "data-media-ground": "page" })
    const host = dialog()?.parentElement
    expect(host?.getAttribute("data-media-ground")).toBe("page")
    expect(host?.getAttribute("data-surface")).toBe("lined")
    expect(host?.hasAttribute("data-chip-style")).toBe(false)
    draw(null)
    expect(host?.isConnected).toBe(false)
    expect(dialog()?.parentElement).toBe(document.body)
  })

  it("keeps the host while closed and takes it away with the layout", () => {
    draw({ "data-surface": "filled", "data-shadow": "none" }, false)
    expect(dialog()).toBeNull()
    expect(document.body.querySelectorAll(':scope > [data-shadow="none"]')).toHaveLength(1)
    act(() => {
      root.render(null)
    })
    expect(document.body.querySelector(':scope > [data-shadow="none"]')).toBeNull()
  })
})

const THEME_SRC = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../packages/themes/atolye/src"
)

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      return sourceFiles(path)
    }
    return /\.tsx?$/.test(entry.name) ? [path] : []
  })
}

describe("every portal of the theme goes through its layers", () => {
  it("has no bare portal outside frame/Layers.tsx", () => {
    const bare = sourceFiles(THEME_SRC)
      .filter((file) => relative(THEME_SRC, file) !== join("frame", "Layers.tsx"))
      .filter((file) => /\b[A-Z]\w*\.Portal\b|\bcreatePortal\b/.test(readFileSync(file, "utf8")))
      .map((file) => relative(THEME_SRC, file))
    // A new layer (Popover, Tooltip, DropdownMenu…) gets its wrapper in `frame/Layers.tsx`
    expect(bare).toEqual([])
  })

  it("draws the seven layers through LayerPortal", () => {
    const users = sourceFiles(THEME_SRC)
      .filter((file) => readFileSync(file, "utf8").includes("<LayerPortal>"))
      .map((file) => relative(THEME_SRC, file))
      .sort()
    expect(users).toEqual([
      "frame/QuickViewDialog.tsx",
      "frame/SearchDrop.tsx",
      "frame/Sheet.tsx",
      // adr/0077 §6: the search box's calendar
      "parts/DatePicker.tsx",
      "product/Installments.tsx",
      "product/Write.tsx",
      "product/Zoom.tsx",
    ])
  })
})

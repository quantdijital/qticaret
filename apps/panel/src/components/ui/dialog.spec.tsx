import { cleanup, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import "@/lib/i18n"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "./alert-dialog"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogSection,
  DialogTitle,
} from "./dialog"
import type { DialogSize } from "./dialog"

function renderDialog(size?: DialogSize) {
  render(
    <Dialog open>
      <DialogContent {...(size ? { size } : {})}>
        <DialogTitle>Başlık</DialogTitle>
        <DialogDescription>Açıklama</DialogDescription>
        <DialogBody list>
          <DialogSection title="Ürünler">
            <ul>
              <li>Şef bıçağı</li>
            </ul>
          </DialogSection>
        </DialogBody>
        <DialogFooter>
          <button type="button">Kaydet</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
  return {
    box: screen.getByRole("dialog"),
    footer: screen.getByRole("button", { name: "Kaydet" }).closest("[data-slot=dialog-footer]"),
  }
}

/** The classes that hold the box together (the owner, 2026-11-03: the refund dialog spilled out). */
function expectHeld(box: HTMLElement) {
  // One column that never grows past the box: a long truncated name stays inside
  expect(box).toHaveClass("grid", "grid-cols-[minmax(0,1fr)]")
  // Taller than 85% of the screen: it scrolls inside instead of running off it
  expect(box).toHaveClass("overflow-y-auto", "max-h-dvh", "sm:max-h-(--dialog-max-height)")
  // A phone: a sheet along the bottom edge, its actions in reach
  expect(box).toHaveClass("inset-x-0", "bottom-0", "sm:top-[50%]", "sm:bottom-auto")
}

describe("DialogContent", () => {
  it("keeps its content inside, scrolls when tall and is a bottom sheet on a phone", () => {
    expectHeld(renderDialog().box)
  })

  it("is a form's width unless its size says otherwise, and keeps all that", () => {
    const { box } = renderDialog()
    expect(box).toHaveAttribute("data-size", "md")
    expect(box).toHaveClass("sm:max-w-(--dialog-width-md)")
    cleanup()
    const wide = renderDialog("lg").box
    expectHeld(wide)
    expect(wide).toHaveClass("sm:max-w-(--dialog-width-lg)")
    expect(wide).not.toHaveClass("sm:max-w-(--dialog-width-md)")
  })

  it("gives room around and between its parts (the owner, 2026-11-03: ferah)", () => {
    const { box } = renderDialog()
    // 24 px apart, inside 24 px of padding on a phone and 32 px from `sm` up
    expect(box).toHaveClass("gap-6", "p-6", "sm:p-8")
    // A one-line list does not leave a strip; its section is named
    expect(box.querySelector("[data-slot=dialog-body]")).toHaveClass("gap-5", "sm:min-h-44")
    expect(screen.getByRole("heading", { level: 3, name: "Ürünler" })).toBeInTheDocument()
  })

  it("pins its footer to the box's bottom edge over what scrolls under it", () => {
    const { footer } = renderDialog()
    // `-bottom-6`: the browser sticks it inside the box's padding, which it covers
    expect(footer).toHaveClass("sticky", "-bottom-6", "-mb-6", "pb-6", "bg-background")
    expect(footer).toHaveClass("sm:-bottom-8", "sm:-mb-8", "sm:pb-8")
  })
})

describe("a pane dialog", () => {
  it("keeps its header and footer where they are and scrolls only its body (the owner, 2026-11-05)", () => {
    render(
      <Dialog open>
        <DialogContent size="xl" pane>
          <DialogTitle>Görsel seçin</DialogTitle>
          <DialogDescription>Kütüphane</DialogDescription>
          <DialogBody>
            <p>Izgara</p>
          </DialogBody>
          <DialogFooter>
            <button type="button">Seç</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
    const box = screen.getByRole("dialog")
    expect(box).toHaveAttribute("data-pane")
    // One height on the size scale, whatever the tab or the page shows
    expect(box).toHaveClass("flex", "flex-col", "overflow-hidden", "sm:h-(--dialog-max-height)")
    expect(box).not.toHaveClass("grid", "overflow-y-auto")
    expect(box).toHaveClass("sm:max-w-(--dialog-width-xl)")
    expect(box.querySelector("[data-slot=dialog-body]")).toHaveClass(
      "group-data-[pane]/pane:flex-1",
      "group-data-[pane]/pane:overflow-y-auto"
    )
  })
})

describe("AlertDialogContent", () => {
  it("is held the same way as a dialog", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>Silinsin mi?</AlertDialogTitle>
          <AlertDialogDescription>Geri alınamaz.</AlertDialogDescription>
          <AlertDialogFooter>
            <button type="button">Sil</button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
    expectHeld(screen.getByRole("alertdialog"))
    // A confirm is the narrowest dialog
    expect(screen.getByRole("alertdialog")).toHaveClass("sm:max-w-(--dialog-width-sm)")
    expect(
      screen.getByRole("button", { name: "Sil" }).closest("[data-slot=alert-dialog-footer]")
    ).toHaveClass("sticky", "-bottom-6")
  })
})

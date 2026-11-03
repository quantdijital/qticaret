import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import "@/lib/i18n"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "./alert-dialog"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "./dialog"

function renderDialog(className?: string) {
  render(
    <Dialog open>
      <DialogContent className={className}>
        <DialogTitle>Başlık</DialogTitle>
        <DialogDescription>Açıklama</DialogDescription>
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
  // Taller than the screen: it scrolls inside instead of running off it
  expect(box).toHaveClass("overflow-y-auto", "max-h-dvh", "sm:max-h-[calc(100dvh-2rem)]")
  // A phone: a sheet along the bottom edge, its actions in reach
  expect(box).toHaveClass("inset-x-0", "bottom-0", "sm:top-[50%]", "sm:bottom-auto")
}

describe("DialogContent", () => {
  it("keeps its content inside, scrolls when tall and is a bottom sheet on a phone", () => {
    expectHeld(renderDialog().box)
  })

  it("keeps all that when a dialog only sets its width", () => {
    const { box } = renderDialog("sm:max-w-3xl")
    expectHeld(box)
    expect(box).toHaveClass("sm:max-w-3xl")
    expect(box).not.toHaveClass("sm:max-w-lg")
  })

  it("pins its footer to the box's bottom edge over what scrolls under it", () => {
    const { footer } = renderDialog()
    // `-bottom-6`: the browser sticks it inside the box's padding, which it covers
    expect(footer).toHaveClass("sticky", "-bottom-6", "-mb-6", "pb-6", "bg-background")
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
    expect(
      screen.getByRole("button", { name: "Sil" }).closest("[data-slot=alert-dialog-footer]")
    ).toHaveClass("sticky", "-bottom-6")
  })
})

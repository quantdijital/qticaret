import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useRef, useState } from "react"
import { describe, expect, it } from "vitest"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu"
import { ConfirmDialog } from "./confirm-dialog"
import { DetailDialog } from "./detail-dialog"
import { FormDialog } from "./form-dialog"

/**
 * A button that opens a form dialog from the parent's state, no Radix
 * trigger and no `returnFocus` (as Güvenlik's "Profili düzenle" does).
 * `vanish`: the button leaves the page as it opens the dialog.
 * `back`: a `returnFocus` to another button.
 */
function Profile({
  vanish = false,
  back = false,
  dirty = false,
}: {
  vanish?: boolean
  back?: boolean
  dirty?: boolean
}) {
  const [open, setOpen] = useState(false)
  const other = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={other} type="button">
        Başka bir şey
      </button>
      {vanish && open ? null : (
        <button
          type="button"
          onClick={() => {
            setOpen(true)
          }}
        >
          Profili düzenle
        </button>
      )}
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Profil"
        dirty={dirty}
        saving={false}
        onSubmit={() => {
          setOpen(false)
        }}
        {...(back ? { returnFocus: () => other.current } : {})}
      >
        <input aria-label="Ad" />
      </FormDialog>
    </>
  )
}

async function openProfile() {
  const user = userEvent.setup()
  const opener = screen.getByRole("button", { name: "Profili düzenle" })
  await user.click(opener)
  expect(await screen.findByRole("dialog")).toBeInTheDocument()
  return { user, opener }
}

async function closed() {
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
}

describe("FormDialog returning the caret by default", () => {
  it("returns it to the button that opened it, after Escape", async () => {
    render(<Profile />)
    const { user, opener } = await openProfile()
    await user.keyboard("{Escape}")
    await closed()
    await waitFor(() => {
      expect(document.activeElement).toBe(opener)
    })
  })

  it("returns it after the close button", async () => {
    render(<Profile />)
    const { user, opener } = await openProfile()
    await user.click(screen.getByRole("button", { name: "Kapat" }))
    await closed()
    await waitFor(() => {
      expect(document.activeElement).toBe(opener)
    })
  })

  it("returns it after the close button and the discard question", async () => {
    render(<Profile dirty />)
    const { user, opener } = await openProfile()
    await user.click(screen.getByRole("button", { name: "Kapat" }))
    await user.click(await screen.findByRole("button", { name: "Değişiklikleri at" }))
    await closed()
    await waitFor(() => {
      expect(document.activeElement).toBe(opener)
    })
  })

  it("returns it after saving", async () => {
    render(<Profile dirty />)
    const { user, opener } = await openProfile()
    await user.click(screen.getByRole("button", { name: "Kaydet" }))
    await closed()
    await waitFor(() => {
      expect(document.activeElement).toBe(opener)
    })
  })

  it("lets returnFocus win over the opener", async () => {
    render(<Profile back />)
    const { user } = await openProfile()
    await user.keyboard("{Escape}")
    await closed()
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Başka bir şey" }))
    })
  })

  it("gives up quietly when the opener has left the page", async () => {
    render(<Profile vanish />)
    const { user } = await openProfile()
    expect(screen.queryByRole("button", { name: "Profili düzenle" })).not.toBeInTheDocument()
    await user.keyboard("{Escape}")
    await closed()
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(document.activeElement).toBe(document.body)
  })

  it("takes the menu's trigger when a menu item opened it", async () => {
    function RowMenu() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger>İşlemler</DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onSelect={() => {
                  setOpen(true)
                }}
              >
                Düzenle
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <FormDialog
            open={open}
            onOpenChange={setOpen}
            title="Satır"
            dirty={false}
            saving={false}
            onSubmit={() => undefined}
          >
            <input aria-label="Ad" />
          </FormDialog>
        </>
      )
    }
    const user = userEvent.setup()
    render(<RowMenu />)
    const trigger = screen.getByRole("button", { name: "İşlemler" })
    trigger.focus()
    await user.keyboard("{Enter}")
    await user.click(await screen.findByRole("menuitem", { name: "Düzenle" }))
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    await user.keyboard("{Escape}")
    await closed()
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger)
    })
  })
})

describe("ConfirmDialog and DetailDialog returning the caret", () => {
  it("returns it from a confirm opened from state", async () => {
    function Remove() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setOpen(true)
            }}
          >
            Sil
          </button>
          <ConfirmDialog
            open={open}
            onOpenChange={setOpen}
            title="Silinsin mi?"
            description="Geri alınamaz."
            confirmLabel="Kaydı sil"
            onConfirm={() => undefined}
          />
        </>
      )
    }
    const user = userEvent.setup()
    render(<Remove />)
    const opener = screen.getByRole("button", { name: "Sil" })
    await user.click(opener)
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Vazgeç" }))
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    })
    await waitFor(() => {
      expect(document.activeElement).toBe(opener)
    })
  })

  it("returns it from a record's dialog opened from its row", async () => {
    function Row() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setOpen(true)
            }}
          >
            Sipariş 1001
          </button>
          <DetailDialog open={open} onOpenChange={setOpen} title="Sipariş">
            <p>Ayrıntı</p>
          </DetailDialog>
        </>
      )
    }
    const user = userEvent.setup()
    render(<Row />)
    const opener = screen.getByRole("button", { name: "Sipariş 1001" })
    await user.click(opener)
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    await user.keyboard("{Escape}")
    await closed()
    await waitFor(() => {
      expect(document.activeElement).toBe(opener)
    })
  })
})

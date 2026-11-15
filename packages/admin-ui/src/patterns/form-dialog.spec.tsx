import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useRef, useState } from "react"
import { describe, expect, it } from "vitest"
import { FormDialog } from "./form-dialog"

/**
 * A row that opens its dialog from the parent's state, no Radix trigger
 * (as the theme editor's slide rows do); `opened` opens it from code, the
 * caret elsewhere (as the preview's edit label does).
 */
function Rows({ back = true, opened = false }: { back?: boolean; opened?: boolean }) {
  const [open, setOpen] = useState(opened)
  const row = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button type="button">Başka bir şey</button>
      <button
        ref={row}
        type="button"
        onClick={() => {
          setOpen(true)
        }}
      >
        Slaytı düzenle
      </button>
      {open ? (
        <FormDialog
          open
          onOpenChange={setOpen}
          title="Slaydı düzenle"
          dirty={false}
          saving={false}
          onSubmit={() => undefined}
          {...(back ? { returnFocus: () => row.current } : {})}
        >
          <input aria-label="Başlık" />
        </FormDialog>
      ) : null}
    </>
  )
}

describe("FormDialog returning the caret", () => {
  it("returns it to the row that opened it, after Escape", async () => {
    const user = userEvent.setup()
    render(<Rows />)
    const row = screen.getByRole("button", { name: "Slaytı düzenle" })
    await user.click(row)
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    await user.keyboard("{Escape}")
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
    await waitFor(() => {
      expect(document.activeElement).toBe(row)
    })
  })

  it("takes it to the row when opened from code, the caret elsewhere", async () => {
    const user = userEvent.setup()
    render(<Rows opened />)
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    await user.keyboard("{Escape}")
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Slaytı düzenle" }))
    })
  })

  it("leaves Radix's own way unchanged without it: no trigger, the caret falls to the page", async () => {
    const user = userEvent.setup()
    render(<Rows back={false} />)
    await user.click(screen.getByRole("button", { name: "Slaytı düzenle" }))
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    await user.keyboard("{Escape}")
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(document.activeElement).toBe(document.body)
  })
})

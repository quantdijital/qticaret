import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { CardForm } from "./card-form"
import { DirtyRegistryProvider, createDirtyRegistry } from "./dirty-registry"
import { HeaderSaveActions } from "./header-save-actions"

vi.mock("@tanstack/react-router", () => ({
  useBlocker: () => ({ status: "idle" }),
}))

/** A card that saves on its own: typed text is its change, "Kaydet" keeps it. */
function Card({ name, onSave }: { name: string; onSave: (value: string) => void }) {
  const [saved, setSaved] = useState("")
  const [value, setValue] = useState("")
  return (
    <CardForm
      title={name}
      dirty={value !== saved}
      saving={false}
      onSubmit={() => {
        setSaved(value)
        onSave(value)
      }}
      onReset={() => {
        setValue(saved)
      }}
    >
      <label>
        {name}
        <input
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
          }}
        />
      </label>
    </CardForm>
  )
}

function Page({ first = vi.fn(), second = vi.fn() }) {
  return (
    <DirtyRegistryProvider>
      <HeaderSaveActions />
      <Card name="Genel" onSave={first} />
      <Card name="SEO" onSave={second} />
    </DirtyRegistryProvider>
  )
}

const group = () => screen.getByRole("group", { name: "Sayfanın kaydı" })
const headerButton = (name: string) => within(group()).getByRole("button", { name })

describe("the page's one save in its header (docs/06 'Ürün sayfası')", () => {
  it("rests as a disabled 'Kaydedildi' until a card holds changes, then saves each through its own save", async () => {
    const first = vi.fn()
    const second = vi.fn()
    render(<Page first={first} second={second} />)
    expect(headerButton("Kaydedildi")).toBeDisabled()
    expect(within(group()).queryByRole("button", { name: "Vazgeç" })).toBeNull()

    await userEvent.type(screen.getByRole("textbox", { name: "Genel" }), "Kupa")
    await userEvent.type(screen.getByRole("textbox", { name: "SEO" }), "Kupa al")
    expect(group()).toHaveTextContent("2 bölümde değişiklik")

    await userEvent.click(headerButton("Kaydet"))
    expect(first).toHaveBeenCalledWith("Kupa")
    expect(second).toHaveBeenCalledWith("Kupa al")
    expect(headerButton("Kaydedildi")).toBeDisabled()
    expect(group()).not.toHaveTextContent("bölümde")
  })

  it("lets every change go after asking", async () => {
    render(<Page />)
    await userEvent.type(screen.getByRole("textbox", { name: "Genel" }), "Kupa")
    await userEvent.click(headerButton("Vazgeç"))
    await userEvent.click(screen.getByRole("button", { name: "Değişiklikleri at" }))
    expect(screen.getByRole("textbox", { name: "Genel" })).toHaveValue("")
    expect(headerButton("Kaydedildi")).toBeDisabled()
  })

  it("saves on Ctrl+S and keeps the browser's own save away, but not inside a dialog", async () => {
    const first = vi.fn()
    render(<Page first={first} />)
    await userEvent.type(screen.getByRole("textbox", { name: "Genel" }), "Kupa")
    const event = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(first).toHaveBeenCalledWith("Kupa")

    const dialog = document.createElement("div")
    dialog.setAttribute("role", "dialog")
    document.body.append(dialog)
    first.mockClear()
    await userEvent.type(screen.getByRole("textbox", { name: "Genel" }), "!")
    fireEvent.keyDown(dialog, { key: "s", metaKey: true })
    expect(first).not.toHaveBeenCalled()
    dialog.remove()
  })

  it("draws nothing outside a page that has one", () => {
    render(<HeaderSaveActions />)
    expect(screen.queryByRole("group", { name: "Sayfanın kaydı" })).toBeNull()
  })
})

describe("createDirtyRegistry", () => {
  it("counts the forms with changes and tells its listeners only when that changes", () => {
    const registry = createDirtyRegistry()
    const listener = vi.fn()
    registry.subscribe(listener)
    const entry = { dirty: true, saving: false, submit: vi.fn(), reset: vi.fn() }
    registry.set("a", entry)
    registry.set("a", { ...entry })
    registry.set("b", { ...entry, dirty: false })
    expect(registry.state()).toEqual({ dirty: 1, saving: false })
    expect(listener).toHaveBeenCalledTimes(1)

    registry.remove("a")
    expect(registry.state()).toEqual({ dirty: 0, saving: false })
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it("saves and lets go only the forms with changes, never one already saving", () => {
    const registry = createDirtyRegistry()
    const changed = { dirty: true, saving: false, submit: vi.fn(), reset: vi.fn() }
    const busy = { dirty: true, saving: true, submit: vi.fn(), reset: vi.fn() }
    const clean = { dirty: false, saving: false, submit: vi.fn(), reset: vi.fn() }
    registry.set("a", changed)
    registry.set("b", busy)
    registry.set("c", clean)
    registry.submitAll()
    registry.resetAll()
    expect(changed.submit).toHaveBeenCalledTimes(1)
    expect(busy.submit).not.toHaveBeenCalled()
    expect(clean.submit).not.toHaveBeenCalled()
    expect(changed.reset).toHaveBeenCalledTimes(1)
    expect(clean.reset).not.toHaveBeenCalled()
  })
})

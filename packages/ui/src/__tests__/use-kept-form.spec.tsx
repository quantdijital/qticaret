// @vitest-environment jsdom
import { act, useActionState } from "react"
import type { ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { KeptForm } from "../components/kept-form"
import { useKeptForm } from "../hooks/use-kept-form"
import type { ActionResult, FormAction } from "../theme"

/**
 * React 19 empties a form whose `action` is a function once the action
 * settles, refused or not. `useKeptForm` and `KeptForm` send it through
 * `onSubmit` instead: a refusal keeps every field, an accepted send
 * empties the form.
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement("div")
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  host.remove()
})

function Fields() {
  return (
    <>
      <input name="title" />
      <textarea name="body" />
      <input type="radio" name="rating" value="3" />
      <input type="radio" name="rating" value="5" defaultChecked />
      <select name="reason" defaultValue="">
        <option value="">—</option>
        <option value="damaged">Hasarlı</option>
      </select>
      <button type="submit">Gönder</button>
    </>
  )
}

function Kept({ action }: { action: FormAction }) {
  const { state, form } = useKeptForm(action)
  return (
    <form {...form}>
      <Fields />
      <p role="status">{state.error ?? (state.ok ? "sent" : "")}</p>
    </form>
  )
}

/** React's own way, for the record: what the hook is for. */
function Plain({ action }: { action: FormAction }) {
  const [state, send] = useActionState(action, { ok: false, error: null } as ActionResult)
  return (
    <form action={send}>
      <Fields />
      <p role="status">{state.error ?? ""}</p>
    </form>
  )
}

function render(node: ReactNode) {
  act(() => {
    root.render(node)
  })
}

/** A field by selector; read as an input, which every field here answers to. */
const field = (selector: string): HTMLInputElement => {
  const found = host.querySelector<HTMLInputElement>(selector)
  if (!found) {
    throw new Error(`No ${selector}`)
  }
  return found
}

function type() {
  field('[name="title"]').value = "Çok keskin"
  field('[name="body"]').value = "Kutusundan çıktığı gibi kağıt kesiyor."
  field('[name="rating"][value="3"]').checked = true
  field('[name="reason"]').value = "damaged"
}

async function send() {
  await act(async () => {
    field("button").click()
    await Promise.resolve()
  })
}

const typed = () => ({
  title: field('[name="title"]').value,
  body: field('[name="body"]').value,
  rating: field('[name="rating"]:checked').value,
  reason: field('[name="reason"]').value,
  status: field('[role="status"]').textContent,
})

const refuse: FormAction = () => Promise.resolve({ ok: false, error: "product.review_too_short" })
const accept: FormAction = () => Promise.resolve({ ok: true, error: null })

describe("a form sent by React's own action", () => {
  it("comes back empty after a refusal (the bug the hook avoids)", async () => {
    render(<Plain action={refuse} />)
    type()
    await send()
    expect(typed()).toEqual({
      title: "",
      body: "",
      rating: "5",
      reason: "",
      status: "product.review_too_short",
    })
  })
})

describe("useKeptForm", () => {
  it("keeps every field as typed when the action refuses, and says why", async () => {
    const action = vi.fn(refuse)
    render(<Kept action={action} />)
    type()
    await send()
    expect(action).toHaveBeenCalledTimes(1)
    const sent = action.mock.calls[0]?.[1]
    expect(sent?.get("title")).toBe("Çok keskin")
    expect(sent?.get("rating")).toBe("3")
    expect(typed()).toEqual({
      title: "Çok keskin",
      body: "Kutusundan çıktığı gibi kağıt kesiyor.",
      rating: "3",
      reason: "damaged",
      status: "product.review_too_short",
    })
  })

  it("empties the form once the action accepts it", async () => {
    render(<Kept action={accept} />)
    type()
    await send()
    expect(typed()).toEqual({ title: "", body: "", rating: "5", reason: "", status: "sent" })
  })
})

describe("KeptForm", () => {
  it("sends the fields to a plain action and leaves them as typed", async () => {
    const action = vi.fn<(form: FormData) => Promise<void>>(() => Promise.resolve())
    render(
      <KeptForm action={action}>
        <Fields />
        <p role="status" />
      </KeptForm>
    )
    type()
    await send()
    expect(action).toHaveBeenCalledTimes(1)
    expect(action.mock.calls[0]?.[0].get("body")).toBe("Kutusundan çıktığı gibi kağıt kesiyor.")
    expect(typed()).toMatchObject({ title: "Çok keskin", rating: "3", reason: "damaged" })
  })
})

import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { StepUpHost } from "@/components/layout/step-up-host"
import type { KeysOverview, SigningKey } from "@/features/keys/api"
import { rotationStep } from "@/features/keys/rotation"
import { STEP_UP_HEADER, forgetStepUp } from "@/lib/step-up"
import { refusal, stubApi } from "@/test/api"
import type { Answer, Sent } from "@/test/api"
import { renderAs } from "@/test/member"
import { KeysPage } from "./keys-page"

vi.mock("@tanstack/react-router", () => import("@/test/router-mock"))

const PROOF = {
  step_up: { token: "proof-1", expires_at: new Date(Date.now() + 300_000).toISOString() },
}

const key = (kid: string, status: SigningKey["status"]): SigningKey => ({
  kid,
  public_key: `${kid}-public`,
  status,
  created_at: "2026-11-01T09:00:00.000Z",
  activated_at: status === "next" ? null : "2026-11-01T09:00:00.000Z",
  retired_at: null,
})

const overview = (keys: SigningKey[], keks: Partial<KeysOverview["keks"]> = {}): KeysOverview => ({
  signing_keys: keys,
  published: {
    keys: keys.filter((each) => each.status !== "retired"),
    env_value: keys
      .filter((each) => each.status !== "retired")
      .map((each) => each.public_key)
      .join(","),
  },
  keks: {
    keks: [
      {
        kek_id: "aaaa1111bbbb2222",
        state: "current",
        records: { secret_record: 2, tenant_company: 1 },
        total: 3,
      },
      {
        kek_id: "cccc3333dddd4444",
        state: "older",
        records: { secret_record: 0, tenant_company: 1 },
        total: 1,
      },
    ],
    pending: 1,
    stranded: 0,
    removable: [],
    ...keks,
  },
})

function controlPlane(state: KeysOverview) {
  return (call: Sent): Answer => {
    if (call.path === "/admin/cp/keys") {
      return { status: 200, body: state }
    }
    if (call.path === "/admin/cp/me/step-up") {
      return { status: 200, body: PROOF }
    }
    if (!call.headers[STEP_UP_HEADER]) {
      return refusal(428, "cp.step_up_required")
    }
    if (call.path.endsWith("/rewrap")) {
      return { status: 200, body: { rewrapped: 1, failed: 0, status: state.keks } }
    }
    return { status: 200, body: {} }
  }
}

const page = () =>
  renderAs(
    <>
      <KeysPage />
      <StepUpHost />
    </>,
    "owner"
  )

async function proveWithCode() {
  await userEvent.type(await screen.findByLabelText("Doğrulama kodu"), "123456")
  await userEvent.click(screen.getByRole("button", { name: "Doğrula" }))
}

describe("KeysPage: the keys (adr/0061 §4, Ek C8)", () => {
  beforeEach(() => {
    forgetStepUp()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("shows key ids, statuses, fingerprints and counts; nothing secret is asked for", async () => {
    const sent = stubApi(controlPlane(overview([key("kid-a", "active"), key("kid-b", "next")])))
    page()

    expect(await screen.findByText("kid-a")).toBeInTheDocument()
    expect(screen.getByText("İmzalıyor")).toBeInTheDocument()
    expect(screen.getByText("Sıradaki")).toBeInTheDocument()
    expect(screen.getByText("kid-a-public,kid-b-public")).toBeInTheDocument()
    expect(screen.getByText("aaaa1111bbbb2222")).toBeInTheDocument()
    expect(screen.getByText("Eski")).toBeInTheDocument()
    expect(
      screen.getByText("1 kayıt eski anahtarla sarılı. Yeniden sarınca eski anahtar çıkarılabilir.")
    ).toBeInTheDocument()
    expect(sent.map((call) => call.path)).toEqual(["/admin/cp/keys"])
  })

  it("rewraps behind the step-up", async () => {
    const sent = stubApi(controlPlane(overview([key("kid-a", "active")])))
    page()

    await userEvent.click(await screen.findByRole("button", { name: "Yeniden sar" }))
    await proveWithCode()

    await waitFor(() => {
      expect(
        sent.filter((call) => call.path === "/admin/cp/keys/rewrap").at(-1)?.headers[STEP_UP_HEADER]
      ).toBe("proof-1")
    })
    // The overview is read again afterwards
    await waitFor(() => {
      expect(sent.filter((call) => call.path === "/admin/cp/keys").length).toBeGreaterThan(1)
    })
  })

  it("says plainly what a key removed too soon left unreadable, and which old key may go", async () => {
    stubApi(
      controlPlane(
        overview([key("kid-a", "active")], { stranded: 4, removable: ["cccc3333dddd4444"] })
      )
    )
    page()

    expect(await screen.findByText("Açılamayan kayıtlar var")).toBeInTheDocument()
    expect(
      screen.getByText(/4 kayıt yapılandırmada olmayan bir anahtarla sarılı/)
    ).toBeInTheDocument()
    expect(
      screen.getByText("cccc3333dddd4444 artık boş; CP_MASTER_KEY'den çıkarılabilir.")
    ).toBeInTheDocument()
  })

  it("switches to the next key only after asking, behind the step-up", async () => {
    const sent = stubApi(controlPlane(overview([key("kid-a", "active"), key("kid-b", "next")])))
    page()

    await userEvent.click(await screen.findByRole("button", { name: "Yeni anahtara geç" }))
    const confirm = await screen.findByRole("alertdialog")
    expect(confirm).toHaveTextContent("kid-b")
    await userEvent.click(within(confirm).getByRole("button", { name: "Yeni anahtara geç" }))
    await proveWithCode()

    await waitFor(() => {
      expect(
        sent.filter((call) => call.path === "/admin/cp/keys/signing/switch").at(-1)?.headers[
          STEP_UP_HEADER
        ]
      ).toBe("proof-1")
    })
  })

  it("retires the old key only after a destructive confirmation", async () => {
    const sent = stubApi(controlPlane(overview([key("kid-a", "previous"), key("kid-b", "active")])))
    page()

    await userEvent.click(await screen.findByRole("button", { name: "Eski anahtarı kaldır" }))
    const confirm = await screen.findByRole("alertdialog")
    expect(confirm).toHaveTextContent("kid-a anahtarı mağazaların listesinden çıkar")
    await userEvent.click(within(confirm).getByRole("button", { name: "Vazgeç" }))

    expect(sent.some((call) => call.path.endsWith("/retire"))).toBe(false)
  })

  it("names the rotation's next step", () => {
    expect(rotationStep([])).toBe("create")
    expect(rotationStep([key("a", "active")])).toBe("prepare")
    expect(rotationStep([key("a", "active"), key("b", "next")])).toBe("switch")
    expect(rotationStep([key("a", "previous"), key("b", "active")])).toBe("retire")
    expect(rotationStep([key("a", "retired"), key("b", "active")])).toBe("prepare")
  })
})

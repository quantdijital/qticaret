import { randomBytes } from "node:crypto"
import { fakeVkn, seededRandom, startFakeParasut } from "@qticaret/testing"
import type { FakeParasut } from "@qticaret/testing"
import { ANONYMOUS_TCKN } from "../../types"
import type { InvoiceDraft } from "../../types"
import type { AdvanceOutcome, KeptProgress, ProgramState } from "../../provider"
import { createParasutApi, createParasutOauth } from ".."
import { parasutProvider } from "../provider"

const client = { clientId: "test-parasut", clientSecret: randomBytes(16).toString("hex") }
const user = { username: "test@example.com", password: randomBytes(16).toString("hex") }
const fast = { timeoutMs: 1000, retry: { baseDelayMs: 1 }, sleep: () => Promise.resolve() }

const draft = (changes: Partial<InvoiceDraft["buyer"]> = {}): InvoiceDraft => ({
  order: { id: "order_1", number: "1042", date: "2026-10-30" },
  currency: "TRY",
  buyer: {
    kind: "person",
    name: "Ayşe Yılmaz",
    tax_id: ANONYMOUS_TCKN,
    tax_office: null,
    email: "ayse@example.com",
    phone: null,
    address: "Moda Cad. No: 1",
    city: "İstanbul",
    district: "Kadıköy",
    postal_code: "34710",
    ...changes,
  },
  lines: [
    {
      description: "Döküm tava - 28 cm",
      quantity: 3,
      unit_net: "83.3333",
      discount_net: "0.00",
      vat_rate: 20,
      net: "250.00",
      vat: "50.00",
      gross: "300.00",
    },
  ],
  totals: { net: "250.00", vat: "50.00", gross: "300.00" },
  internet_sale: {
    url: "https://ornek.com",
    payment: "card",
    platform: "PayTR",
    paid_on: "2026-10-30",
  },
  shipment: {
    carrier: { title: "Örnek Kargo A.Ş.", tax_id: "1234567890" },
    shipped_on: "2026-10-31",
  },
})

describe("Paraşüt as the invoice program (adr/0034 §4, §7)", () => {
  let fake: FakeParasut
  let state: ProgramState
  let clock: number
  let cancelled: boolean
  const kept: KeptProgress[] = []
  const adopted: string[] = []

  const run = (invoice: InvoiceDraft): Promise<AdvanceOutcome> => {
    const api = createParasutApi(fake.companyId, { ...fast, origin: fake.url })
    const token = createParasutOauth({ ...fast, origin: fake.url })
      .exchangeCode(client, fake.issueCode())
      .then((pair) => pair.accessToken)
    const provider = parasutProvider(async (call) => call(api, await token, fake.companyId))
    return provider.advance(state, {
      draft: () => Promise.resolve(invoice),
      keep: (progress) => {
        kept.push(progress)
        Object.assign(state, progress)
        return Promise.resolve(true)
      },
      adopt: (externalId) => {
        adopted.push(externalId)
        return Promise.resolve()
      },
      cancelRequested: () => Promise.resolve(cancelled),
      now: () => new Date(clock),
    })
  }
  const apply = (outcome: AdvanceOutcome) => {
    if (outcome.next === "issuing" || outcome.next === "issued") {
      Object.assign(state, outcome.progress)
    }
    return outcome
  }

  beforeEach(async () => {
    fake = await startFakeParasut(client, user)
    process.env["PARASUT_BASE_URL"] = fake.url
    clock = Date.parse("2026-10-31T09:00:00Z")
    kept.length = 0
    adopted.length = 0
    cancelled = false
    state = {
      id: "inv_1",
      external_id: null,
      document_id: null,
      document_type: null,
      job_id: null,
      job_started_at: null,
      number: null,
      cancellable_until: null,
      company_id: null,
    }
  })

  afterEach(async () => {
    delete process.env["PARASUT_BASE_URL"]
    await fake.close()
  })

  it("issues an e-Arşiv for a person step by step, the invoice kept before the job starts", async () => {
    const started = apply(await run(draft()))
    const running = apply(await run(draft()))
    const numbered = apply(await run(draft()))
    const issued = apply(await run(draft()))
    const job = [...fake.jobs.values()][0]

    expect(started).toMatchObject({ next: "issuing", progress: { document_type: "e_archive" } })
    expect(kept.find((progress) => progress.external_id)).toMatchObject({
      external_id: state.external_id,
      company_id: fake.companyId,
    })
    expect(job?.attributes).toEqual({
      internet_sale: {
        url: "https://ornek.com",
        payment_type: "KREDIKARTI/BANKAKARTI",
        payment_platform: "PayTR",
        payment_date: "2026-10-30",
      },
      shipment: { title: "Örnek Kargo A.Ş.", vkn: "1234567890", date: "2026-10-31" },
    })
    expect(running).toEqual({ next: "waiting" })
    // The job is done but the PDF is not ready yet: the number is kept already
    expect(numbered).toEqual({ next: "waiting" })
    expect(state.number).toMatch(/^SHT\d{13}$/)
    expect(issued).toMatchObject({ next: "issued", progress: { number: state.number } })
    expect(issued.next === "issued" && issued.pdf.subarray(0, 5).toString()).toBe("%PDF-")
    expect(kept.find((progress) => progress.external_id)?.program_difference).toBeNull()
    expect(fake.invoices.size).toBe(1)
  })

  it("sends a company with an inbox an e-Fatura, found again as one contact", async () => {
    const vkn = fakeVkn(seededRandom(11))
    fake.inboxes.add(vkn)
    const company = draft({
      kind: "company",
      name: "Örnek Ltd. Şti.",
      tax_id: vkn,
      tax_office: "Kadıköy",
    })

    const started = await run(company)
    state = { ...state, external_id: null, job_started_at: null }
    await run(company)
    const contacts = fake.requests.filter(
      (r) => r.method === "POST" && r.path.endsWith("/contacts")
    )

    expect(started).toMatchObject({ next: "issuing", progress: { document_type: "e_invoice" } })
    expect([...fake.jobs.values()][0]?.attributes).toEqual({
      scenario: "basic",
      to: `urn:mail:${vkn}@sahte.parasut`,
    })
    expect(contacts).toHaveLength(1)
  })

  it("never sends an invoice twice when Paraşüt's answer is lost, and stops for staff", async () => {
    fake.queue("POST /sales_invoices", { drop: true })

    expect(await run(draft())).toEqual({
      next: "failed",
      code: "einvoice.outcome_unknown",
      stop: true,
    })
    expect(state.external_id).toBeNull()
  })

  it("says a job failed by a code, never Paraşüt's words", async () => {
    fake.failNextJob(["Ayşe Yılmaz için adres eksik"])
    apply(await run(draft()))
    apply(await run(draft()))

    expect(await run(draft())).toEqual({ next: "failed", code: "parasut.job_error" })
  })

  it("stops for staff when Paraşüt's answer to a write cannot be read, never sending it again", async () => {
    fake.queue("POST /sales_invoices", { status: 201, body: { data: { attributes: {} } } })

    expect(await run(draft())).toEqual({
      next: "failed",
      code: "einvoice.outcome_unknown",
      stop: true,
    })
  })

  it("takes only an exact contact and inbox, never a near match", async () => {
    const near = { id: "c_near", type: "contacts", attributes: { email: "ayse@example.com.tr" } }
    fake.queue("GET /contacts", { body: { data: [near] } })
    const vkn = "1234567890"
    fake.queue("GET /e_invoice_inboxes", {
      body: {
        data: [
          {
            id: "i_near",
            type: "e_invoice_inboxes",
            attributes: { vkn: "11234567890", e_invoice_address: "urn:mail:baska@x" },
          },
        ],
      },
    })
    const company = draft({
      kind: "company",
      name: "Örnek Ltd. Şti.",
      tax_id: vkn,
      tax_office: "Kadıköy",
    })
    fake.queue("GET /contacts", {
      body: { data: [{ ...near, attributes: { tax_number: "11234567890" } }] },
    })

    const started = await run(company)
    const contacts = fake.requests.filter(
      (r) => r.method === "POST" && r.path.endsWith("/contacts")
    )

    expect(contacts).toHaveLength(1)
    expect(started).toMatchObject({ next: "issuing", progress: { document_type: "e_archive" } })
  })

  it("never follows an invoice in a company other than the one it was made in", async () => {
    state = { ...state, external_id: "ps_1", company_id: "999999", job_started_at: new Date(clock) }

    expect(await run(draft())).toEqual({
      next: "failed",
      code: "einvoice.company_changed",
      stop: true,
    })
  })

  it("starts no e-document for an order canceled meanwhile", async () => {
    cancelled = true

    expect(await run(draft())).toEqual({ next: "waiting" })
    expect(fake.jobs.size).toBe(0)
    expect(state.external_id).toBeTruthy()
  })
})

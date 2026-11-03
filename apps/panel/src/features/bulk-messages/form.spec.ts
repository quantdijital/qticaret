import { describe, expect, it } from "vitest"
import type { BulkMessage } from "./api/types"
import {
  EMPTY_DOC,
  editorSchema,
  hasSource,
  isEmptyDoc,
  missingContent,
  requestOf,
  toggleSource,
  valuesOf,
} from "./form"
import type { EditorValues } from "./form"

const paragraph = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] })
const card = (id: string) => ({ type: "productCard", attrs: { id } })

const values = (more: Partial<EditorValues> = {}): EditorValues => ({
  name: "Kış indirimi",
  channel: "email",
  audience: [{ kind: "all_consented" }],
  subject: "{ad}, kış indirimi başladı",
  preheader: "",
  body: { type: "doc", content: [paragraph("Merhaba {ad}, {mağaza_adı} indirimde.")] },
  sms_text: "",
  ...more,
})

const errorsOf = (input: EditorValues, parts?: (text: string) => number | null) => {
  const result = editorSchema(parts).safeParse(input)
  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.map((issue) => [issue.path.join("."), issue.message]))
}

describe("the editor's checks (the backend's AdminUpdateCampaign)", () => {
  it("passes a draft with a name, a source and known tokens", () => {
    expect(errorsOf(values())).toEqual({})
  })

  it("wants a name and at least one source, ten at most", () => {
    expect(errorsOf(values({ name: "  ", audience: [] }))).toEqual({
      name: "bulkMessages.errors.nameRequired",
      audience: "bulkMessages.errors.audienceRequired",
    })
    const many = Array.from({ length: 11 }, (_, index) => ({
      kind: "group" as const,
      id: `cusgroup_${String(index)}`,
    }))
    expect(errorsOf(values({ audience: many }))).toEqual({
      audience: "bulkMessages.errors.audienceTooMany",
    })
  })

  it("refuses a token that is neither {ad} nor a shop detail, in a line or the body", () => {
    expect(
      errorsOf(
        values({
          subject: "{isim}, fırsat",
          body: { type: "doc", content: [paragraph("{indirim_kodu}")] },
        })
      )
    ).toEqual({
      subject: "bulkMessages.errors.tokenUnknown",
      body: "bulkMessages.errors.tokenUnknown",
    })
  })

  it("holds four product cards at most, the same product counted once", () => {
    const body = (ids: string[]) => ({ type: "doc", content: ids.map(card) })
    expect(errorsOf(values({ body: body(["p1", "p2", "p3", "p4", "p1"]) }))).toEqual({})
    expect(errorsOf(values({ body: body(["p1", "p2", "p3", "p4", "p5"]) }))).toEqual({
      body: "bulkMessages.errors.tooManyProducts",
    })
  })

  it("refuses a text past three SMS as it would go, and lets it through while uncounted", () => {
    const sms = values({ channel: "sms", sms_text: "Kış indirimi" })
    expect(errorsOf(sms, () => 4)).toEqual({ sms_text: "bulkMessages.errors.smsTooLong" })
    expect(errorsOf(sms, () => 3)).toEqual({})
    expect(errorsOf(sms, () => null)).toEqual({})
  })
})

describe("the body the editor sends", () => {
  it("sends every editable field, an empty line or document as null", () => {
    expect(
      requestOf(values({ name: " Kış ", preheader: "  ", body: EMPTY_DOC, sms_text: "" }))
    ).toEqual({
      name: "Kış",
      channel: "email",
      audience: [{ kind: "all_consented" }],
      subject: "{ad}, kış indirimi başladı",
      preheader: null,
      body: null,
      sms_text: null,
    })
  })

  it("keeps a document holding only a card or an image", () => {
    const body = { type: "doc", content: [card("prod_1")] }
    expect(isEmptyDoc(body)).toBe(false)
    expect(requestOf(values({ body })).body).toEqual(body)
    expect(isEmptyDoc({ type: "doc", content: [{ type: "paragraph" }] })).toBe(true)
  })

  it("reads a stored campaign back into the fields", () => {
    const stored = {
      name: "SMS",
      channel: "sms",
      audience: [{ kind: "newsletter" }],
      subject: null,
      preheader: null,
      body: null,
      sms_text: "Kış indirimi",
    } as BulkMessage
    expect(valuesOf(stored)).toEqual({
      name: "SMS",
      channel: "sms",
      audience: [{ kind: "newsletter" }],
      subject: "",
      preheader: "",
      body: EMPTY_DOC,
      sms_text: "Kış indirimi",
    })
  })
})

describe("before a test or a send", () => {
  it("names what the channel still needs", () => {
    expect(missingContent(values({ subject: " ", body: EMPTY_DOC }))).toEqual(["subject", "body"])
    expect(missingContent(values({ channel: "sms", sms_text: "" }))).toEqual(["sms_text"])
    expect(missingContent(values())).toEqual([])
  })
})

describe("the audience's sources", () => {
  it("adds and drops a source, never twice", () => {
    const segment = { kind: "segment", id: "cseg_1" } as const
    const added = toggleSource([{ kind: "newsletter" }], segment, true)
    expect(added).toEqual([{ kind: "newsletter" }, segment])
    expect(toggleSource(added, segment, true)).toEqual(added)
    expect(hasSource(added, { kind: "segment", id: "cseg_2" })).toBe(false)
    expect(toggleSource(added, segment, false)).toEqual([{ kind: "newsletter" }])
  })
})

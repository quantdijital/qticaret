import { join } from "node:path"
import type { AiCreditTask } from "@qticaret/types/control-plane"
import { prepareBody } from "../body"
import { gatewayTargetOf } from "../target"

/**
 * A Photoroom form held to the parts the shop's connector sends (security
 * review of P3b D1): the shop's own forms (apps/backend photoroom.ts
 * `multipartBody`, loaded at run time) pass as their bytes; an address
 * to fetch (`imageUrl`), a field not sent today, a second file or a form
 * not in shape is refused.
 */

interface File {
  field: string
  filename: string
  mimeType: string
  bytes: Buffer
}
// eslint-disable-next-line @typescript-eslint/no-require-imports -- a path outside this app's root, test only
const { multipartBody } = require(
  join(__dirname, "../../../../../backend/src/lib/ai/connectors/photoroom")
) as {
  multipartBody: (
    fields: Readonly<Record<string, string>>,
    file: File
  ) => { body: Buffer; contentType: string }
}

const picture = Buffer.from(Array.from({ length: 2048 }, (_, index) => index % 256))
const file = (field: string): File => ({
  field,
  filename: "image.png",
  mimeType: "image/png",
  bytes: picture,
})

const send = (form: { body: Buffer; contentType: string }, task: AiCreditTask) => {
  const target = gatewayTargetOf("photoroom", "image_edit", task)
  if (target === null) {
    throw new Error("no target")
  }
  return prepareBody({
    raw: form.body,
    contentType: form.contentType,
    task,
    capability: "image_edit",
    target,
  })
}

describe("a Photoroom form's parts (P3b review D1)", () => {
  it("passes the shop's own forms as their bytes", () => {
    const forms: [Record<string, string>, string, AiCreditTask][] = [
      [{ format: "jpg", bg_color: "white" }, "image_file", "image_background"],
      [{ format: "png" }, "image_file", "image_background"],
      [
        { "background.prompt": "ahşap masa", referenceBox: "originalImage" },
        "imageFile",
        "image_scene",
      ],
    ]
    for (const [fields, field, task] of forms) {
      const form = multipartBody(fields, file(field))
      const result = send(form, task)
      expect(result).toMatchObject({ ok: true, images: 1 })
      expect(result.ok && result.body.equals(form.body)).toBe(true)
    }
  })

  it("refuses an address to fetch, a field not sent today and a second file", () => {
    const refused = (fields: Record<string, string>, field: string, task: AiCreditTask) =>
      send(multipartBody(fields, file(field)), task)
    expect(
      refused({ imageUrl: "https://example.com/a.png" }, "imageFile", "image_scene")
    ).toMatchObject({
      ok: false,
      code: "body_refused",
      reason: "form_field_refused",
    })
    expect(refused({ outputSize: "8000x8000" }, "imageFile", "image_scene")).toMatchObject({
      reason: "form_field_refused",
    })
    // The scene's file name on the cut-out's endpoint, and the other way
    expect(refused({ format: "png" }, "imageFile", "image_background")).toMatchObject({
      reason: "form_file_refused",
    })
    const part = (name: string) =>
      `--b\r\ncontent-disposition: form-data; name="${name}"; filename="a.png"\r\n\r\nxx\r\n`
    const twoFiles = Buffer.from(`${part("imageFile")}${part("imageFile")}--b--\r\n`)
    const type = "multipart/form-data; boundary=b"
    expect(send({ body: twoFiles, contentType: type }, "image_scene")).toMatchObject({
      ok: false,
      reason: "form_file_refused",
    })
  })

  it("refuses a form not in shape, never reading past it", () => {
    const form = multipartBody({ format: "png" }, file("image_file"))
    const cut = form.body.subarray(0, form.body.length - 10)
    expect(send({ body: cut, contentType: form.contentType }, "image_background")).toMatchObject({
      ok: false,
      reason: "form_unreadable",
    })
    const preamble = Buffer.concat([Buffer.from("hello\r\n"), form.body])
    expect(
      send({ body: preamble, contentType: form.contentType }, "image_background")
    ).toMatchObject({
      ok: false,
      reason: "form_unreadable",
    })
    const long = multipartBody({ "background.prompt": "x".repeat(40 * 1024) }, file("imageFile"))
    expect(send(long, "image_scene")).toMatchObject({ ok: false, code: "body_too_large" })
  })

  // Second review N3: one boundary, no other parameter; the type sent is the gateway's
  it("reads one boundary alone and writes the type the provider is sent", () => {
    const form = multipartBody({ format: "png" }, file("image_file"))
    const boundary = form.contentType.split("boundary=")[1] ?? ""
    expect(send(form, "image_background")).toMatchObject({
      ok: true,
      contentType: `multipart/form-data; boundary=${boundary}`,
    })
    // Spelled otherwise, or quoted: the same form, its type written back plain
    for (const type of [
      `Multipart/Form-Data;BOUNDARY=${boundary}`,
      `multipart/form-data; boundary="${boundary}"`,
    ]) {
      const result = send({ body: form.body, contentType: type }, "image_background")
      expect(result).toMatchObject({
        ok: true,
        contentType: `multipart/form-data; boundary=${boundary}`,
      })
      expect(result.ok && result.body.equals(form.body)).toBe(true)
    }
    const refused = { ok: false, code: "body_refused", reason: "type_not_form" }
    for (const type of [
      `multipart/form-data; boundary=${boundary}; boundary=other`,
      `multipart/form-data; boundary=other; boundary=${boundary}`,
      `multipart/form-data; x="; boundary=${boundary}"; boundary=other`,
      `multipart/form-data; x="; boundary=${boundary}"`,
      `multipart/form-data; boundary=${boundary}; charset=utf-8`,
      `multipart/form-data; charset=utf-8; boundary=${boundary}`,
      `multipart/form-data; boundary=${boundary}"`,
      `multipart/form-data; boundary="${boundary}`,
      `multipart/form-data; boundary=`,
      `multipart/form-data; boundary=${"b".repeat(71)}`,
      `multipart/mixed; boundary=${boundary}`,
    ]) {
      expect([type, send({ body: form.body, contentType: type }, "image_background")]).toEqual([
        type,
        refused,
      ])
    }
  })
})

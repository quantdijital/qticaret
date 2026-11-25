import { prepareBody } from "../body"
import { gatewayTargetOf } from "../target"
import type { GatewayTarget } from "../target"

/**
 * Bria's body rebuilt from an allow-list (body-bria.ts): the picture as
 * base64 alone, the scene's words for a scene alone, the target's fixed
 * fields (`sync: true` among them) written by the gateway; an address,
 * a webhook or any other field never reaches Bria.
 */

const PNG = Buffer.concat([
  Buffer.from("89504e470d0a1a0a", "hex"),
  Buffer.from("0000000d49484452", "hex"),
]).toString("base64")
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1]).toString("base64")

type Task = "image_background" | "image_scene"

const targetOf = (task: Task): GatewayTarget => {
  const target = gatewayTargetOf("bria", "image_edit", task)
  if (target === null) {
    throw new Error("no Bria target")
  }
  return target
}

const prepared = (body: unknown, task: Task) =>
  prepareBody({
    raw: Buffer.from(JSON.stringify(body)),
    contentType: "application/json",
    task,
    capability: "image_edit",
    target: targetOf(task),
  })

const sent = (body: unknown, task: Task): Record<string, unknown> => {
  const result = prepared(body, task)
  if (!result.ok) {
    throw new Error(`refused: ${result.reason}`)
  }
  expect(result.contentType).toBe("application/json")
  expect(result.images).toBe(1)
  return JSON.parse(result.body.toString("utf8")) as Record<string, unknown>
}

const reason = (body: unknown, task: Task) => {
  const result = prepared(body, task)
  return result.ok ? "sent" : result.reason
}

describe("a Bria body", () => {
  it("sends a cut-out's picture with the gateway's own fields, and nothing else", () => {
    expect(
      sent(
        {
          image: PNG,
          sync: false,
          model: "RMBG3",
          prompt: "a prompt is priced higher",
          webhook_url: "https://attacker.example/hook",
          visual_input_content_moderation: true,
        },
        "image_background"
      )
    ).toEqual({ model: "RMBG2", sync: true, image: PNG })
  })

  it("sends a scene's picture and words in fibo2, at the input's size, synchronously", () => {
    expect(
      sent(
        {
          image: JPEG,
          prompt: "a marble counter",
          mode: "high_control",
          ref_images: ["https://attacker.example/x.png"],
          seed: 7,
          negative_prompt: "x",
          original_quality: false,
        },
        "image_scene"
      )
    ).toEqual({
      mode: "fibo2",
      original_quality: true,
      sync: true,
      image: JPEG,
      prompt: "a marble counter",
    })
  })

  it("refuses a picture by address, a data URL, a non-picture and no picture at all", () => {
    for (const image of [
      "https://shop.example/media/a.png",
      `data:image/png;base64,${PNG}`,
      Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>").toString("base64"),
      `${PNG} `,
      42,
    ]) {
      expect(reason({ image }, "image_background")).not.toBe("sent")
    }
    expect(reason({}, "image_background")).toBe("image_refused")
    expect(reason({ images: [PNG] }, "image_background")).toBe("image_refused")
  })

  it("refuses a scene without words, or with more than any scene of the shop's", () => {
    expect(reason({ image: PNG }, "image_scene")).toBe("prompt_refused")
    expect(reason({ image: PNG, prompt: "  " }, "image_scene")).toBe("prompt_refused")
    expect(reason({ image: PNG, prompt: "x".repeat(2_001) }, "image_scene")).toBe("prompt_refused")
    expect(reason({ image: PNG, prompt: ["a"] }, "image_scene")).toBe("prompt_refused")
  })

  it("refuses a form or any type but JSON", () => {
    const result = prepareBody({
      raw: Buffer.from("x"),
      contentType: "multipart/form-data; boundary=b",
      task: "image_background",
      capability: "image_edit",
      target: targetOf("image_background"),
    })
    expect(result).toMatchObject({ ok: false, reason: "type_not_json" })
  })
})

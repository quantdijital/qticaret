import { describe, expect, it } from "vitest"
import { richTextView } from "../rich-text"

const PICTURE = {
  url: "https://cdn.example.com/media/atolye.jpg",
  alt: "Atölyede bileme",
  width: 1200,
  height: 900,
  derivatives: null,
}
const story = { id: "hikaye", type: "rich_text" as const, title: "Hakkımızda", html: "<p>x</p>" }

describe("the rich text's view (adr/0073 §3)", () => {
  it("reads a rich text from before variants as the pane, printed as it was", () => {
    expect(richTextView(story)).toEqual(story)
    // A variant this build does not know, or the picture variant without its picture: the pane
    expect(richTextView({ ...story, variant: "collage" as never, image: PICTURE })).toEqual(story)
    expect(richTextView({ ...story, variant: "with_image", image: null })).toEqual(story)
  })

  it("carries the picture with its alt and its side, the start by default", () => {
    const view = richTextView({ ...story, variant: "with_image", image: PICTURE })
    expect(view).toMatchObject({
      variant: "with_image",
      image: { src: PICTURE.url, alt: "Atölyede bileme", width: 1200, height: 900 },
      imageSide: "start",
    })
    expect(
      richTextView({ ...story, variant: "with_image", image: PICTURE, image_side: "end" })
    ).toMatchObject({ imageSide: "end" })
  })
})

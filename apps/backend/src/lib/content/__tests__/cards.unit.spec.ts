import { cardKeys, docImageSrcs } from "../cards"

describe("the cards a stored value holds (adr/0073 Ek 2026-11-19 (2) K2)", () => {
  it("finds product and category cards however deep, each once", () => {
    const design = {
      home: [
        {
          type: "rich_text",
          body: {
            type: "doc",
            content: [
              { type: "productCard", attrs: { id: "prod_1" } },
              { type: "blockquote", content: [{ type: "categoryCard", attrs: { id: "pcat_1" } }] },
            ],
          },
        },
      ],
      pages: [
        { sections: [{ body: { content: [{ type: "productCard", attrs: { id: "prod_1" } }] } }] },
      ],
    }
    expect([...cardKeys(design)].sort()).toEqual(["category:pcat_1", "product:prod_1"])
  })

  it("finds none in nothing, and ignores a card without an id", () => {
    expect(cardKeys(null).size).toBe(0)
    expect(cardKeys({ type: "productCard", attrs: {} }).size).toBe(0)
    expect(cardKeys("productCard").size).toBe(0)
  })
})

describe("the pictures a stored value's texts hold", () => {
  it("finds every image node's address however deep, and nothing else", () => {
    const value = {
      pages: [
        {
          sections: [
            {
              image: { url: "https://cdn.example.com/yan.webp" },
              body: {
                content: [
                  { type: "image", attrs: { src: "https://cdn.example.com/a.webp" } },
                  {
                    type: "blockquote",
                    content: [{ type: "image", attrs: { src: "https://cdn.example.com/b.webp" } }],
                  },
                ],
              },
            },
          ],
        },
      ],
    }
    expect([...docImageSrcs(value)].sort()).toEqual([
      "https://cdn.example.com/a.webp",
      "https://cdn.example.com/b.webp",
    ])
    expect(docImageSrcs(null).size).toBe(0)
    expect(docImageSrcs({ type: "image", attrs: {} }).size).toBe(0)
  })
})

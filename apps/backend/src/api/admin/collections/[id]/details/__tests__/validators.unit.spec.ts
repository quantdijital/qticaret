import { AdminPostCollectionDetails } from "../validators"

const parse = (body: unknown) => AdminPostCollectionDetails.safeParse(body)

describe("a collection's details body", () => {
  it("takes paragraphs, visibility and a storage picture, each on its own", () => {
    expect(parse({ description: "Birinci.\n\nİkinci.\tSon." }).success).toBe(true)
    expect(parse({ is_active: false }).success).toBe(true)
    expect(parse({ image: null }).success).toBe(true)
    expect(parse({}).success).toBe(true)
  })

  it("makes an empty alt text none", () => {
    const parsed = parse({ image: { url: "/static/yaz.png", alt: "  " } })
    expect(parsed.success && parsed.data.image).toEqual({ url: "/static/yaz.png", alt: null })
  })

  // Whether an https address is one of the shop's uploads is the workflow's check
  it("refuses control characters, addresses no storage gives and unknown fields", () => {
    expect(parse({ description: "Bozuk\u0007metin" }).success).toBe(false)
    expect(parse({ description: "x".repeat(20_001) }).success).toBe(false)
    const outside = parse({ image: { url: "ftp://baska.example/a.png", alt: null } })
    expect(outside.success).toBe(false)
    expect(outside.error?.issues[0]?.message).toBe("catalog.collection_image_unknown")
    expect(parse({ title: "Yaz" }).success).toBe(false)
    expect(parse({ image: { url: "/static/a.png", alt: null, rank: 1 } }).success).toBe(false)
  })
})

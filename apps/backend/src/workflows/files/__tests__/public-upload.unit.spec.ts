import { s3PublicUrl } from "../public-upload"

describe("a public file's address under S3", () => {
  it("is the provider's file_url and the key, each segment encoded", () => {
    expect(s3PublicUrl("https://cdn.example.com/shop/", "kupa-on-01J.jpg")).toBe(
      "https://cdn.example.com/shop/kupa-on-01J.jpg"
    )
    expect(s3PublicUrl("https://cdn.example.com/shop", "a dir/kupa ön.jpg")).toBe(
      "https://cdn.example.com/shop/a%20dir/kupa%20%C3%B6n.jpg"
    )
  })
})

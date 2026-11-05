import { uploadStem } from "../files"

describe("an old media library's files (adr/0059)", () => {
  it("gives every size and copy of one upload the same stem", () => {
    const stem = "/wp-content/uploads/2024/05/kapak"
    for (const path of [
      "/wp-content/uploads/2024/05/kapak.jpg",
      "/wp-content/uploads/2024/05/kapak-300x200.jpg",
      "/wp-content/uploads/2024/05/kapak-scaled.jpg",
      "/wp-content/uploads/2024/05/kapak-rotated.jpg",
      "/wp-content/uploads/2024/05/kapak-e1612345678901.jpg",
      "/wp-content/uploads/2024/05/kapak-e1612345678901-300x200.jpg",
      "/wp-content/uploads/2024/05/kapak.jpg.webp",
      "/wp-content/uploads/2024/05/kapak-1024x768.png.avif",
      "/wp-content/uploads/2024/05/kapak.webp",
    ]) {
      expect(uploadStem(path)).toBe(stem)
    }
  })

  it("keeps what tells two uploads apart", () => {
    expect(uploadStem("/wp-content/uploads/2024/05/kapak-1.jpg")).toBe(
      "/wp-content/uploads/2024/05/kapak-1"
    )
    expect(uploadStem("/wp-content/uploads/2024/06/kapak.jpg")).toBe(
      "/wp-content/uploads/2024/06/kapak"
    )
    expect(uploadStem("/wp-content/uploads/2024/05/bicak-20-cm.jpg")).toBe(
      "/wp-content/uploads/2024/05/bicak-20-cm"
    )
  })
})

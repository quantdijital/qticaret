import { returnUrlProblem } from "../checkout"

const origins = ["https://magaza.example.com", "http://localhost:8000"]

describe("returnUrlProblem (adr/0026: no open redirect)", () => {
  it("accepts addresses on the storefront's origins only", () => {
    expect(
      returnUrlProblem(
        { success: "https://magaza.example.com/odeme/tamam", failure: "http://localhost:8000/x" },
        origins
      )
    ).toBeNull()
    expect(
      returnUrlProblem(
        { success: "https://evil.example.com/", failure: "https://magaza.example.com/" },
        origins
      )
    ).toBe("return_urls.success")
    expect(
      returnUrlProblem(
        { success: "https://magaza.example.com/", failure: "https://magaza.example.com.evil.io/" },
        origins
      )
    ).toBe("return_urls.failure")
  })
})

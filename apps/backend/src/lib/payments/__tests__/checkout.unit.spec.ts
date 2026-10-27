import { returnOrigins, returnUrlProblem } from "../checkout"

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

  it("refuses user info and backslashes, which browsers read their own way", () => {
    for (const success of [
      "https://user@magaza.example.com/odeme",
      "https://magaza.example.com\\@evil.example.com/",
    ]) {
      expect(
        returnUrlProblem({ success, failure: "https://magaza.example.com/hata" }, origins)
      ).toBe("return_urls.success")
    }
  })
})

describe("returnOrigins", () => {
  const env = {
    STORE_CORS: "http://localhost:8000, https://magaza.example.com",
    ADMIN_CORS: "http://localhost:9000",
  }

  it("is the storefront's origins, plus the backend's own in development (adr/0028)", () => {
    expect(returnOrigins({ ...env, NODE_ENV: "production" })).toEqual([
      "http://localhost:8000",
      "https://magaza.example.com",
    ])
    expect(returnOrigins({ ...env, NODE_ENV: undefined })).not.toContain("http://localhost:9000")
    expect(returnOrigins({ ...env, NODE_ENV: "development" })).toContain("http://localhost:9000")
  })
})

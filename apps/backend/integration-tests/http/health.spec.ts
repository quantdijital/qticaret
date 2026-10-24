import { medusaIntegrationTestRunner } from "@medusajs/test-utils"

jest.setTimeout(60 * 1000)

// test-utils types `api` as any; narrow to what this suite uses
interface HttpClient {
  get(url: string): Promise<{ status: number }>
}

medusaIntegrationTestRunner({
  testSuite: ({ api }) => {
    const http = api as HttpClient

    describe("GET /health", () => {
      it("responds 200 when the app boots against a fresh database", async () => {
        const response = await http.get("/health")

        expect(response.status).toEqual(200)
      })
    })
  },
})

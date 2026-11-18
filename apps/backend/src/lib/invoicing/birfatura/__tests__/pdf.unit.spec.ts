import { createServer } from "node:http"
import type { Server } from "node:http"
import type { AddressInfo } from "node:net"
import { downloadBirfaturaPdf, isBirfaturaPdfHost } from "../pdf"

const PDF = Buffer.from("%PDF-1.4\n% fatura\n%%EOF\n")

describe("BirFatura's invoice PDF (adr/0072 §3.11)", () => {
  let server: Server
  let origin: string

  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === "/dosyagetir?tur=1&guid=a.pdf") {
        res.writeHead(200, { "content-type": "application/pdf" }).end(PDF)
      } else if (req.url === "/html") {
        res.writeHead(200, { "content-type": "text/html" }).end("<html>")
      } else {
        res.writeHead(404).end()
      }
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    origin = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`
  })

  afterAll(async () => {
    await new Promise<void>((resolve) =>
      server.close(() => {
        resolve()
      })
    )
  })

  it.each([
    ["birfatura.com", true],
    ["uygulama.birfatura.com", true],
    ["test1.birfatura.com", true],
    ["uygulama.edonustur.com", false],
    ["BIRFATURA.COM", true],
    ["birfatura.com.example.net", false],
    ["evilbirfatura.com", false],
    ["parasut.com", false],
  ])("allows %s: %s", (host, allowed) => {
    expect(isBirfaturaPdfHost(host)).toBe(allowed)
  })

  it.each([
    ["plain HTTP", "http://test1.birfatura.com/dosyagetir?guid=a.pdf"],
    ["another host", "https://files.example.com/a.pdf"],
    ["a look-alike host", "https://birfatura.com.example.net/a.pdf"],
    ["credentials in the address", "https://user:pw@test1.birfatura.com/a.pdf"],
    ["an address inside the network", "https://127.0.0.1/a.pdf"],
    ["not an address", "fatura.pdf"],
  ])("never fetches from %s", async (_name, url) => {
    await expect(downloadBirfaturaPdf(url, "http://127.0.0.1:9")).rejects.toMatchObject({
      provider: "birfatura",
      providerCode: "pdf_url_invalid",
    })
  })

  it("takes the PDF from the fake BirFatura on this machine", async () => {
    await expect(
      downloadBirfaturaPdf(`${origin}/dosyagetir?tur=1&guid=a.pdf`, origin)
    ).resolves.toEqual(PDF)
  })

  it("refuses a file that is not a PDF, and a missing one", async () => {
    await expect(downloadBirfaturaPdf(`${origin}/html`, origin)).rejects.toMatchObject({
      providerCode: "pdf_not_pdf",
    })
    await expect(downloadBirfaturaPdf(`${origin}/none`, origin)).rejects.toMatchObject({
      providerCode: "pdf_http_404",
    })
  })

  it("does not take the fake's origin for another loopback port", async () => {
    await expect(
      downloadBirfaturaPdf("http://127.0.0.1:1/dosyagetir?tur=1&guid=a.pdf", origin)
    ).rejects.toMatchObject({ providerCode: "pdf_url_invalid" })
  })
})

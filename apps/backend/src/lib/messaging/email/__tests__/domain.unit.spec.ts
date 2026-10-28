import type { MailResolver } from "../domain"
import { createMailDomainCheck, mailDomainOf } from "../domain"

type Answer = string[] | { exchange: string; priority: number }[] | string

// A DNS with fixed answers: a list, or an error code
function fakeDns(zone: Record<string, { mx?: Answer; a?: Answer; aaaa?: Answer }>) {
  const asked: string[] = []
  const answer = <T>(domain: string, kind: "mx" | "a" | "aaaa"): Promise<T> => {
    asked.push(`${kind}:${domain}`)
    const value = zone[domain]?.[kind] ?? (zone[domain] ? "ENODATA" : "ENOTFOUND")
    return typeof value === "string"
      ? Promise.reject(Object.assign(new Error(value), { code: value }))
      : Promise.resolve(value as T)
  }
  const resolver: MailResolver = {
    resolveMx: (domain) => answer(domain, "mx"),
    resolve4: (domain) => answer(domain, "a"),
    resolve6: (domain) => answer(domain, "aaaa"),
  }
  return { resolver, asked }
}

describe("mail domain check (F10 M9)", () => {
  it("takes a domain by its MX, or by its own address without one (RFC 5321)", async () => {
    const { resolver } = fakeDns({
      "magaza.com.tr": { mx: [{ exchange: "mx.magaza.com.tr", priority: 10 }] },
      "eski.net": { a: ["192.0.2.10"] },
    })
    const accepts = createMailDomainCheck({ resolver })

    expect(await accepts("ayse@magaza.com.tr")).toBe(true)
    expect(await accepts("ali@ESKI.net.")).toBe(true)
  })

  it("refuses a domain that does not exist, says it takes no mail, or is reserved", async () => {
    const { resolver, asked } = fakeDns({
      "nomail.org": { mx: [{ exchange: "", priority: 0 }] },
      "bos.com": {},
    })
    const accepts = createMailDomainCheck({ resolver })

    expect(await accepts("x@gmial.cmo")).toBe(false)
    // RFC 7505's null MX
    expect(await accepts("x@nomail.org")).toBe(false)
    expect(await accepts("x@bos.com")).toBe(false)
    expect(await accepts("x@kayit.invalid")).toBe(false)
    expect(await accepts("x@magaza.test")).toBe(false)
    expect(await accepts("not-an-address")).toBe(false)
    expect(asked.some((each) => each.endsWith(".invalid") || each.endsWith(".test"))).toBe(false)
  })

  it("lets an address through when DNS cannot tell, and does not keep that answer", async () => {
    const { resolver, asked } = fakeDns({ "yavas.com": { mx: "ESERVFAIL" } })
    const accepts = createMailDomainCheck({ resolver })

    expect(await accepts("a@yavas.com")).toBe(true)
    expect(await accepts("b@yavas.com")).toBe(true)
    expect(asked.filter((each) => each === "mx:yavas.com")).toHaveLength(2)
  })

  it("lets an address through when DNS does not answer in time", async () => {
    const resolver: MailResolver = {
      resolveMx: () => new Promise(() => undefined),
      resolve4: () => new Promise(() => undefined),
      resolve6: () => new Promise(() => undefined),
    }
    const accepts = createMailDomainCheck({ resolver, timeoutMs: 20 })

    expect(await accepts("a@sessiz.com")).toBe(true)
  })

  it("asks DNS once a day for a domain that takes mail, once an hour for one that does not", async () => {
    let time = 0
    const { resolver, asked } = fakeDns({
      "magaza.com.tr": { mx: [{ exchange: "mx.magaza.com.tr", priority: 10 }] },
    })
    const accepts = createMailDomainCheck({ resolver, now: () => time })
    await accepts("a@magaza.com.tr")
    await accepts("x@yok.com.tr")
    time = 2 * 60 * 60 * 1000
    await accepts("b@magaza.com.tr")
    await accepts("y@yok.com.tr")

    expect(asked.filter((each) => each === "mx:magaza.com.tr")).toHaveLength(1)
    expect(asked.filter((each) => each === "mx:yok.com.tr")).toHaveLength(2)
  })

  it("reads the domain as DNS knows it", () => {
    expect(mailDomainOf("Ayşe@Örnek.com.tr")).toBe("xn--rnek-4qa.com.tr")
    expect(mailDomainOf("@magaza.com")).toBeNull()
    expect(mailDomainOf("a@localhost")).toBeNull()
  })
})

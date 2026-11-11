import { hostnameAvailability, slugAvailability } from "../availability"
import type { AvailabilityLookups } from "../availability"

const lookups = (slugs: string[] = [], hosts: string[] = []) => {
  const asked: string[] = []
  const found: AvailabilityLookups = {
    slugTaken: (slug) => {
      asked.push(`slug:${slug}`)
      return Promise.resolve(slugs.includes(slug))
    },
    hostTaken: (host) => {
      asked.push(`host:${host}`)
      return Promise.resolve(hosts.includes(host))
    },
  }
  return { found, asked }
}

describe("a new shop's address (C11)", () => {
  it("says a free slug is free, with the subdomain it makes", async () => {
    const { found } = lookups()

    expect(await slugAvailability("Kalem-Evi ", "localhost", found)).toEqual({
      value: "kalem-evi",
      hostname: "kalem-evi.localhost",
      problem: null,
    })
  })

  it.each([
    ["ab", "cp.slug_invalid"],
    ["9kalem", "cp.slug_invalid"],
    ["kalem--evi", "cp.slug_invalid"],
    ["www", "cp.slug_reserved"],
    ["giris", "cp.slug_reserved"],
  ])("refuses %s by its rules (%s) without asking the database", async (slug, problem) => {
    const { found, asked } = lookups()

    expect((await slugAvailability(slug, "localhost", found)).problem).toBe(problem)
    expect(asked).toEqual([])
  })

  it("says a slug a shop has is taken, and a subdomain held apart too", async () => {
    const taken = lookups(["kalem"])
    const held = lookups([], ["defter.localhost"])

    expect((await slugAvailability("kalem", "localhost", taken.found)).problem).toBe(
      "cp.slug_taken"
    )
    expect((await slugAvailability("defter", "localhost", held.found)).problem).toBe(
      "cp.domain_taken"
    )
  })

  it.each([
    ["kalem", "cp.domain_invalid"],
    ["kalem.localhost", "cp.domain_invalid"],
    ["-kalem.com", "cp.domain_invalid"],
    ["kalem.quant.com.tr", "cp.domain_platform"],
    ["quant.com.tr", "cp.domain_platform"],
  ])("refuses the own domain %s by its rules (%s)", async (hostname, problem) => {
    const { found, asked } = lookups()

    expect((await hostnameAvailability(hostname, "quant.com.tr", found)).problem).toBe(problem)
    expect(asked).toEqual([])
  })

  it("normalises an own domain and says whether a shop answers on it", async () => {
    const { found } = lookups([], ["kalemevi.com"])

    expect(await hostnameAvailability(" KalemEvi.com. ", "localhost", found)).toEqual({
      value: "kalemevi.com",
      problem: "cp.domain_taken",
    })
    expect(await hostnameAvailability("defter.com.tr", "localhost", found)).toEqual({
      value: "defter.com.tr",
      problem: null,
    })
  })
})

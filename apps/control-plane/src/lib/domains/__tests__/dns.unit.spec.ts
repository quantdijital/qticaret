import { checkDomainDns } from "../dns"
import type { DnsLookup } from "../dns"

const HOST = "www.atolye.com.tr"
const TOKEN = "0123456789abcdef0123456789abcdef"
const NO_TARGET = { cname: null, addresses: [] }
const TARGET = { cname: "edge.quantticaret.com", addresses: ["203.0.113.7"] }

const coded = (code: string) => Object.assign(new Error(code), { code })

/** A resolver answering from a table; a name not in it has no records. */
function lookup(table: {
  txt?: Record<string, string[][]>
  cname?: Record<string, string[]>
  addresses?: Record<string, string[]>
  fail?: string
  hang?: boolean
}): DnsLookup & { asked: string[] } {
  const asked: string[] = []
  const answer = <T>(kind: string, map: Record<string, T[]> | undefined, name: string) => {
    asked.push(`${kind}:${name}`)
    if (table.hang) {
      return new Promise<T[]>(() => undefined)
    }
    if (table.fail) {
      return Promise.reject(coded(table.fail))
    }
    const found = map?.[name]
    return found ? Promise.resolve(found) : Promise.reject(coded("ENOTFOUND"))
  }
  return {
    asked,
    txt: (name) => answer("txt", table.txt, name),
    cname: (name) => answer("cname", table.cname, name),
    addresses: (name) => answer("a", table.addresses, name),
  }
}

describe("a domain's DNS check (F16.7)", () => {
  const txtName = `_qticaret-verify.${HOST}`

  it("finds its token in the TXT record, joining a record's chunks", async () => {
    const dns = lookup({
      txt: {
        [txtName]: [["v=spf1 -all"], ["qticaret-verify=0123456789abcdef", "0123456789abcdef"]],
      },
    })

    expect(await checkDomainDns(HOST, TOKEN, NO_TARGET, dns)).toEqual({
      txt: "match",
      routing: "unknown",
    })
    // Only DNS is asked, and only for the proof while no target is set
    expect(dns.asked).toEqual([`txt:${txtName}`])
  })

  it("tells another token from no record at all", async () => {
    expect(
      (
        await checkDomainDns(
          HOST,
          TOKEN,
          NO_TARGET,
          lookup({ txt: { [txtName]: [["qticaret-verify=someoneelse"]] } })
        )
      ).txt
    ).toBe("mismatch")
    expect((await checkDomainDns(HOST, TOKEN, NO_TARGET, lookup({}))).txt).toBe("missing")
  })

  it("says DNS was unavailable when it fails or does not answer in time", async () => {
    expect(await checkDomainDns(HOST, TOKEN, TARGET, lookup({ fail: "ETIMEOUT" }))).toEqual({
      txt: "unavailable",
      routing: "unavailable",
    })
    const started = Date.now()
    expect(await checkDomainDns(HOST, TOKEN, TARGET, lookup({ hang: true }), 50)).toEqual({
      txt: "unavailable",
      routing: "unavailable",
    })
    expect(Date.now() - started).toBeLessThan(2_000)
  })

  it("routes by CNAME to the target, or by addresses that are all the platform's", async () => {
    const txt = { [txtName]: [[`qticaret-verify=${TOKEN}`]] }
    const byCname = lookup({ txt, cname: { [HOST]: ["Edge.QuantTicaret.com."] } })
    const byAddress = lookup({ txt, addresses: { [HOST]: ["203.0.113.7"] } })
    const flattened = lookup({
      txt,
      addresses: { [HOST]: ["198.51.100.4"], "edge.quantticaret.com": ["198.51.100.4"] },
    })
    const elsewhere = lookup({ txt, addresses: { [HOST]: ["203.0.113.7", "192.0.2.9"] } })

    expect((await checkDomainDns(HOST, TOKEN, TARGET, byCname)).routing).toBe("match")
    expect((await checkDomainDns(HOST, TOKEN, TARGET, byAddress)).routing).toBe("match")
    expect((await checkDomainDns(HOST, TOKEN, TARGET, flattened)).routing).toBe("match")
    expect((await checkDomainDns(HOST, TOKEN, TARGET, elsewhere)).routing).toBe("mismatch")
    expect((await checkDomainDns(HOST, TOKEN, TARGET, lookup({ txt }))).routing).toBe("missing")
  })
})

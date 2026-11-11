import { randomBytes } from "node:crypto"
import { kekFingerprint, parseEnvelope } from "@qticaret/server-kit"
import { openTckn, sealTckn, tcknContext } from "../../tenants/tckn"
import { kekStatus } from "../kek-status"
import { configuredKekIds, masterKeyWrapper } from "../keks"
import { kekOf, olderKekIds, rewrapRows } from "../rewrap"

const TCKN = "10000000146"
const key = () => randomBytes(32)
const hex = (...keys: Buffer[]) => keys.map((each) => each.toString("hex")).join(",")

describe("KEK rotation (adr/0061 §4.1, Ek C8)", () => {
  const original = process.env["CP_MASTER_KEY"]
  const a = key()
  const b = key()

  afterEach(() => {
    process.env["CP_MASTER_KEY"] = original
  })

  it("reads the keys from CP_MASTER_KEY, newest first, and follows a change", () => {
    process.env["CP_MASTER_KEY"] = hex(a)
    expect(configuredKekIds()).toEqual([kekFingerprint(a)])
    expect(olderKekIds()).toEqual([])

    process.env["CP_MASTER_KEY"] = hex(b, a)

    expect(configuredKekIds()).toEqual([kekFingerprint(b), kekFingerprint(a)])
    expect(masterKeyWrapper().kekId).toBe(kekFingerprint(b))
    expect(olderKekIds()).toEqual([kekFingerprint(a)])
  })

  it("writes under A, adds B first, rewraps, removes A, and still reads", async () => {
    process.env["CP_MASTER_KEY"] = hex(a)
    const { tckn_sealed } = await sealTckn("ten_A", TCKN)
    const rows = new Map([["tenco_1", tckn_sealed]])
    const swap = (id: string, from: string, to: string) => {
      if (rows.get(id) !== from) {
        return Promise.resolve(false)
      }
      rows.set(id, to)
      return Promise.resolve(true)
    }

    process.env["CP_MASTER_KEY"] = hex(b, a)
    const tally = await rewrapRows(
      [{ id: "tenco_1", sealed: tckn_sealed, context: tcknContext("ten_A") }],
      swap
    )
    const rewrapped = rows.get("tenco_1") ?? ""
    process.env["CP_MASTER_KEY"] = hex(b)

    expect(tally).toEqual({ rewrapped: 1, failed: 0, failed_ids: [] })
    expect(kekOf(rewrapped)).toBe(kekFingerprint(b))
    // The data was not encrypted again: only its data key moved
    expect(parseEnvelope(rewrapped).ciphertext).toEqual(parseEnvelope(tckn_sealed).ciphertext)
    await expect(openTckn("ten_A", rewrapped)).resolves.toBe(TCKN)
    // Without the rewrap, removing A would have stranded it
    await expect(openTckn("ten_A", tckn_sealed)).rejects.toMatchObject({
      code: "envelope.unknown_kek",
    })
  })

  it("leaves current, unknown-key and stale rows alone and counts a damaged one", async () => {
    process.env["CP_MASTER_KEY"] = hex(a)
    const underA = await sealTckn("ten_A", TCKN)
    process.env["CP_MASTER_KEY"] = hex(key())
    const strandedRow = (await sealTckn("ten_C", TCKN)).tckn_sealed
    process.env["CP_MASTER_KEY"] = hex(b, a)
    const current = (await sealTckn("ten_B", TCKN)).tckn_sealed
    const swap = jest.fn().mockResolvedValue(true)

    const tally = await rewrapRows(
      [
        { id: "current", sealed: current, context: tcknContext("ten_B") },
        { id: "stranded", sealed: strandedRow, context: tcknContext("ten_C") },
        { id: "malformed", sealed: "qtenv1.not-an-envelope", context: { table: "t" } },
        // Bound to another shop: its data key does not open here
        { id: "damaged", sealed: underA.tckn_sealed, context: tcknContext("ten_X") },
      ],
      swap
    )

    expect(tally).toEqual({ rewrapped: 0, failed: 1, failed_ids: ["damaged"] })
    expect(swap).not.toHaveBeenCalled()
  })

  it("does not count a row someone changed meanwhile", async () => {
    process.env["CP_MASTER_KEY"] = hex(a)
    const { tckn_sealed } = await sealTckn("ten_A", TCKN)
    process.env["CP_MASTER_KEY"] = hex(b, a)

    const tally = await rewrapRows(
      [{ id: "r", sealed: tckn_sealed, context: tcknContext("ten_A") }],
      () => Promise.resolve(false)
    )

    expect(tally.rewrapped).toBe(0)
  })

  it("classifies each KEK and says which old ones may go", async () => {
    process.env["CP_MASTER_KEY"] = hex(b, a)
    const [ib, ia] = [kekFingerprint(b), kekFingerprint(a)]
    const container = {
      resolve: (name: string) =>
        name === "vault"
          ? {
              secretCountsByKek: () =>
                Promise.resolve(
                  new Map([
                    [ib, 2],
                    ["gone0000gone0000", 1],
                  ])
                ),
            }
          : { tcknCountsByKek: () => Promise.resolve(new Map([[ib, 1]])) },
    }

    const status = await kekStatus(container as never)

    expect(status.keks).toEqual([
      { kek_id: ib, state: "current", records: { secret_record: 2, tenant_company: 1 }, total: 3 },
      { kek_id: ia, state: "older", records: { secret_record: 0, tenant_company: 0 }, total: 0 },
      {
        kek_id: "gone0000gone0000",
        state: "missing",
        records: { secret_record: 1, tenant_company: 0 },
        total: 1,
      },
    ])
    expect(status).toMatchObject({ pending: 0, stranded: 1, removable: [ia] })
  })
})

import { AdminPostOrderExport } from "../export/validators"
import { AdminGetOrderBoard } from "../validators"

const list = (query: Record<string, unknown>) => AdminGetOrderBoard.safeParse(query)

describe("the order list's filters, one choice or several", () => {
  it("reads a single value as older links have it", () => {
    const parsed = list({ payment: "paid", shipping: "none", method: "cod", carrier: "aras" })

    expect(parsed.success && parsed.data).toMatchObject({
      payment: ["paid"],
      shipping: ["none"],
      method: ["cod"],
      carrier: ["aras"],
    })
  })

  it("reads a comma list, a repeated parameter and a JSON array alike", () => {
    const comma = list({ payment: "paid,refunded" })
    const repeated = list({ shipping: ["label", "on_the_way"] })
    const spaced = list({ carrier: " aras , own " })

    expect(comma.success && comma.data.payment).toEqual(["paid", "refunded"])
    expect(repeated.success && repeated.data.shipping).toEqual(["label", "on_the_way"])
    expect(spaced.success && spaced.data.carrier).toEqual(["aras", "own"])
  })

  it("drops repeats and treats an empty list as no filter", () => {
    const twice = list({ method: "cod,cod,card" })
    const empty = list({ payment: "", shipping: [], carrier: "," })

    expect(twice.success && twice.data.method).toEqual(["cod", "card"])
    expect(empty.success && empty.data).toMatchObject({
      payment: undefined,
      shipping: undefined,
      carrier: undefined,
    })
  })

  it.each([
    { payment: "paid,lost" },
    { shipping: ["none", "lost"] },
    { method: 5 },
    { carrier: "aras,".repeat(60) },
    { payment: Array.from({ length: 30 }, () => "paid") },
  ])("refuses %j", (query) => {
    expect(list(query).success).toBe(false)
  })

  it("takes the same choices in the export's body, and a queued job's stored input again", () => {
    const body = AdminPostOrderExport.safeParse({ payment: "paid,refunded", carrier: ["own"] })
    const again = body.success ? AdminPostOrderExport.safeParse(body.data) : null

    expect(body.success && body.data).toMatchObject({
      payment: ["paid", "refunded"],
      carrier: ["own"],
      format: "xlsx",
    })
    expect(again?.success && again.data).toMatchObject({ payment: ["paid", "refunded"] })
    expect(AdminPostOrderExport.safeParse({ method: ["cod", "cash"] }).success).toBe(false)
  })
})

import { beforeEach, describe, expect, it, vi } from "vitest"
import { createProduct } from "./create-product"
import { defaultWizardValues } from "./schema"
import type { WizardValues } from "./schema"

const create = vi.hoisted(() => vi.fn())
const update = vi.hoisted(() => vi.fn())
const sdkFetch = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({
  sdk: { client: { fetch: sdkFetch }, admin: { product: { create, update } } },
}))

const values = (patch: Partial<WizardValues> = {}): WizardValues => ({
  ...defaultWizardValues(),
  title: "Kupa",
  manage_inventory: false,
  ...patch,
})

const input = (patch: Partial<WizardValues>, publish: boolean) => ({
  values: values(patch),
  publish,
  defaults: { salesChannelId: null, locationId: null, shippingProfileId: null },
  defaultOption: { title: "Seçenek", value: "Standart" },
})

const withTemplate = { template_id: "tpl_1", attributes: { colour: "Kırmızı" } }

// The calls in the order they were made: "create:<status>", "fetch:<path end>", "update:<status>"
const calls = () =>
  [
    ...create.mock.calls.map(
      (args, index) =>
        [
          create.mock.invocationCallOrder[index] ?? 0,
          `create:${(args[0] as { status: string }).status}`,
        ] as const
    ),
    ...sdkFetch.mock.calls.map(
      (args, index) =>
        [
          sdkFetch.mock.invocationCallOrder[index] ?? 0,
          `fetch:${String(args[0]).split("/").pop()}`,
        ] as const
    ),
    ...update.mock.calls.map(
      (args, index) =>
        [
          update.mock.invocationCallOrder[index] ?? 0,
          `update:${(args[1] as { status: string }).status}`,
        ] as const
    ),
  ]
    .sort((a, b) => a[0] - b[0])
    .map(([, name]) => name)

beforeEach(() => {
  create.mockReset().mockResolvedValue({ product: { id: "prod_1", variants: [] } })
  update.mockReset().mockResolvedValue({})
  sdkFetch.mockReset().mockResolvedValue({})
})

describe("createProduct", () => {
  it("creates a draft, writes its attributes, then publishes it last", async () => {
    const result = await createProduct(input(withTemplate, true))
    expect(calls()).toEqual(["create:draft", "fetch:attributes", "update:published"])
    expect(result.publishHeld).toBeNull()
    expect(result.attributesProblem).toBeNull()
  })

  it("keeps the product a draft when its attributes are refused", async () => {
    const refused = new Error("product_attributes.invalid")
    sdkFetch.mockRejectedValueOnce(refused)
    const result = await createProduct(input(withTemplate, true))
    expect(calls()).toEqual(["create:draft", "fetch:attributes"])
    expect(update).not.toHaveBeenCalled()
    expect(result.publishHeld).toEqual({ reason: refused })
    expect(result.attributesProblem).toEqual({ reason: refused })
  })

  it("leaves a draft standing, with why, when publishing itself fails", async () => {
    const failed = new Error("network")
    update.mockRejectedValueOnce(failed)
    const result = await createProduct(input({}, true))
    expect(result.productId).toBe("prod_1")
    expect(result.publishHeld).toEqual({ reason: failed })
  })

  it("publishes a digital product after its kind is set", async () => {
    await createProduct(input({ kind: "digital" }, true))
    expect(calls()).toEqual(["create:draft", "fetch:catalog", "update:published"])
  })

  it("never publishes a product saved as a draft", async () => {
    const result = await createProduct(input(withTemplate, false))
    expect(update).not.toHaveBeenCalled()
    expect(result.publishHeld).toBeNull()
  })
})

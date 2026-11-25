import { MedusaError } from "@medusajs/framework/utils"
import { deleteProviderKey, keyedServices, writeProviderKey } from "../keys"

/**
 * adr/0085 "Güvenlik": the fake service is a test and development aid; in
 * production no key is written for it nor destroyed under its name. The
 * refusal is a 404 before the vault is touched.
 */
describe("provider keys outside test and development", () => {
  const nodeEnv = process.env["NODE_ENV"]
  const vault = { putSecret: jest.fn(), retireSecret: jest.fn(), listSecretMeta: jest.fn() }
  const container = { resolve: jest.fn(() => vault) }

  afterEach(() => {
    process.env["NODE_ENV"] = nodeEnv
    jest.clearAllMocks()
  })

  const refusal = async (run: () => Promise<unknown>) => {
    const error = await run().then(
      () => null,
      (caught: unknown) => caught
    )
    expect(error).toBeInstanceOf(MedusaError)
    return { type: (error as MedusaError).type, message: (error as MedusaError).message }
  }

  it("refuses the fake service in production, unknown as any other", async () => {
    process.env["NODE_ENV"] = "production"
    expect(keyedServices()).not.toContain("fake")
    expect(keyedServices()).toContain("deepseek")
    for (const run of [
      () => writeProviderKey(container, "fake", "test-key-production-000"),
      () => deleteProviderKey(container, "fake", "user_x"),
    ]) {
      expect(await refusal(run)).toEqual({
        type: MedusaError.Types.NOT_FOUND,
        message: "cp.ai_service_unknown",
      })
    }
    expect(vault.putSecret).not.toHaveBeenCalled()
    expect(vault.retireSecret).not.toHaveBeenCalled()
  })

  it("lists the fake service under test", () => {
    process.env["NODE_ENV"] = "test"
    expect(keyedServices()).toContain("fake")
  })
})

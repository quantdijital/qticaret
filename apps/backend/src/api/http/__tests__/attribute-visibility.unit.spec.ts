import type { MedusaRequest } from "@medusajs/framework/http"
import { hidePrivateAttributes } from "../attribute-visibility"
import { fakeResponse } from "./fakes"

// Two values: one of a public definition, one of the shop's own (T5)
const service = {
  listAttributeValues: () =>
    Promise.resolve([
      { id: "attrval_public", definition_id: "attrdef_public" },
      { id: "attrval_private", definition_id: "attrdef_private" },
    ]),
  listAttributeDefinitions: () => Promise.resolve([{ id: "attrdef_private" }]),
}

const request = (method: string, fields = "id,attribute_values.id") =>
  ({
    method,
    path: "/store/products/prod_1",
    query: { fields },
    scope: { resolve: () => service },
  }) as unknown as MedusaRequest

const answer = () => ({
  product: {
    id: "prod_1",
    attribute_values: [{ id: "attrval_public" }, { id: "attrval_private" }],
  },
})

async function run(req: MedusaRequest) {
  const response = fakeResponse()
  const next = jest.fn<undefined, unknown[]>()
  hidePrivateAttributes(req, response.res, next)
  response.res.json(answer())
  // The cleaning reads the service before the answer goes
  await new Promise((resolve) => setImmediate(resolve))
  return { body: response.body(), next }
}

describe("hidePrivateAttributes", () => {
  it.each(["GET", "HEAD"])(
    "leaves the shop's own attributes out of a %s answer (adr/0069 review S1)",
    async (method) => {
      const { body, next } = await run(request(method))
      expect(next).toHaveBeenCalledWith()
      expect(body).toEqual({
        product: { id: "prod_1", attribute_values: [{ id: "attrval_public" }] },
      })
    }
  )

  it("leaves a request that did not ask for attributes as it is", async () => {
    const { body } = await run(request("HEAD", "id,title"))
    expect(body).toEqual(answer())
  })
})

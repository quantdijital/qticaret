import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { interpretSearch } from "../../../../lib/ai/search-intent/interpret"
import { interpretSearchWorkflow } from "../../../../workflows/ai/interpret-search"
import type { StorePostSearchInterpretType } from "./validators"

/**
 * POST /store/search/interpret (adr/0077 §7): a shopper's sentence read
 * into the search's query string, with the "Anladığım" chips built from
 * the filter the server accepted and the parts it left out. Behind
 * `ai.storefront_search` (off: no such route), counted per address
 * (search-routes.ts). Whatever fails, the answer is the sentence searched
 * as it is (`fallback: true`): the shopper always gets a search.
 */
export async function POST(
  req: MedusaRequest<StorePostSearchInterpretType>,
  res: MedusaResponse
): Promise<void> {
  const answer = await interpretSearch(req.validatedBody.text, async (text) => {
    const { result } = await interpretSearchWorkflow(req.scope).run({ input: { text } })
    return result
  })
  res.json(answer)
}

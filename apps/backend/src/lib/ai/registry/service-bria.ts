import { AI_SERVICE_TARGETS as T, endpointUrl } from "@qticaret/types/control-plane"
import type { AiService } from "./services"

/*
 * Bria (v2 image editing), kept apart from `services.ts` so that file stays
 * short. Verified 2026-11-25 against:
 *   https://docs.bria.ai/image-editing.md (server https://engine.prod.bria-api.com/v2/image/edit,
 *     POST /remove_background and /replace_background, the `api_token` header)
 *   https://docs.bria.ai/_spec/image-editing.json (the OpenAPI: remove_background takes
 *     `image` (base64 or a URL), `model` RMBG2 (default) | RMBG3, `preserve_alpha`, `sync`
 *     (default false); replace_background takes `image`, `mode` base | high_control
 *     (default) | fast | fibo2, `prompt`, `original_quality` (default false), `sync`;
 *     200 `{ result: { image_url }, request_id }`, 202 `{ request_id, status_url }`;
 *     errors 400, 401, 403, 404, 415, 422, 429, 460, 5xx as `{ error: { code, message } }`)
 *   https://docs.bria.ai/image-editing/editing/background-replace.md (`fibo2`: "the
 *     original product pixels are pasted back over the result, so the product itself is
 *     never regenerated"; text prompt only, English; 422 when moderation refuses;
 *     `original_quality: true` keeps the input's size, else about 1 MP)
 *   https://docs.bria.ai/getting-started/async-requests (asynchronous by default; `sync:
 *     true` holds the connection and answers 200 with the result; result addresses are
 *     temporary: fetch them at once)
 *   https://docs.bria.ai/getting-started/authentication.md (401: the token is missing,
 *     invalid or revoked; no account or validation endpoint documented)
 *   https://docs.bria.ai/getting-started/asset-retention.md (inputs kept no longer than
 *     the request needs; result images expire after 3 days)
 *   https://docs.bria.ai/whats-new/rmbg-3.md (RMBG 2.0 stays the default; RMBG 3.0 is
 *     priced apart: RMBG2 is pinned)
 *   https://bria.ai/pricing (Remove Background $0.018 an image, $0.025 with a prompt:
 *     none is sent; Background Generation $0.032 an image)
 * Not verified: the host the result addresses are on (every example elides it, "https://
 *   .../result.png"); the documented API host alone is listed, so a result elsewhere is
 *   refused (`download_host_not_listed`, its host logged) and nothing is fetched. Whether
 *   `fibo2` or `original_quality` is priced apart (the pricing page names neither). What
 *   460 means (read as any other 4xx). Where the data is processed, and whether it trains
 *   models (no page says): the note says so.
 * A white background is not documented: it is the transparent cut-out laid on white
 * here, after the download (`run-image.ts`), at the same price.
 */
const BRIA_EDIT = T.bria.capabilities.image_edit

export const BRIA: AiService = {
  id: "bria",
  credentialProvider: "bria",
  funding: "own_key",
  hosts: T.bria.hosts,
  downloadHosts: ["engine.prod.bria-api.com"],
  capabilities: {
    image_edit: {
      connector: "bria",
      model: BRIA_EDIT.model,
      url: endpointUrl(BRIA_EDIT),
      backgrounds: ["transparent", "white"],
      body: BRIA_EDIT.fixedBody,
      /*
       * Replace Background in `fibo2` mode: the product's own pixels are pasted back,
       * only the setting is made: marked `edited`, as Photoroom's scene is.
       */
      scene: {
        model: BRIA_EDIT.scene.model,
        url: endpointUrl(BRIA_EDIT.scene),
        source: "edited",
        body: BRIA_EDIT.scene.fixedBody,
        unitPrice: { currency: "USD", perImage: 32_000 },
      },
    },
  },
  unitPrices: { image_edit: { currency: "USD", perImage: 18_000 } },
  dataNoteKey: "ai.data_note.bria",
  // Moderation's refusal and an unsupported picture, not a fault of ours or the service's
  statusErrors: { 415: "ai.input_unsupported", 422: "ai.content_blocked" },
}

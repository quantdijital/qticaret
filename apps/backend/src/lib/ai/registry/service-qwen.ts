import { AI_SERVICE_TARGETS as T } from "@qticaret/types/control-plane"
import type { AiService, OpenAiCompatibleTarget } from "./services"

/*
 * Qwen on Alibaba Model Studio, Singapore region only ("International"
 * scope: global nodes excluding the Chinese mainland). Verified 2026-11-25 against:
 *   https://www.alibabacloud.com/help/en/model-studio/base-url and
 *   https://www.alibabacloud.com/help/en/model-studio/singapore-regional-access-information
 *     (the DashScope domain https://dashscope-intl.aliyuncs.com/compatible-mode/v1, "still
 *     available"; a workspace domain is recommended but puts an account id in the host, so
 *     the fixed shared domain is used; a key is bound to its region)
 *   https://www.alibabacloud.com/help/en/model-studio/qwen-api-via-openai-chat-completions
 *     (POST …/chat/completions, `Authorization: Bearer`; `max_completion_tokens` the whole
 *     output, thinking included, for Qwen Flash 3.5 and later, `max_tokens` "will be
 *     deprecated"; `enable_thinking` at the top level of the body; `response_format`
 *     text | json_object | json_schema; `tool_choice` auto | none | a function, never
 *     `required` on Qwen; temperature [0, 2); finish reasons stop | length | tool_calls;
 *     `usage.prompt_tokens`, `completion_tokens`)
 *   https://www.alibabacloud.com/help/en/model-studio/qwen3-8-flash.md (qwen3.8-flash:
 *     text, image and video in, text out; 131,072 output tokens; Singapore listed)
 *   https://www.alibabacloud.com/help/en/model-studio/deep-thinking ("Qwen3.8 Flash
 *     series (Hybrid thinking mode, thinking mode enabled by default)"; `enable_thinking`)
 *   https://www.alibabacloud.com/help/en/model-studio/json-mode (`json_object` for the
 *     Qwen3.8-Flash series, the messages must contain the word "JSON" (`DATA_RULE` does);
 *     `json_schema` not in the Singapore region: not used)
 *   https://www.alibabacloud.com/help/en/model-studio/model-pricing (Singapore:
 *     qwen3.8-flash $0.15 in, $0.47 out per million tokens, one tier up to 1M)
 *   https://www.alibabacloud.com/help/en/model-studio/error-code (401 invalid key; 403
 *     access denied, overdue account, no model permission; 429 rate and allocated quota;
 *     5xx): read by status alone, the error body's shape is not documented
 *   https://www.alibabacloud.com/help/en/model-studio/data-retention-policy (prompts and
 *     answers kept at most 30 days; not used for training without separate consent)
 * qwen3.7-flash ($0.03 / $0.13 up to 32K input, tiered above) is not listed: one model a
 * capability, and its price depends on the input's length.
 * Not set: `temperature` (the range ends below 2, the gateway's at 2; the task's is not
 * sent). Not verified: the error body (only the status is read).
 *
 * `vision` verified 2026-11-25 against:
 *   https://www.alibabacloud.com/help/en/model-studio/vision (an `image_url` part with a
 *     `data:[MIME_type];base64,…` URL; BMP, JPEG, PNG, TIFF, WEBP, HEIC; 50 MiB an encoded
 *     image, but "DashScope domains limit the body to 16 MiB": room for the encoding's
 *     third; image tokens are input tokens)
 */
const QWEN_CHAT: Omit<OpenAiCompatibleTarget, "toolCalls" | "imageInput"> = {
  connector: "openai-compatible",
  model: T.qwen.capabilities.text.model,
  baseUrl: T.qwen.capabilities.text.baseUrl,
  path: T.qwen.capabilities.text.path,
  maxTokensField: "max_completion_tokens",
  jsonMode: true,
  // Thinking is on unless turned off; the gateway writes the same on the platform's credits
  body: { enable_thinking: false },
}

export const QWEN: AiService = {
  id: "qwen",
  credentialProvider: "qwen",
  funding: "own_key",
  hosts: T.qwen.hosts,
  downloadHosts: [],
  capabilities: {
    text: {
      ...QWEN_CHAT,
      /*
       * Tool calling, read 2026-11-25 for adr/0079 §2: `tools` (type `function`, name,
       * description, JSON Schema parameters), `tool_calls` in the answer (several at once
       * by default), the result as `role: "tool"` with its `tool_call_id`; `tool_choice`
       * `auto` (the default) documented, `required` not supported on Qwen (never sent).
       */
      toolCalls: {
        verified: true,
        verifiedOn: "2026-11-25",
        source: ["https://www.alibabacloud.com/help/en/model-studio/qwen-function-calling"],
        toolChoice: true,
      },
    },
    vision: {
      ...QWEN_CHAT,
      model: T.qwen.capabilities.vision.model,
      imageInput: { maxBytes: 10 * 1000 * 1000 },
    },
  },
  unitPrices: {
    text: { currency: "USD", inputPerMillionTokens: 150_000, outputPerMillionTokens: 470_000 },
    vision: { currency: "USD", inputPerMillionTokens: 150_000, outputPerMillionTokens: 470_000 },
  },
  dataNoteKey: "ai.data_note.qwen",
}

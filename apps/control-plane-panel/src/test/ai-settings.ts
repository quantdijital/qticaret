import type { AiSettingsAnswer } from "@/features/ai-credits/api/schemas"

/** The platform's AI settings as the control plane answers them (adr/0085 §5). */
export const SETTINGS: AiSettingsAnswer = {
  settings: {
    daily_cap: 300,
    purchased_lifetime_months: 12,
    packs: [
      {
        id: "pack_00000000000000aa",
        name: "Küçük",
        credits: 1000,
        amount: 19_900,
        currency: "TRY",
        active: true,
      },
    ],
    routing: { text: { service: "deepseek", model: "deepseek-chat" } },
    updated_at: "2026-11-24T09:00:00.000Z",
    updated_by: "user_me",
  },
  targets: [
    { service: "deepseek", capabilities: { text: ["deepseek-chat"], vision: ["deepseek-chat"] } },
    {
      service: "gemini",
      capabilities: {
        text: ["gemini-flash"],
        vision: ["gemini-flash"],
        image_edit: ["gemini-image"],
      },
    },
  ],
}

/** Two services with a key: DeepSeek routed for text, Gemini not routed. */
export const PROVIDERS = {
  providers: [
    {
      service: "deepseek",
      has_key: true,
      version: 3,
      written_at: "2026-11-20T09:00:00.000Z",
      routed: ["text"],
    },
    { service: "gemini", has_key: true, version: 1, written_at: null, routed: [] },
  ],
}

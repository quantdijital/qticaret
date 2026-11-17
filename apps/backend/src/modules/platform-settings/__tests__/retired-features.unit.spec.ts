import { platformFlags } from "@qticaret/types/control-plane"
import { RETIRED_FEATURES, featureDefinition, featureRegistry } from "../features"
import { effectiveValue } from "../service-platform-flags"

/**
 * A flag taken out of the registry may still be stored (an override row, a
 * plan document's key). Reads must skip it as an unknown key, never fail on
 * it; the module test (`service.spec.ts`) reads such a row from the table.
 */
describe("retired feature flags", () => {
  const envs = ["production", "staging", "development", "test"]

  it("lists content.ai_drafts as retired", () => {
    expect(RETIRED_FEATURES).toContain("content.ai_drafts")
  })

  it.each(envs)("keeps every retired key out of the registry under NODE_ENV=%s", (env) => {
    for (const key of RETIRED_FEATURES) {
      expect(Object.keys(featureRegistry({ NODE_ENV: env }))).not.toContain(key)
      expect(featureDefinition(key, { NODE_ENV: env })).toBeUndefined()
      expect(platformFlags(env).map((flag) => flag.key)).not.toContain(key)
    }
  })

  it("reads the live flags the same with a retired key stored beside them", () => {
    const stored = {
      overrides: { "content.ai_drafts": true },
      platform: { "content.ai_drafts": true },
    }
    for (const [key, definition] of Object.entries(featureRegistry({ NODE_ENV: "production" }))) {
      expect(effectiveValue(definition, stored, key)).toEqual({
        enabled: definition.default,
        overridden: false,
      })
    }
  })
})

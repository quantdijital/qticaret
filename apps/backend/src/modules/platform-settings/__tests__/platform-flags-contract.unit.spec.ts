import { platformFlags } from "@qticaret/types/control-plane"
import { featureRegistry } from "../features"

/**
 * adr/0061 Ek C9: the control plane learns which flags are `owner:
 * platform` from the shared list in `@qticaret/types/control-plane`. This
 * shop's registry and that list must agree, key for key and default for
 * default, in every environment: a flag the control plane could set but
 * the shop does not know (or the other way round) fails here.
 */
describe("platform flags: this shop's registry and the shared list", () => {
  it.each(["production", "staging", "development", "test"])("agree under NODE_ENV=%s", (env) => {
    const ours = Object.entries(featureRegistry({ NODE_ENV: env }))
      .filter(([, definition]) => definition.owner === "platform")
      .map(([key, definition]) => ({ key, default: definition.default }))
      .sort((a, b) => a.key.localeCompare(b.key))
    const shared = platformFlags(env)
      .map((flag) => ({ key: flag.key, default: flag.default }))
      .sort((a, b) => a.key.localeCompare(b.key))

    expect(ours).toEqual(shared)
  })
})

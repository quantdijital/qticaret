import { CONTENT_AI_DRAFTS } from "../../../modules/platform-settings/features"

/** What this instance can do, for the flags that need more than the flag. */
export interface FeatureReadiness {
  /** A content draft provider is set (`CONTENT_DRAFT_PROVIDER`, adr/0005). */
  contentDrafts: boolean
}

/**
 * The flags the panel lists: one whose feature cannot work on this
 * instance is left out rather than offered as a switch that does nothing
 * (AI drafts without a provider). The flag keeps its stored value.
 */
export function listedFeatures<T extends { key: string }>(
  features: T[],
  ready: FeatureReadiness
): T[] {
  return features.filter((feature) => feature.key !== CONTENT_AI_DRAFTS || ready.contentDrafts)
}

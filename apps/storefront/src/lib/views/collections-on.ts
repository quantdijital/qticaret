import { storefrontSettings } from "@/lib/store-api/requests"

/**
 * Whether the shop has collections on now (`/store/storefront` `features`,
 * `catalog.collections`): the frame's answer every page already has. On
 * unless it says `false` (a backend before the flag: on, as it was). Off,
 * collection pages are not found and no section or link draws one; the
 * backend refuses them already, this is the second check for a cached answer.
 */
export async function collectionsOn(): Promise<boolean> {
  const { features } = await storefrontSettings()
  return features?.collections !== false
}

import type { QueryClient } from "@tanstack/react-query"
import { redirect } from "@tanstack/react-router"
import { loadCurrentUser, loadStaff } from "@/features/auth/api/session"
import { appearanceQuery } from "@/features/settings/api/appearance"
import { sdk } from "@/lib/sdk"
import { applyAppearance, rememberAppearance } from "@qticaret/admin-ui/theme"

/**
 * What every signed-in screen asks before it opens (the shell's pages and
 * the full-screen ones alike): a user, two-factor passed where the shop
 * requires it (adr/0040 §2), and the shop's colours painted.
 */
export async function requireStaff({
  context,
  location,
}: {
  context: { queryClient: QueryClient }
  location: { href: string }
}) {
  // Signed out (401, 403) goes to sign-in; too many requests or no answer keeps
  // the user already read, or shows the route's "try again" page
  const user = await loadCurrentUser(context.queryClient)
  if (!user) {
    throw redirect({ to: "/login", search: { redirect: location.href } })
  }
  // 2FA first (adr/0040 §2): no factor, its setup; a factor this session
  // has not passed (signed in before it was set up), a new sign-in. A role
  // that cannot be read is never "no 2FA to ask": the recent one, or "try again"
  const staff = await loadStaff(context.queryClient)
  if (!staff) {
    throw redirect({ to: "/login", search: { redirect: location.href } })
  }
  if (staff.role && staff.mfa.required && !staff.mfa.passed) {
    if (!staff.mfa.enabled) {
      throw redirect({ to: "/security/setup" })
    }
    await sdk.auth.logout().catch(() => undefined)
    context.queryClient.clear()
    throw redirect({ to: "/login", search: { redirect: location.href } })
  }
  // The remembered colours painted the first frame; the stored ones win
  const appearance = await context.queryClient
    .query({ ...appearanceQuery(), staleTime: "static" })
    .catch(() => null)
  if (appearance) {
    applyAppearance(appearance.values)
    rememberAppearance(appearance.values)
  }
  return { user }
}

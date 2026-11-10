import type { QueryClient } from "@tanstack/react-query"
import { redirect } from "@tanstack/react-router"
import { meQuery, signOut } from "@/features/auth/api"
import type { Me } from "@/features/auth/api"
import { standingOf } from "@/features/auth/standing"
import { codeOf, statusOf } from "@/lib/api"

/** The member, or the redirect a refusal of `GET /me` means; anything else is the error page's. */
export async function loadMe(queryClient: QueryClient, href: string): Promise<Me> {
  try {
    return await queryClient.query(meQuery())
  } catch (error) {
    if (statusOf(error) === 403 && codeOf(error) === "cp.no_role") {
      throw redirect({ to: "/no-access" })
    }
    if (statusOf(error) === 401 || statusOf(error) === 403) {
      throw redirect({ to: "/login", search: { redirect: href } })
    }
    throw error
  }
}

/** Every screen inside the panel asks this first; the API decides again on every call. */
export async function requireMember({
  context,
  location,
}: {
  context: { queryClient: QueryClient }
  location: { href: string }
}): Promise<{ me: Me }> {
  const me = await loadMe(context.queryClient, location.href)
  const standing = standingOf(me)
  if (standing === "setup") {
    throw redirect({ to: "/security/setup" })
  }
  if (standing === "sign-in-again") {
    await signOut(() => {
      context.queryClient.clear()
    })
    throw redirect({ to: "/login", search: { redirect: location.href } })
  }
  return { me }
}

/** The owner's screens (staff, audit log): anyone else goes to the dashboard. */
export function requireOwner(me: Me): void {
  if (me.role !== "owner") {
    throw redirect({ to: "/" })
  }
}

import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { SLUG_PATTERN } from "@/features/tenants/slug"
import { availabilityQuery } from "./calls"
import { domainOf, slugOf } from "./draft"
import type { AddressChecks, ShopDraft } from "./draft"

// Asked once typing pauses, not at every key
const PAUSE_MS = 300

function useSettled<T>(value: T): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSettled(value)
    }, PAUSE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [value])
  return settled
}

/**
 * The address as the control plane sees it, asked while it is typed: the
 * slug once it has a slug's form (its form is this page's to say), the own
 * domain once there is one. An answer counts only for the value it was
 * asked for, so a check still on its way never passes a newer value.
 */
export function useAddressChecks(draft: ShopDraft): {
  checks: AddressChecks
  platformDomain: string | null
} {
  const slug = slugOf(draft)
  const domain = domainOf(draft)
  const askSlug = useSettled(SLUG_PATTERN.test(slug) ? slug : null)
  const askHost = useSettled(domain === "" ? null : domain)
  const answer = useQuery(availabilityQuery(askSlug, askHost)).data
  return {
    platformDomain: answer?.platform_domain ?? null,
    checks: {
      slug: answer?.slug ? { value: answer.slug.value, problem: answer.slug.problem } : null,
      hostname: answer?.hostname
        ? { value: answer.hostname.value, problem: answer.hostname.problem }
        : null,
    },
  }
}

import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useWatch } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { audiencePreviewQuery } from "@/features/bulk-messages/api/bulk-messages"
import type { AudienceSource, BulkChannel } from "@/features/bulk-messages/api/types"
import type { EditorValues } from "@/features/bulk-messages/form"

/** How long the choice must rest before it is counted: a few clicks make one request. */
export const PREVIEW_DELAY_MS = 600

interface Choice {
  channel: BulkChannel
  audience: AudienceSource[]
}

/**
 * The live count of the channel and audience on screen (saved or not),
 * asked once the choice rests: the route reads every consent and has a
 * small budget per person (adr/0050 §3).
 */
export function useAudiencePreview(id: string, form: UseFormReturn<EditorValues>) {
  const [channel, audience] = useWatch({ control: form.control, name: ["channel", "audience"] })
  const key = JSON.stringify({ channel, audience })
  const [asked, setAsked] = useState<Choice>(() => ({ channel, audience }))
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAsked(JSON.parse(key) as Choice)
    }, PREVIEW_DELAY_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [key])
  const query = useQuery(audiencePreviewQuery(id, asked))
  return {
    query,
    /** No source picked: nothing to count. */
    empty: audience.length === 0,
    /** What is shown is not yet the choice on screen. */
    stale: JSON.stringify(asked) !== key || query.isPlaceholderData,
  }
}

export type AudiencePreviewState = ReturnType<typeof useAudiencePreview>

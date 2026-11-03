import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { renderedPreviewQuery } from "@/features/bulk-messages/api/bulk-messages"
import type { BulkChannel, BulkMessage } from "@/features/bulk-messages/api/types"
import { contentKey, valuesOf } from "@/features/bulk-messages/form"

/** How long a saved content must rest before it is rendered: saves in a row make one request. */
export const RENDER_DELAY_MS = 600

interface Asked {
  channel: BulkChannel
  content: string
}

// The utm code goes into every shop link, so it is part of what is rendered
const storedOf = (campaign: BulkMessage): Asked => ({
  channel: campaign.channel,
  content: `${contentKey(valuesOf(campaign))}|${campaign.utm_campaign}`,
})

/**
 * The stored campaign as it would go (adr/0050 §10): the route renders
 * what is saved, never what is typed, so it is asked when the editor opens
 * and again once a save changes the content and rests. Its budget is sixty
 * a ten minutes per person: a save of the name or the audience asks nothing.
 */
export function useRenderedPreview(campaign: BulkMessage) {
  const stored = storedOf(campaign)
  const key = JSON.stringify(stored)
  const [asked, setAsked] = useState<Asked>(stored)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAsked(JSON.parse(key) as Asked)
    }, RENDER_DELAY_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [key])
  const query = useQuery(renderedPreviewQuery(campaign.id, asked.channel, asked.content))
  return {
    query,
    /** What is shown is not yet the stored content's own rendering. */
    stale: JSON.stringify(asked) !== key || query.isPlaceholderData,
  }
}

export type RenderedPreviewState = ReturnType<typeof useRenderedPreview>

/** The backend's part count of the stored text, once it is the one shown; null before. */
export function storedSmsParts(state: RenderedPreviewState): number | null {
  const data = state.query.data
  return !state.stale && data && "parts" in data ? data.parts : null
}

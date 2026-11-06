import type { ReactNode } from "react"
import type { ContentDetail } from "@/features/content/api/content"
import { ContentCoverCard } from "@/features/content/components/content-cover-card"
import { ContentSummaryCard } from "@/features/content/components/content-summary-card"
import { PostTermsCard } from "@/features/content/components/post-terms-card"
import { CONTENT_SECTIONS as S, CONTENT_TARGETS } from "@/features/content/content-sections"
import { useSectionFindings } from "@/features/content/section-findings"

/** A narrow column card's anchor: the advisor's jumps land on it. */
function Anchor({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div id={id} className="flex min-w-0 scroll-mt-20 flex-col">
      {children}
    </div>
  )
}

/**
 * The narrow column's cards under the SEO advisor (docs/06 "Metin
 * sayfaları"), as the product page has its own: the cover, the summary
 * (a post's with its author) and, for a post, its category and tags.
 * Each saves on its own; the advisor's findings for each are counted
 * under it.
 */
export function ContentSideCards({ entry }: { entry: ContentDetail }) {
  const findings = useSectionFindings({
    kind: entry.kind,
    id: entry.id,
    version: entry.updated_at,
    targets: CONTENT_TARGETS,
  })
  return (
    <>
      <Anchor id={S.cover}>
        <ContentCoverCard entry={entry} findings={findings(S.cover)} />
      </Anchor>
      <Anchor id={S.summary}>
        <ContentSummaryCard entry={entry} findings={findings(S.summary)} />
      </Anchor>
      {entry.kind === "post" ? (
        <Anchor id={S.terms}>
          <PostTermsCard entry={entry} findings={findings(S.terms)} />
        </Anchor>
      ) : null}
    </>
  )
}

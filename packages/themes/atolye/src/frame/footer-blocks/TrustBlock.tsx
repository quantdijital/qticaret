import { TrustIcon } from "../../parts/TrustIcon"
import type { BlockProps } from "./shared"

/**
 * The design's promises (its shared trust badges, the first `limit`):
 * one under the other with their line (`list`), or side by side, the
 * titles only (`inline`). A list named for what it is.
 */
export function TrustBlock({ block, t }: BlockProps<"trust">) {
  const inline = block.layout === "inline"
  return (
    <ul
      aria-label={t("footer.trust")}
      data-layout={block.layout}
      className={inline ? "flex flex-wrap gap-x-6 gap-y-3" : "flex flex-col gap-4"}
    >
      {block.badges.map((badge) => (
        <li key={badge.title} className="flex items-start gap-3">
          <TrustIcon icon={badge.icon} className="mt-0.5 size-5 shrink-0 text-text" />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-semibold text-text">{badge.title}</span>
            {!inline && badge.text && <span className="text-xs text-text-2">{badge.text}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}

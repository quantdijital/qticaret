import { ArrowRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import type { StatusTone } from "@qticaret/admin-ui/patterns/status-badge"
import type { Answer } from "@/features/seo/api/redirects"

const TONES: Record<Answer, StatusTone> = {
  entity: "success",
  redirect: "info",
  gone: "neutral",
  not_found: "warning",
}

/** What a path answers now: a page, a redirect (and where), 410 or 404. */
export function AnswerBadge({ answer, location }: { answer: Answer; location: string | null }) {
  const { t } = useTranslation()
  if (answer === "redirect" && location) {
    return (
      <span className="flex min-w-0 items-center gap-2">
        <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate font-mono text-[13px]" title={location}>
          {location}
        </span>
      </span>
    )
  }
  return <StatusBadge tone={TONES[answer]}>{t(`seo.redirects.answers.${answer}`)}</StatusBadge>
}

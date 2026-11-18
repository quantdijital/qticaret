import { ImageOff } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Progress } from "@qticaret/admin-ui/ui/progress"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { cn } from "@qticaret/admin-ui/lib/utils"
import type { AiBackgroundState } from "@/features/ai/use-ai-background"

const B = "ai.background"

/** A checkerboard under a transparent picture, as image editors show "no background". */
export const CHECKER_CLASS =
  "bg-[repeating-conic-gradient(var(--color-border)_0_25%,var(--color-background)_0_50%)] bg-[length:16px_16px]"

function Frame({
  caption,
  children,
  className,
}: {
  caption: string
  children: ReactNode
  className?: string
}) {
  return (
    <figure className="flex min-w-0 flex-col gap-1.5">
      <div
        className={cn(
          "flex aspect-square items-center justify-center overflow-hidden rounded-md border",
          className
        )}
      >
        {children}
      </div>
      <figcaption className="text-xs text-muted-foreground">{caption}</figcaption>
    </figure>
  )
}

export interface AiBackgroundCompareProps {
  /** The original's address: shown as it is, never changed. */
  before: string
  state: AiBackgroundState
  /** The background the result was asked with: a transparent one sits on the checkerboard. */
  transparent: boolean
}

/**
 * The original and the result side by side (docs/22 PR 4-2): "Önce" the
 * shop's picture, "Sonra" the job's progress, then the new picture, on a
 * checkerboard when its background is transparent.
 */
export function AiBackgroundCompare({ before, state, transparent }: AiBackgroundCompareProps) {
  const { t } = useTranslation()
  let after: ReactNode
  if (state.status === "running") {
    after = (
      <div className="flex w-full flex-col items-center gap-3 p-4" role="status">
        <Skeleton className="aspect-square w-2/3" />
        <span className="text-xs text-muted-foreground">{t(`${B}.running`)}</span>
        <Progress value={state.progress ?? 0} aria-label={t(`${B}.progress`)} className="w-2/3" />
      </div>
    )
  } else if (state.status === "ready") {
    after = (
      <img
        src={state.result.url}
        alt={t(`${B}.afterAlt`)}
        className="max-h-full max-w-full object-contain"
      />
    )
  } else {
    after = (
      <span className="flex flex-col items-center gap-2 p-4 text-center text-xs text-muted-foreground">
        <ImageOff className="size-5" aria-hidden="true" />
        {t(`${B}.afterEmpty`)}
      </span>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      <Frame caption={t(`${B}.before`)} className="bg-muted">
        <img
          src={before}
          alt={t(`${B}.beforeAlt`)}
          className="max-h-full max-w-full object-contain"
        />
      </Frame>
      <Frame
        caption={t(`${B}.after`)}
        className={
          state.status === "ready" ? (transparent ? CHECKER_CLASS : "bg-card") : "bg-muted"
        }
      >
        {after}
      </Frame>
    </div>
  )
}

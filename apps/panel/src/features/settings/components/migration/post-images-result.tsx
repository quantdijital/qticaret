import { useTranslation } from "react-i18next"
import type { KindCounts, MigrationMode } from "@/features/settings/api/migration"
import { formatCount } from "@qticaret/admin-ui/lib/format"

const P = "settings.migration.run.postImages"

type Counts = Partial<Record<string, KindCounts>>

/**
 * A blog picture refresh's outcome (adr/0042 Ek 2026-11-27): the posts
 * given their pictures, those with none left to add, posts no earlier
 * run moved (or without pictures), refusals; the pictures stored and
 * those that could not be (named in the report).
 */
export function PostImagesResult({ mode, counts }: { mode: MigrationMode; counts: Counts }) {
  const { t } = useTranslation()
  const post = counts["post"]
  const image = counts["image"]
  const rows = [
    {
      key: "updated",
      label: t(mode === "apply" ? `${P}.updated` : `${P}.plannedUpdated`),
      value: post?.updated ?? 0,
    },
    {
      key: "stored",
      label: t(mode === "apply" ? `${P}.stored` : `${P}.plannedStored`),
      value: image?.created ?? 0,
    },
    { key: "done", label: t(`${P}.done`), value: post?.found ?? 0 },
    {
      key: "notMoved",
      label: t(`${P}.notMoved`),
      hint: t(`${P}.notMovedHint`),
      value: post?.skipped ?? 0,
    },
    { key: "failed", label: t(`${P}.failed`), value: post?.failed ?? 0 },
    {
      key: "imageFailed",
      label: t(`${P}.imageFailed`),
      hint: t(`${P}.imageFailedHint`),
      value: image?.skipped ?? 0,
    },
  ]
  return (
    <ul className="flex flex-col divide-y rounded-md border bg-card">
      {rows
        .filter((row) => row.key === "updated" || row.key === "stored" || row.value > 0)
        .map((row) => (
          <li key={row.key} className="flex flex-col gap-0.5 px-3 py-2.5">
            <p className="flex items-center justify-between gap-3 text-sm">
              <span className={row.key === "updated" ? "font-medium" : ""}>{row.label}</span>
              <span className="tabular-nums">{formatCount(row.value)}</span>
            </p>
            {row.hint ? <p className="text-[13px] text-muted-foreground">{row.hint}</p> : null}
          </li>
        ))}
    </ul>
  )
}

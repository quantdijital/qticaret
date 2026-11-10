import { useQuery } from "@tanstack/react-query"
import { Loader2, Route } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { resolveQuery } from "@/features/seo/api/redirects"
import type { Resolution } from "@/features/seo/api/redirects"
import { errorText } from "@/lib/errors"
import { AnswerBadge } from "./answer-badge"

function Outcome({ resolution }: { resolution: Resolution }) {
  const { t } = useTranslation()
  if (resolution.type === "entity") {
    return (
      <span className="text-[13px]">
        {t("seo.redirects.tester.entity", {
          kind: t(`seo.redirects.owners.${resolution.entity_type ?? ""}`, {
            defaultValue: resolution.entity_type,
          }),
        })}
      </span>
    )
  }
  return (
    <span className="flex min-w-0 items-center gap-2 text-[13px]">
      {resolution.type === "redirect" ? (
        <span className="shrink-0 text-muted-foreground tabular-nums">
          {String(resolution.status)}
        </span>
      ) : null}
      <AnswerBadge answer={resolution.type} location={resolution.location ?? null} />
    </span>
  )
}

/** "Where does this address go?": the storefront's answer for any path, without counting a hit. */
export function PathTester() {
  const { t } = useTranslation()
  const [text, setText] = useState("")
  const [path, setPath] = useState("")
  const answer = useQuery(resolveQuery(path))
  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-center"
      onSubmit={(event) => {
        event.preventDefault()
        setPath(text.trim())
      }}
    >
      <div className="flex flex-1 gap-2">
        <Input
          aria-label={t("seo.redirects.tester.label")}
          placeholder={t("seo.redirects.tester.placeholder")}
          spellCheck={false}
          className="font-mono text-[13px]"
          value={text}
          onChange={(event) => {
            setText(event.target.value)
          }}
        />
        <Button type="submit" variant="outline" disabled={!text.trim()}>
          {answer.isFetching ? <Loader2 className="animate-spin" /> : <Route />}
          {t("seo.redirects.tester.try")}
        </Button>
      </div>
      {answer.isError || answer.data ? (
        <div className="min-w-0 sm:w-80">
          {answer.isError ? (
            <span className="text-[13px] text-destructive-text">{errorText(t, answer.error)}</span>
          ) : (
            <Outcome resolution={answer.data.resolution} />
          )}
        </div>
      ) : null}
    </form>
  )
}

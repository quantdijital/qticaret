import { Badge, Button, Container, Heading, Text } from "@medusajs/ui"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { ErrorState, LoadingRows } from "../../components/page-states"
import { setupStatus } from "./setup-steps"
import type { SetupStatus, SetupStep } from "./setup-steps"
import { useSetupFacts } from "./use-home-data"

/**
 * "Get your shop ready": each step in one plain sentence with a button to
 * the screen that completes it; the first open step is marked as next.
 */
export function SetupChecklist() {
  const { t } = useTranslation()
  const { data, isPending, isError, refetch } = useSetupFacts()
  const status = data ? setupStatus(data) : null

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-col gap-1 px-6 py-4">
        <Heading level="h2">{t("qticaret.home.setup.title")}</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          {t("qticaret.home.setup.subtitle")}
        </Text>
      </div>
      <div className="px-6 py-4">
        {isPending ? (
          <LoadingRows rows={6} />
        ) : isError || !status ? (
          <ErrorState text={t("qticaret.home.setup.error")} onRetry={() => void refetch()} />
        ) : status.nextKey === null ? (
          <Text size="small">{t("qticaret.home.setup.allDone")}</Text>
        ) : (
          <SetupSteps status={status} />
        )}
      </div>
    </Container>
  )
}

function SetupSteps({ status }: { status: SetupStatus }) {
  const { t } = useTranslation()
  const total = status.steps.length
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Text size="small" weight="plus">
          {t("qticaret.home.setup.progress", { done: status.doneCount, total })}
        </Text>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={status.doneCount}
          aria-label={t("qticaret.home.setup.title")}
          className="bg-ui-bg-component h-2 w-full overflow-hidden rounded-full"
        >
          <div
            className="bg-ui-fg-interactive h-full rounded-full"
            style={{ width: `${String(Math.round((status.doneCount / total) * 100))}%` }}
          />
        </div>
      </div>
      <ol className="flex flex-col divide-y">
        {status.steps.map(({ step, isDone }) => (
          <SetupStepRow
            key={step.key}
            step={step}
            isDone={isDone}
            isNext={step.key === status.nextKey}
          />
        ))}
      </ol>
    </div>
  )
}

function SetupStepRow({
  step,
  isDone,
  isNext,
}: {
  step: SetupStep
  isDone: boolean
  isNext: boolean
}) {
  const { t } = useTranslation()
  const texts = `qticaret.home.setup.steps.${step.key}`
  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Text
            size="small"
            weight="plus"
            className={isDone ? "text-ui-fg-subtle line-through" : undefined}
          >
            {t(`${texts}.title`)}
          </Text>
          {isDone && (
            <Badge size="2xsmall" color="green">
              {t("qticaret.home.setup.done")}
            </Badge>
          )}
          {isNext && (
            <Badge size="2xsmall" color="blue">
              {t("qticaret.home.setup.next")}
            </Badge>
          )}
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          {t(`${texts}.description`)}
        </Text>
      </div>
      {!isDone && (
        <Button
          size="small"
          variant={isNext ? "primary" : "secondary"}
          className="shrink-0"
          asChild
        >
          <Link to={step.to}>{t(`${texts}.action`)}</Link>
        </Button>
      )}
    </li>
  )
}

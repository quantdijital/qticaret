import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogSection,
  DialogTitle,
} from "@qticaret/admin-ui/ui/dialog"
import { templatesQuery } from "@/features/attributes/api"
import { sheetJobQuery } from "@/features/products/api/sheets"
import { errorText } from "@/lib/errors"
import { formatCount } from "@qticaret/admin-ui/lib/format"
import { factsPreviewQuery, startFactsRun } from "./api"
import { choiceKey, hasWork, runInput, valuesToWrite } from "./choices"
import type { Choices } from "./choices"
import { FactsOverview } from "./facts-overview"
import { FactsProducts } from "./facts-products"
import { FactsResult } from "./facts-result"
import { FactsSuggestions } from "./facts-suggestions"

const F = "attributes.facts"

interface FactsDialogProps {
  /** The products to read; the dialog is open while there are any. */
  productIds: readonly string[]
  onClose: () => void
  /** A run was started: the products read again (a bulk selection let go). */
  onDone?: () => void
}

/**
 * "Açıklamadaki özellikleri aktar" (adr/0013 Ek 2026-11-05): what the
 * products' descriptions state as facts, the field each goes to and its
 * value, the labels no field names (to add as fields, or as another name
 * of one), then the run that writes them, its progress and its report.
 * Nothing is removed from a description; a value a product holds stays
 * unless the shop ticks "üzerine yaz"; a row that does not read is listed
 * and skipped, never a reason to stop.
 */
export function FactsDialog({ productIds, onClose, onDone }: FactsDialogProps) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const open = productIds.length > 0
  // undefined: not chosen, the template the first reading suggests for products without one
  const [chosen, setChosen] = useState<string | null | undefined>(undefined)
  const [choices, setChoices] = useState<Choices>({})
  const [overwrite, setOverwrite] = useState(false)
  const [sending, setSending] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const first = useQuery(factsPreviewQuery(open ? productIds : [], null))
  const templateId =
    chosen === undefined
      ? first.data && first.data.counts.no_template > 0
        ? first.data.suggested_template_id
        : null
      : chosen
  // The same reading as the first when no template is given (one request)
  const preview = useQuery(factsPreviewQuery(open && first.data ? productIds : [], templateId))
  const templates = useQuery(templatesQuery())
  const job = useQuery(sheetJobQuery(jobId)).data
  const finished = job !== undefined && job.status !== "queued" && job.status !== "running"
  const byId = useMemo(
    () => new Map((templates.data ?? []).map((template) => [template.id, template])),
    [templates.data]
  )
  const data = preview.data
  const failed = first.isError ? first : preview.isError ? preview : null

  const input = data ? runInput(productIds, data, choices, { overwrite, templateId }) : null
  const close = () => {
    if (job && !finished) {
      toast.info(t(`${F}.background`))
    }
    if (job) {
      void client.invalidateQueries({ queryKey: ["products"] })
      void client.invalidateQueries({ queryKey: ["attribute-templates"] })
      onDone?.()
    }
    setChosen(undefined)
    setChoices({})
    setOverwrite(false)
    setJobId(null)
    onClose()
  }
  const apply = async () => {
    if (!input) {
      return
    }
    setSending(true)
    try {
      setJobId((await startFactsRun(input)).id)
    } catch (failure) {
      toast.error(errorText(t, failure))
    } finally {
      setSending(false)
    }
  }
  const empty = data?.counts.with_facts === 0
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          close()
        }
      }}
    >
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t(`${F}.title`)}</DialogTitle>
          <DialogDescription>
            {t(`${F}.description`, {
              count: productIds.length,
              formatted: formatCount(productIds.length),
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody list>
          {job ? (
            <FactsResult job={job} />
          ) : failed ? (
            <ErrorState text={errorText(t, failed.error)} onRetry={() => void failed.refetch()} />
          ) : !data || !templates.data ? (
            <LoadingRows rows={4} />
          ) : empty ? (
            <p className="text-sm text-muted-foreground">{t(`${F}.empty`)}</p>
          ) : (
            <>
              <FactsOverview
                counts={data.counts}
                bare={first.data?.counts.no_template ?? 0}
                values={valuesToWrite(data, overwrite)}
                templates={templates.data}
                templateId={templateId}
                onTemplate={setChosen}
                overwrite={overwrite}
                onOverwrite={setOverwrite}
              />
              {data.suggestions.length > 0 ? (
                <DialogSection
                  title={t(`${F}.suggestionsTitle`)}
                  description={t(`${F}.suggestionsHint`)}
                >
                  <FactsSuggestions
                    suggestions={data.suggestions}
                    templates={byId}
                    choices={choices}
                    onChange={(id, suggestion, next) => {
                      setChoices((was) => ({ ...was, [choiceKey(id, suggestion.name)]: next }))
                    }}
                  />
                </DialogSection>
              ) : null}
              <DialogSection title={t(`${F}.productsTitle`)}>
                <FactsProducts products={data.products} templates={byId} overwrite={overwrite} />
              </DialogSection>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          {job || empty ? (
            <Button variant="outline" onClick={close}>
              {t("common.close")}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={close}>
                {t("common.cancel")}
              </Button>
              <Button
                disabled={
                  sending || preview.isPlaceholderData || !input || !data || !hasWork(data, input)
                }
                onClick={() => void apply()}
              >
                {sending ? <Loader2 className="animate-spin" /> : null}
                {t(`${F}.apply`)}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

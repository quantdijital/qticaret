import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { DetailDialog } from "@qticaret/admin-ui/patterns/detail-dialog"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import type { PickerOption } from "@qticaret/admin-ui/patterns/search-picker"
import { Button } from "@qticaret/admin-ui/ui/button"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import type { AddonTemplate } from "@/features/products/api/addon-templates"
import { startBulkEdit, startScopedBulkEdit } from "@/features/products/api/bulk"
import { sheetJobQuery } from "@/features/products/api/sheets"
import { Choices } from "@/features/products/bulk/bulk-choices"
import { BulkJobResult } from "@/features/products/bulk/bulk-job-result"
import { errorText } from "@/lib/errors"
import { CategoryTarget, ProductsTarget } from "./apply-targets"

const P = "products.addonTemplates.apply"

type Mode = "add" | "remove"
type Target = "all" | "category" | "products"

interface AddonTemplateApplyDialogProps {
  template: AddonTemplate
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Linking needs the shop's add-ons on; unlinking never does. */
  flagOn: boolean
}

/**
 * "Ürünlere uygula" on a template's page (2026-11-23): link it to, or
 * unlink it from, every product, a category's (with those below it) or
 * products picked — one bulk edit job, its progress and outcome shown
 * in place, with the report. A product it would take past five add-ons
 * is left out and named there. The usage beside reads again once done.
 */
export function AddonTemplateApplyDialog({
  template,
  open,
  onOpenChange,
  flagOn,
}: AddonTemplateApplyDialogProps) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [picked, setMode] = useState<Mode>("add")
  // With the shop's add-ons off only unlinking is offered (the flag may arrive after opening)
  const mode: Mode = flagOn ? picked : "remove"
  const [target, setTarget] = useState<Target>("all")
  const [category, setCategory] = useState<PickerOption | null>(null)
  const [products, setProducts] = useState<PickerOption[]>([])
  const [tried, setTried] = useState(false)
  const [sending, setSending] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const job = useQuery(sheetJobQuery(jobId)).data
  const finished = job !== undefined && job.status !== "queued" && job.status !== "running"

  // Done: the template's usage and the products read again
  useEffect(() => {
    if (finished) {
      void client.invalidateQueries({ queryKey: ["addon-templates"] })
      void client.invalidateQueries({ queryKey: ["products"] })
    }
  }, [finished, client])

  const missing =
    target === "category" && category === null
      ? `${P}.errors.category`
      : target === "products" && products.length === 0
        ? `${P}.errors.products`
        : null

  const close = () => {
    if (job && !finished) {
      toast.info(t("products.bulk.background"))
    }
    setMode("add")
    setTarget("all")
    setCategory(null)
    setProducts([])
    setTried(false)
    setJobId(null)
    onOpenChange(false)
  }

  const apply = async () => {
    setTried(true)
    if (missing) {
      return
    }
    const change = { action: "addon_template", mode, template_id: template.id } as const
    setSending(true)
    try {
      const started =
        target === "products"
          ? await startBulkEdit(
              products.map((each) => each.id),
              change
            )
          : await startScopedBulkEdit(
              target === "category" && category
                ? { kind: "category", category_id: category.id }
                : { kind: "all" },
              change
            )
      setJobId(started.id)
    } catch (failure) {
      toast.error(errorText(t, failure))
    } finally {
      setSending(false)
    }
  }

  return (
    <DetailDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          close()
        }
      }}
      title={t(`${P}.title`)}
      description={t(`${P}.description`, { name: template.name })}
      pane="fixed"
      className="sm:h-[min(var(--dialog-max-height),34rem)]"
      footer={
        job ? (
          <Button variant="outline" onClick={close}>
            {t("common.close")}
          </Button>
        ) : (
          <>
            <Button variant="cancel" onClick={close}>
              {t("common.cancel")}
            </Button>
            <Button disabled={sending} onClick={() => void apply()}>
              {sending ? <Loader2 className="animate-spin" /> : null}
              {t(`${P}.submit.${mode}`)}
            </Button>
          </>
        )
      }
    >
      <DialogBody>
        {job ? (
          <BulkJobResult job={job} />
        ) : (
          <>
            <Field label={t(`${P}.mode`)} hint={t(`${P}.modeHints.${mode}`)}>
              <Choices
                label={t(`${P}.mode`)}
                className="sm:grid-cols-2"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "add", label: t(`${P}.modes.add`), disabled: !flagOn },
                  { value: "remove", label: t(`${P}.modes.remove`) },
                ]}
              />
            </Field>
            <Field label={t(`${P}.target`)}>
              <Choices
                label={t(`${P}.target`)}
                value={target}
                onChange={(next) => {
                  setTried(false)
                  setTarget(next)
                }}
                options={(["all", "category", "products"] as const).map((value) => ({
                  value,
                  label: t(`${P}.targets.${value}`),
                }))}
              />
            </Field>
            {target === "category" ? (
              <Field
                label={t(`${P}.category`)}
                htmlFor="addon-apply-category"
                hint={t(`${P}.categoryHint`)}
                error={tried && missing ? t(missing) : undefined}
              >
                <CategoryTarget value={category} onChange={setCategory} />
              </Field>
            ) : target === "products" ? (
              <Field
                label={t(`${P}.products`)}
                htmlFor="addon-apply-products"
                error={tried && missing ? t(missing) : undefined}
              >
                <ProductsTarget value={products} onChange={setProducts} />
              </Field>
            ) : (
              <p className="text-[13px] text-muted-foreground">{t(`${P}.allHint`)}</p>
            )}
          </>
        )}
      </DialogBody>
    </DetailDialog>
  )
}

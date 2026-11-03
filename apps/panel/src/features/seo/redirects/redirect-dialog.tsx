import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Field } from "@/components/patterns/form-section"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { QUERY_POLICIES, REDIRECT_MATCHES, useSaveRedirect } from "@/features/seo/api/redirects"
import { errorText } from "@/lib/errors"
import { EMPTY_REDIRECT, inputOf, redirectSchema } from "./form"
import type { RedirectForm } from "./form"

const STATUSES = ["301", "302", "307", "410"] as const

interface RedirectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The rule being changed; none adds one. */
  ruleId?: string | undefined
  initial?: Partial<RedirectForm> | undefined
  onSaved?: () => void
}

function RedirectFormBody({
  ruleId,
  initial,
  onDone,
  onSaved,
}: Omit<RedirectDialogProps, "open" | "onOpenChange"> & { onDone: () => void }) {
  const { t } = useTranslation()
  const save = useSaveRedirect()
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<RedirectForm>({
    resolver: zodResolver(redirectSchema),
    defaultValues: { ...EMPTY_REDIRECT, ...initial },
  })
  const [match, status, policy] = useWatch({
    control: form.control,
    name: ["match", "status", "query_policy"],
  })
  const { errors } = form.formState
  const message = (key: string | undefined) => (key ? t(key) : undefined)

  const submit = form.handleSubmit((values) => {
    setFailure(null)
    save.mutate(
      { ...(ruleId ? { id: ruleId } : {}), rule: inputOf(values) },
      {
        onSuccess: () => {
          toast.success(t(ruleId ? "seo.redirects.form.updated" : "seo.redirects.form.created"))
          onSaved?.()
          onDone()
        },
        onError: (error) => {
          setFailure(errorText(t, error))
        },
      }
    )
  })

  return (
    <form
      className="flex flex-col gap-6"
      noValidate
      onSubmit={(event) => {
        void submit(event)
      }}
    >
      <DialogBody>
        <Field label={t("seo.redirects.form.match")} hint={t(`seo.redirects.matchHints.${match}`)}>
          <Controller
            control={form.control}
            name="match"
            render={({ field }) => (
              <ToggleGroup
                type="single"
                variant="outline"
                value={field.value}
                onValueChange={(next) => {
                  if (next) {
                    field.onChange(next)
                  }
                }}
                className="w-full"
              >
                {REDIRECT_MATCHES.map((option) => (
                  <ToggleGroupItem key={option} value={option} className="flex-1">
                    {t(`seo.redirects.matches.${option}`)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}
          />
        </Field>
        <Field
          label={t("seo.redirects.form.source")}
          htmlFor="redirect-source"
          hint={t("seo.redirects.form.sourceHint")}
          error={message(errors.source?.message)}
          required
        >
          <Input
            id="redirect-source"
            spellCheck={false}
            autoComplete="off"
            className="font-mono text-[13px]"
            placeholder={t(`seo.redirects.placeholders.${match}`)}
            {...form.register("source")}
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
          <Field label={t("seo.redirects.form.status")} htmlFor="redirect-status">
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="redirect-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {t(`seo.redirects.statuses.${option}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          {status === "410" ? (
            <p className="self-end pb-2 text-[13px] text-muted-foreground">
              {t("seo.redirects.form.goneHint")}
            </p>
          ) : (
            <Field
              label={t("seo.redirects.form.target")}
              htmlFor="redirect-target"
              hint={match === "exact" ? undefined : t("seo.redirects.form.targetPatternHint")}
              error={message(errors.target?.message)}
              required
            >
              <Input
                id="redirect-target"
                spellCheck={false}
                autoComplete="off"
                className="font-mono text-[13px]"
                placeholder={t(`seo.redirects.targetPlaceholders.${match}`)}
                {...form.register("target")}
              />
            </Field>
          )}
        </div>
        {status === "410" ? null : (
          <Field label={t("seo.redirects.form.query")} htmlFor="redirect-query">
            <div className="flex flex-col gap-2">
              <Controller
                control={form.control}
                name="query_policy"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="redirect-query" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QUERY_POLICIES.map((option) => (
                        <SelectItem key={option} value={option}>
                          {t(`seo.redirects.queryPolicies.${option}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {policy === "keep_list" ? (
                <Input
                  aria-label={t("seo.redirects.form.keepList")}
                  spellCheck={false}
                  className="font-mono text-[13px]"
                  placeholder="utm_source, utm_medium"
                  {...form.register("query_keep")}
                />
              ) : null}
              {errors.query_keep?.message ? (
                <p role="alert" className="text-xs text-destructive-text">
                  {t(errors.query_keep.message)}
                </p>
              ) : null}
            </div>
          </Field>
        )}
        {failure ? (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive-text"
          >
            {failure}
          </p>
        ) : null}
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" disabled={save.isPending} onClick={onDone}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? <Loader2 className="animate-spin" /> : null}
          {t(ruleId ? "common.save" : "seo.redirects.add")}
        </Button>
      </DialogFooter>
    </form>
  )
}

/**
 * Adds or changes a redirect rule (docs/13 §4): the kind of match, the
 * old address, the answer and where it sends visitors. The server keeps
 * the rule set free of chains and loops and says why it refuses one.
 */
export function RedirectDialog({ open, onOpenChange, ...props }: RedirectDialogProps) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {t(props.ruleId ? "seo.redirects.form.editTitle" : "seo.redirects.form.title")}
          </DialogTitle>
          <DialogDescription>{t("seo.redirects.form.description")}</DialogDescription>
        </DialogHeader>
        {/* Mounted per opening, so a closed dialog forgets what was typed */}
        {open ? (
          <RedirectFormBody
            {...props}
            onDone={() => {
              onOpenChange(false)
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

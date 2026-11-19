import { Check, Copy, Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { API_SCOPES, scopeKey, useCreateApiKey } from "@/features/settings/api/api-access"
import type { ApiScope } from "@/features/settings/api/api-access"
import { errorText } from "@/lib/errors"

const K = "settings.api.create"

/** The key as made: shown here once, to copy into the other system. */
function MadeKey({ token }: { token: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed bg-muted/40 p-4">
      <span className="text-sm font-medium text-warning-text">{t(`${K}.once`)}</span>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 font-mono text-sm break-all select-all">{token}</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t(`${K}.copy`)}
          onClick={() => {
            // Refused without the page's clipboard permission: the key stays selectable
            navigator.clipboard.writeText(token).then(
              () => {
                setCopied(true)
              },
              () => toast.error(t(`${K}.copyFailed`))
            )
          }}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
    </div>
  )
}

/** A new API key: its name and what it may reach; then the key itself, once (F11.6). */
export function ApiKeyDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const create = useCreateApiKey()
  const [title, setTitle] = useState("")
  const [scopes, setScopes] = useState<ApiScope[]>(["orders:read"])
  const [token, setToken] = useState<string | null>(null)
  const close = (next: boolean) => {
    if (!next) {
      setTitle("")
      setScopes(["orders:read"])
      setToken(null)
      create.reset()
    }
    onOpenChange(next)
  }
  const valid = title.trim().length > 0 && title.trim().length <= 60 && scopes.length > 0
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(`${K}.title`)}</DialogTitle>
          <DialogDescription>{t(token ? `${K}.madeHint` : `${K}.hint`)}</DialogDescription>
        </DialogHeader>
        {token ? (
          <MadeKey token={token} />
        ) : (
          <div className="flex flex-col gap-5">
            <Field label={t(`${K}.name`)} htmlFor="api-key-title" hint={t(`${K}.nameHint`)}>
              <Input
                id="api-key-title"
                value={title}
                maxLength={60}
                autoComplete="off"
                onChange={(event) => {
                  setTitle(event.target.value)
                }}
              />
            </Field>
            <Field label={t(`${K}.scopes`)}>
              <div className="flex flex-col gap-2.5">
                {API_SCOPES.map((scope) => (
                  <label key={scope} className="flex cursor-pointer items-start gap-2.5 text-sm">
                    <Checkbox
                      className="mt-0.5"
                      checked={scopes.includes(scope)}
                      onCheckedChange={(checked) => {
                        setScopes((current) =>
                          checked === true
                            ? [...current, scope]
                            : current.filter((each) => each !== scope)
                        )
                      }}
                    />
                    <span className="flex flex-col">
                      <span className="font-medium">
                        {t(`settings.api.scopes.${scopeKey(scope)}.name`)}
                      </span>
                      <span className="text-[13px] text-muted-foreground">
                        {t(`settings.api.scopes.${scopeKey(scope)}.hint`)}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </Field>
          </div>
        )}
        <DialogFooter>
          {token ? (
            <Button
              onClick={() => {
                close(false)
              }}
            >
              {t(`${K}.done`)}
            </Button>
          ) : (
            <>
              <Button
                variant="cancel"
                onClick={() => {
                  close(false)
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button
                disabled={!valid || create.isPending}
                onClick={() => {
                  create.mutate(
                    { title: title.trim(), scopes },
                    {
                      onSuccess: (made) => {
                        setToken(made.token)
                      },
                      onError: (failure) => toast.error(errorText(t, failure)),
                    }
                  )
                }}
              >
                {create.isPending ? <Loader2 className="animate-spin" /> : null}
                {t(`${K}.submit`)}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import { useQuery } from "@tanstack/react-query"
import { CircleCheck, Loader2, PlugZap } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Field } from "@/components/patterns/form-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ShopifySettings } from "@/features/settings/api/migration"
import { providerAccountsQuery, useSaveAccount } from "@/features/settings/api/payments"
import type { ProviderAccount } from "@/features/settings/api/payments"
import { errorText } from "@/lib/errors"

const S = "settings.migration.shopify"

/**
 * The owner's Shopify app (F14.2): its store, client id and secret, checked
 * as they are saved. Connected, the form folds behind "Connect again".
 */
export function ShopifyConnection() {
  const { t } = useTranslation()
  const accounts = useQuery(providerAccountsQuery())
  const save = useSaveAccount("shopify")
  const account = accounts.data?.accounts.find((each) => each.provider === "shopify") as
    ProviderAccount<ShopifySettings> | undefined
  const connected = account?.state === "connected" && account.settings
  const [editing, setEditing] = useState(false)
  const [domain, setDomain] = useState("")
  const [clientId, setClientId] = useState("")
  const [secret, setSecret] = useState("")
  if (connected && !editing) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2.5">
        <p className="flex items-center gap-2 text-sm">
          <CircleCheck className="size-4 text-success-text" aria-hidden="true" />
          {t(`${S}.connected`, { shop: account.settings?.shop_domain ?? "" })}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setEditing(true)
          }}
        >
          {t(`${S}.reconnect`)}
        </Button>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <p className="text-[13px] text-muted-foreground">{t(`${S}.steps`)}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t(`${S}.shopDomain`)} htmlFor="shopify-domain" className="sm:col-span-2">
          <Input
            id="shopify-domain"
            placeholder="magaza-adi.myshopify.com"
            autoComplete="off"
            value={domain}
            onChange={(event) => {
              setDomain(event.target.value)
            }}
          />
        </Field>
        <Field label={t(`${S}.clientId`)} htmlFor="shopify-client">
          <Input
            id="shopify-client"
            autoComplete="off"
            value={clientId}
            onChange={(event) => {
              setClientId(event.target.value)
            }}
          />
        </Field>
        <Field label={t(`${S}.clientSecret`)} htmlFor="shopify-secret">
          <Input
            id="shopify-secret"
            type="password"
            autoComplete="off"
            value={secret}
            onChange={(event) => {
              setSecret(event.target.value)
            }}
          />
        </Field>
      </div>
      <Button
        className="self-start"
        disabled={save.isPending || !domain.trim() || !clientId.trim() || !secret.trim()}
        onClick={() => {
          save.mutate(
            {
              settings: { shop_domain: domain.trim(), client_id: clientId.trim() },
              secrets: { client_secret: secret.trim() },
            },
            {
              onSuccess: () => {
                setSecret("")
                setEditing(false)
                toast.success(t(`${S}.saved`))
              },
              onError: (failure) => toast.error(errorText(t, failure)),
            }
          )
        }}
      >
        {save.isPending ? <Loader2 className="animate-spin" /> : <PlugZap />}
        {t(account?.settings ? `${S}.reconnect` : `${S}.connect`)}
      </Button>
    </div>
  )
}

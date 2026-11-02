import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { CardForm } from "@/components/patterns/card-form"
import { Field } from "@/components/patterns/form-section"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useSaveSection } from "@/features/settings/api/sections"
import type { LegalSettings, StoreSettings } from "@/features/settings/api/sections"
import { displayTrPhone, errorLine, isHttpsUrl, phoneSchema } from "@/features/settings/storefront"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@/lib/forms"

const C = "settings.store.contact"
const E = "settings.store.errors"
const MAX_ADDRESS_LENGTH = 500

const schema = z.object({
  contact_email: z
    .string()
    .trim()
    .max(254, `${E}.emailInvalid`)
    .refine((value) => value === "" || z.email().safeParse(value).success, `${E}.emailInvalid`),
  contact_phone: phoneSchema,
  whatsapp_phone: phoneSchema,
  map_url: z
    .string()
    .trim()
    .refine((value) => value === "" || isHttpsUrl(value), `${E}.urlInvalid`),
  // Line breaks are fine here: the server keeps them
  address: z.string().trim().max(MAX_ADDRESS_LENGTH, `${E}.tooLong`),
})
type Values = z.infer<typeof schema>

const STORE_FIELDS = ["contact_email", "contact_phone", "whatsapp_phone", "map_url"] as const

const phoneOf = (e164: string | null) => (e164 ? displayTrPhone(e164) : "")

const valuesOf = (store: StoreSettings, legal: LegalSettings): Values => ({
  contact_email: store.contact_email ?? "",
  contact_phone: phoneOf(store.contact_phone),
  whatsapp_phone: phoneOf(store.whatsapp_phone),
  map_url: store.map_url ?? "",
  address: legal.address ?? "",
})

const orNone = (value: string) => (value === "" ? null : value)

/**
 * How customers reach the shop (adr/0048), the one place each is written:
 * the storefront's footer and contact page, the legal texts, e-mails and
 * Google's structured data read them, and a text's `{telefon}` shows them.
 * The address is the legal identity's (the `legal` section).
 */
export function StoreContactCard({
  store,
  legal,
  className,
}: {
  store: StoreSettings
  legal: LegalSettings
  className?: string
}) {
  const { t } = useTranslation()
  const saveStore = useSaveSection<StoreSettings>("store")
  const saveLegal = useSaveSection<LegalSettings>("legal")
  const values = valuesOf(store, legal)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const { dirtyFields, errors } = form.formState

  const submit = form.handleSubmit(async (next) => {
    try {
      const storeSaved = STORE_FIELDS.some((field) => dirtyFields[field])
        ? await saveStore.mutateAsync({
            contact_email: orNone(next.contact_email),
            contact_phone: orNone(next.contact_phone),
            whatsapp_phone: orNone(next.whatsapp_phone),
            map_url: orNone(next.map_url),
          })
        : null
      const legalSaved = dirtyFields.address
        ? await saveLegal.mutateAsync({ address: orNone(next.address) })
        : null
      // What the server stored: phones as it writes them, text trimmed
      form.reset(valuesOf(storeSaved?.values ?? store, legalSaved?.values ?? legal), FULL_RESET)
      toast.success(t("settings.saved"))
    } catch (failure) {
      toast.error(errorText(t, failure))
    }
  })

  const field = (name: keyof Values, max?: number) => {
    const error = errorLine(t, errors[name], max)
    return {
      props: {
        label: t(`${C}.${name}`),
        htmlFor: `store-${name}`,
        hint: t(`${C}.${name}Hint`),
        error,
      },
      invalid: Boolean(error),
    }
  }
  const email = field("contact_email")
  const phone = field("contact_phone")
  const whatsapp = field("whatsapp_phone")
  const map = field("map_url")
  const address = field("address", MAX_ADDRESS_LENGTH)

  return (
    <CardForm
      title={t(`${C}.title`)}
      description={t(`${C}.description`)}
      className={className}
      dirty={form.formState.isDirty}
      saving={saveStore.isPending || saveLegal.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values, FULL_RESET)
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field {...email.props}>
          <Input
            id="store-contact_email"
            type="email"
            autoComplete="off"
            aria-invalid={email.invalid}
            {...form.register("contact_email")}
          />
        </Field>
        <Field {...phone.props}>
          <Input
            id="store-contact_phone"
            type="tel"
            placeholder="0212 123 45 67"
            aria-invalid={phone.invalid}
            {...form.register("contact_phone")}
          />
        </Field>
        <Field {...whatsapp.props}>
          <Input
            id="store-whatsapp_phone"
            type="tel"
            placeholder="0532 123 45 67"
            aria-invalid={whatsapp.invalid}
            {...form.register("whatsapp_phone")}
          />
        </Field>
        <Field {...map.props}>
          <Input
            id="store-map_url"
            type="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://maps.app.goo.gl/…"
            aria-invalid={map.invalid}
            {...form.register("map_url")}
          />
        </Field>
      </div>
      <Field {...address.props}>
        <Textarea
          id="store-address"
          rows={2}
          maxLength={MAX_ADDRESS_LENGTH}
          aria-invalid={address.invalid}
          {...form.register("address")}
        />
      </Field>
    </CardForm>
  )
}

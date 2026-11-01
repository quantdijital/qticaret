import { zodResolver } from "@hookform/resolvers/zod"
import { RotateCcw } from "lucide-react"
import { useFieldArray, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { CardForm } from "@/components/patterns/card-form"
import { Field } from "@/components/patterns/form-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { StorefrontHero, StorefrontSettings } from "@/features/settings/api/sections"
import { LinkRows, ListFooter } from "@/features/settings/components/storefront-rows"
import {
  FULL_RESET,
  STOREFRONT_LIMITS,
  errorLine,
  linkSchema,
  optionalLineSchema,
  useSaveStorefront,
} from "@/features/settings/storefront"

const S = "settings.storefront"
const H = `${S}.hero`
const LIMITS = STOREFRONT_LIMITS

// The storefront shows the text as one paragraph, and the server takes no line breaks
const oneLine = (value: string) => value.replace(/\s*[\r\n\t]+\s*/g, " ")

const schema = z
  .object({
    eyebrow: optionalLineSchema(LIMITS.heroEyebrowLength),
    heading: optionalLineSchema(LIMITS.heroHeadingLength),
    text: z.string().transform(oneLine).pipe(optionalLineSchema(LIMITS.heroTextLength)),
    links: z.array(linkSchema).max(LIMITS.heroLinks),
  })
  // Every field empty is the default opening; anything written needs a heading
  .refine((hero) => hero.heading !== "" || isBlank(hero), {
    path: ["heading"],
    message: `${S}.errors.required`,
  })
type Values = z.infer<typeof schema>

interface Fields {
  eyebrow: string
  heading: string
  text: string
  links: unknown[]
}

function isBlank(hero: Fields): boolean {
  return hero.eyebrow === "" && hero.heading === "" && hero.text === "" && hero.links.length === 0
}

const valuesOf = (saved: StorefrontSettings): Values => ({
  eyebrow: saved.hero?.eyebrow ?? "",
  heading: saved.hero?.heading ?? "",
  text: saved.hero?.text ?? "",
  links: (saved.hero?.links ?? []).map(({ label, href }) => ({ label, href })),
})

/** What the card holds as the server takes it: empty fields as none, all empty as no hero. */
const heroOf = (values: Values): StorefrontHero | null =>
  isBlank(values)
    ? null
    : {
        eyebrow: values.eyebrow === "" ? null : values.eyebrow,
        heading: values.heading,
        text: values.text === "" ? null : values.text,
        links: values.links,
      }

/**
 * The home page's opening: a short line, the heading, a sentence and up to
 * two buttons. With none, the storefront opens with the shop's name and its
 * first two categories.
 */
export function HeroCard({ saved }: { saved: StorefrontSettings }) {
  const { t } = useTranslation()
  const { save, saving } = useSaveStorefront()
  const values = valuesOf(saved)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const links = useFieldArray({ control: form.control, name: "links" })
  const { errors } = form.formState
  const saveHero = (hero: StorefrontHero | null) => {
    save({ hero }, (stored) => {
      form.reset(valuesOf(stored), FULL_RESET)
    })
  }
  const submit = form.handleSubmit((next) => {
    saveHero(heroOf(next))
  })
  const eyebrowError = errorLine(t, errors.eyebrow, LIMITS.heroEyebrowLength)
  const headingError = errorLine(t, errors.heading, LIMITS.heroHeadingLength)
  const textError = errorLine(t, errors.text, LIMITS.heroTextLength)
  return (
    <CardForm
      title={t(`${H}.title`)}
      description={t(`${H}.description`)}
      dirty={form.formState.isDirty}
      saving={saving}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values, FULL_RESET)
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-[13px] text-muted-foreground">
          {t(saved.hero === null ? `${H}.default` : `${H}.custom`)}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={saved.hero === null || saving}
          onClick={() => {
            saveHero(null)
          }}
        >
          <RotateCcw />
          {t(`${H}.reset`)}
        </Button>
      </div>
      <div className="@container">
        <div className="grid gap-5 @2xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <Field
            label={t(`${H}.eyebrow`)}
            htmlFor="storefront-hero-eyebrow"
            hint={t(`${H}.eyebrowHint`, { max: LIMITS.heroEyebrowLength })}
            error={eyebrowError}
          >
            <Input
              id="storefront-hero-eyebrow"
              aria-invalid={Boolean(eyebrowError)}
              placeholder={t(`${H}.eyebrowPlaceholder`)}
              {...form.register("eyebrow")}
            />
          </Field>
          <Field
            label={t(`${H}.heading`)}
            htmlFor="storefront-hero-heading"
            hint={t(`${H}.headingHint`, { max: LIMITS.heroHeadingLength })}
            error={headingError}
          >
            <Input
              id="storefront-hero-heading"
              aria-invalid={Boolean(headingError)}
              placeholder={t(`${H}.headingPlaceholder`)}
              {...form.register("heading")}
            />
          </Field>
        </div>
      </div>
      <Field
        label={t(`${H}.text`)}
        htmlFor="storefront-hero-text"
        hint={t(`${H}.textHint`, { max: LIMITS.heroTextLength })}
        error={textError}
      >
        <Textarea
          id="storefront-hero-text"
          rows={2}
          aria-invalid={Boolean(textError)}
          placeholder={t(`${H}.textPlaceholder`)}
          {...form.register("text")}
        />
      </Field>
      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium">{t(`${H}.buttons`)}</span>
        <LinkRows
          rows={links.fields}
          idPrefix="storefront-hero-link"
          names={`${H}.link`}
          register={(index, key) => form.register(`links.${index}.${key}`)}
          errors={(index) => errors.links?.[index]}
          onMove={(from, to) => {
            links.move(from, to)
          }}
          onRemove={(index) => {
            links.remove(index)
          }}
        />
        <ListFooter
          label={t(`${H}.addLink`)}
          hint={t(`${H}.linksHint`, { max: LIMITS.heroLinks })}
          full={links.fields.length >= LIMITS.heroLinks}
          onAdd={() => {
            links.append({ label: "", href: "" })
          }}
        />
      </div>
      {links.fields.length > 0 ? (
        <p className="text-[13px] text-muted-foreground">{t(`${S}.links.hrefHint`)}</p>
      ) : null}
    </CardForm>
  )
}

import { useQuery } from "@tanstack/react-query"
import { Controller, useWatch } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@/components/patterns/form-section"
import { MediaField } from "@/components/patterns/media-field"
import { DialogSection } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { AUTHOR_LIMITS, AUTHOR_LINKS, AUTHOR_PREFIX } from "@/features/content/api/authors"
import type { Author } from "@/features/content/api/authors"
import { Counter } from "@/features/seo/components/seo-card"
import { teamQuery } from "@/features/settings/api/team"
import { toSlug } from "@/lib/slug"
import type { AuthorValues } from "./author-values"

const A = "content.authors"
const NONE = "__none__"

const PLACEHOLDERS: Readonly<Record<(typeof AUTHOR_LINKS)[number], string>> = {
  website_url: "https://",
  linkedin_url: "https://www.linkedin.com/in/",
  instagram_url: "https://www.instagram.com/",
  x_url: "https://x.com/",
}

/**
 * The staff account the author is: the team's people when this person may
 * read them; otherwise only the account linked now, shown and kept.
 */
function StaffSelect({
  form,
  id,
  linked,
}: {
  form: UseFormReturn<AuthorValues>
  id: string
  linked: Author["user"]
}) {
  const { t } = useTranslation()
  const team = useQuery({ ...teamQuery(), retry: false })
  const people = (team.data?.staff ?? []).map((member) => ({
    id: member.id,
    label: [member.first_name, member.last_name].filter(Boolean).join(" ") || member.email,
  }))
  if (linked && !people.some((person) => person.id === linked.id)) {
    people.push({ id: linked.id, label: linked.name ?? linked.email })
  }
  return (
    <Field label={t(`${A}.fields.user`)} htmlFor={id} hint={t(`${A}.userHint`)}>
      <Controller
        control={form.control}
        name="user_id"
        render={({ field }) => (
          <Select
            value={field.value || NONE}
            disabled={team.isError && !linked}
            onValueChange={(next) => {
              field.onChange(next === NONE ? "" : next)
            }}
          >
            <SelectTrigger id={id} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t(`${A}.noUser`)}</SelectItem>
              {people.map((person) => (
                <SelectItem key={person.id} value={person.id}>
                  {person.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </Field>
  )
}

/** An author's fields: photo, name, address, title, biography, links and staff account. */
export function AuthorFields({
  form,
  idPrefix,
  author,
}: {
  form: UseFormReturn<AuthorValues>
  idPrefix: string
  author: Author | null
}) {
  const { t } = useTranslation()
  const id = (field: string) => `${idPrefix}-${field}`
  const [name, image, bio] = useWatch({ control: form.control, name: ["name", "image_url", "bio"] })
  return (
    <>
      <MediaField
        id={id("photo")}
        label={t(`${A}.fields.photo`)}
        hint={t(`${A}.photoHint`)}
        value={image || null}
        frame="square"
        inline
        emptyText={t(`${A}.noPhoto`)}
        onChange={(asset) => {
          form.setValue("image_url", asset?.url ?? "", { shouldDirty: true })
        }}
      />
      <Field
        label={t(`${A}.fields.name`)}
        htmlFor={id("name")}
        error={form.formState.errors.name?.message}
        required
      >
        <Input id={id("name")} maxLength={AUTHOR_LIMITS.name} {...form.register("name")} />
      </Field>
      <Field label={t(`${A}.fields.handle`)} htmlFor={id("handle")} hint={t(`${A}.handleHint`)}>
        <div className="flex items-center rounded-md border">
          <span className="pl-3 font-mono text-[13px] whitespace-nowrap text-muted-foreground">
            {AUTHOR_PREFIX}
          </span>
          <Input
            id={id("handle")}
            spellCheck={false}
            placeholder={toSlug(name)}
            className="border-0 pl-0 font-mono text-[13px] shadow-none"
            {...form.register("handle")}
          />
        </div>
      </Field>
      <Field
        label={t(`${A}.fields.jobTitle`)}
        htmlFor={id("job_title")}
        hint={t(`${A}.jobTitleHint`)}
      >
        <Input
          id={id("job_title")}
          maxLength={AUTHOR_LIMITS.jobTitle}
          {...form.register("job_title")}
        />
      </Field>
      <Field label={t(`${A}.fields.bio`)} htmlFor={id("bio")} hint={t(`${A}.bioHint`)}>
        <div className="flex flex-col gap-1">
          <Textarea
            id={id("bio")}
            maxLength={AUTHOR_LIMITS.bio}
            className="max-h-60 min-h-24"
            {...form.register("bio")}
          />
          <div className="flex justify-end">
            <Counter length={bio.length} limit={AUTHOR_LIMITS.bio} />
          </div>
        </div>
      </Field>
      <DialogSection title={t(`${A}.links`)} description={t(`${A}.linksHint`)}>
        <div className="grid gap-4 sm:grid-cols-2">
          {AUTHOR_LINKS.map((link) => (
            <Field key={link} label={t(`${A}.fields.${link}`)} htmlFor={id(link)}>
              <Input
                id={id(link)}
                type="url"
                inputMode="url"
                spellCheck={false}
                placeholder={PLACEHOLDERS[link]}
                {...form.register(link)}
              />
            </Field>
          ))}
        </div>
      </DialogSection>
      <StaffSelect form={form} id={id("user")} linked={author?.user ?? null} />
    </>
  )
}

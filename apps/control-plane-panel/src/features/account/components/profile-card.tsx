import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Label } from "@qticaret/admin-ui/ui/label"
import { useSaveProfile } from "@/features/account/api"
import type { Me } from "@/features/auth/api"
import { errorText } from "@/lib/errors"

const schema = z.object({
  first_name: z.string().trim().min(1, { message: "auth.required" }).max(100),
  last_name: z.string().trim().min(1, { message: "auth.required" }).max(100),
})
type Form = z.infer<typeof schema>

/** One's own name; the address and the role are read here, changed elsewhere (an owner). */
export function ProfileCard({ me }: { me: Me }) {
  const { t } = useTranslation()
  const save = useSaveProfile()
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    values: { first_name: me.first_name ?? "", last_name: me.last_name ?? "" },
    resetOptions: { keepDirtyValues: true },
  })
  const { errors, isDirty } = form.formState
  const submit = form.handleSubmit((values) => {
    save.mutate(
      { first_name: values.first_name.trim(), last_name: values.last_name.trim() },
      {
        onSuccess: () => {
          toast.success(t("account.profile.saved"))
        },
        onError: (error) => {
          toast.error(errorText(t, error))
        },
      }
    )
  })
  return (
    <CardForm
      title={t("account.profile.title")}
      description={t("account.profile.text")}
      dirty={isDirty}
      saving={save.isPending}
      onSubmit={() => {
        void submit()
      }}
      onReset={() => {
        form.reset()
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        {(["first_name", "last_name"] as const).map((name) => (
          <div key={name} className="flex flex-col gap-2">
            <Label htmlFor={`profile-${name}`}>{t(`account.profile.${name}`)}</Label>
            <Input
              id={`profile-${name}`}
              autoComplete={name === "first_name" ? "given-name" : "family-name"}
              aria-invalid={errors[name] ? true : undefined}
              {...form.register(name)}
            />
            {errors[name]?.message ? (
              <p className="text-xs text-destructive">{t(errors[name].message)}</p>
            ) : null}
          </div>
        ))}
      </div>
      <dl className="grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1">
          <dt className="text-[13px] text-muted-foreground">{t("account.profile.email")}</dt>
          <dd className="truncate">{me.email}</dd>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <dt className="text-[13px] text-muted-foreground">{t("account.profile.role")}</dt>
          <dd>{me.role ? t(`roles.${me.role}`) : null}</dd>
        </div>
      </dl>
    </CardForm>
  )
}

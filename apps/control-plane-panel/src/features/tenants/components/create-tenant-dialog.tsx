import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Label } from "@qticaret/admin-ui/ui/label"
import { plansQuery } from "@/features/packages/api"
import { NO_PACKAGE, PackagePicker } from "@/features/packages/components/package-picker"
import { useCreateTenant } from "@/features/tenants/mutations"
import { SLUG_PATTERN, slugFromName } from "@/features/tenants/slug"
import { errorText } from "@/lib/errors"

/**
 * A new shop as a record (owner, operator; adr/0061 §2): its name, its
 * address on the platform (suggested from the name until typed, fixed
 * once made) and optionally its package. It opens in `provisioning`; the
 * setup that brings it up comes later (C10, C11). Done, its page opens.
 */
export function CreateTenantDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const create = useCreateTenant()
  const plans = useQuery({ ...plansQuery(), enabled: open })
  const [name, setName] = useState("")
  const [typedSlug, setTypedSlug] = useState<string | null>(null)
  const [plan, setPlan] = useState(NO_PACKAGE)
  const [failure, setFailure] = useState<string | null>(null)
  const slug = typedSlug ?? slugFromName(name)
  const slugValid = SLUG_PATTERN.test(slug)
  const close = (next: boolean) => {
    if (!next) {
      setName("")
      setTypedSlug(null)
      setPlan(NO_PACKAGE)
      setFailure(null)
      create.reset()
    }
    onOpenChange(next)
  }
  return (
    <FormDialog
      open={open}
      onOpenChange={close}
      title={t("tenants.create.title")}
      description={t("tenants.create.text")}
      dirty={name.trim() !== "" || typedSlug !== null}
      saving={create.isPending}
      canSubmit={name.trim() !== "" && slugValid}
      submitLabel={t("tenants.create.submit")}
      onSubmit={() => {
        setFailure(null)
        create.mutate(
          { name: name.trim(), slug, package_id: plan === NO_PACKAGE ? null : plan },
          {
            onSuccess: ({ tenant }) => {
              close(false)
              toast.success(t("tenants.create.done"))
              void navigate({ to: "/tenants/$id", params: { id: tenant.id } })
            },
            onError: (error) => {
              setFailure(errorText(t, error))
            },
          }
        )
      }}
    >
      <DialogBody>
        <div className="flex flex-col gap-2">
          <Label htmlFor="tenant-name">{t("tenants.create.name")}</Label>
          <Input
            id="tenant-name"
            autoComplete="off"
            maxLength={100}
            value={name}
            onChange={(event) => {
              setName(event.target.value)
            }}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="tenant-slug">{t("tenants.create.slug")}</Label>
          <Input
            id="tenant-slug"
            autoComplete="off"
            spellCheck={false}
            maxLength={30}
            aria-describedby="tenant-slug-help"
            aria-invalid={slug !== "" && !slugValid}
            value={slug}
            onChange={(event) => {
              setTypedSlug(event.target.value.toLowerCase())
            }}
          />
          <p id="tenant-slug-help" className="text-[13px] text-muted-foreground">
            {slug !== "" && !slugValid
              ? t("tenants.create.slugInvalid")
              : t("tenants.create.slugHelp")}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <p id="tenant-package-label" className="text-sm font-medium">
            {t("tenants.create.package")}
          </p>
          <PackagePicker
            id="tenant-package"
            plans={plans.data?.plans ?? []}
            value={plan}
            onChange={setPlan}
          />
        </div>
        {failure ? (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        ) : null}
      </DialogBody>
    </FormDialog>
  )
}

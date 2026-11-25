import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Input } from "@qticaret/admin-ui/ui/input"
import { useUpdateOrder } from "@/features/orders/api/edit"
import { SideForm } from "@/features/products/detail/side-form"
import { errorText } from "@/lib/errors"

const A = "orders.address"

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, `${A}.emailRequired`)
    .max(254, `${A}.emailInvalid`)
    .refine((value) => z.email().safeParse(value).success, `${A}.emailInvalid`),
})

/**
 * The order's e-mail, changed in its card: where the order's messages go
 * from now on (a typo at checkout). The customer's account keeps its own.
 */
export function EmailForm({
  orderId,
  email,
  onClose,
}: {
  orderId: string
  email: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const save = useUpdateOrder(orderId)
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email },
  })
  const { errors, isDirty, isSubmitting } = form.formState
  const submit = form.handleSubmit(async (values) => {
    setFailure(null)
    try {
      await save.mutateAsync({ email: values.email })
      toast.success(t(`${A}.emailSaved`))
      onClose()
    } catch (error) {
      setFailure(errorText(t, error))
    }
  })
  const error = errors.email?.message
  return (
    <SideForm
      label={t(`${A}.email`)}
      hint={t(`${A}.emailHint`)}
      dirty={isDirty}
      saving={isSubmitting || save.isPending}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      <Field
        label={t(`${A}.email`)}
        htmlFor="order-email"
        error={error ? t(error) : undefined}
        required
      >
        <Input id="order-email" type="email" autoComplete="off" {...form.register("email")} />
      </Field>
      {failure ? (
        <p role="alert" className="text-sm text-destructive-text">
          {failure}
        </p>
      ) : null}
    </SideForm>
  )
}

import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Label } from "@qticaret/admin-ui/ui/label"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import { SCENE_NAME_MAX, SCENE_TEXT_MAX, sceneLength } from "@/features/ai/api/scenes"
import type { OwnScene } from "@/features/ai/api/scenes"

const C = "ai.scenes"

interface Fields {
  name: string
  prompt: string
}

/**
 * One saved scene in the standard form dialog: its name and the
 * background it describes (counted to 200). A name left empty is the
 * description's first words. The server cleans both again.
 */
export function AiSceneDialog({
  scene,
  saving,
  onSave,
  onClose,
}: {
  /** The scene to change; null: a new one. */
  scene: OwnScene | null
  saving: boolean
  onSave: (fields: Fields) => Promise<boolean>
  onClose: () => void
}) {
  const { t } = useTranslation()
  const form = useForm<Fields>({
    defaultValues: { name: scene?.name ?? "", prompt: scene?.prompt ?? "" },
  })
  const { errors, isDirty } = form.formState
  const prompt = useWatch({ control: form.control, name: "prompt" })

  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      title={t(scene ? `${C}.editTitle` : `${C}.addTitle`)}
      description={t(`${C}.dialogDescription`)}
      size="sm"
      dirty={isDirty}
      saving={saving}
      onSubmit={() => {
        void form.handleSubmit(async (fields) => {
          if (await onSave({ name: fields.name.trim(), prompt: fields.prompt.trim() })) {
            onClose()
          }
        })()
      }}
    >
      <DialogBody>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ai-scene-name">{t(`${C}.name`)}</Label>
          <Input
            id="ai-scene-name"
            maxLength={SCENE_NAME_MAX}
            placeholder={t(`${C}.namePlaceholder`)}
            {...form.register("name")}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ai-scene-prompt">{t(`${C}.prompt`)}</Label>
          <Textarea
            id="ai-scene-prompt"
            rows={3}
            maxLength={SCENE_TEXT_MAX}
            placeholder={t("ai.scene.custom.placeholder")}
            aria-invalid={errors.prompt ? true : undefined}
            aria-describedby="ai-scene-prompt-hint"
            {...form.register("prompt", { validate: (value) => value.trim() !== "" })}
          />
          <div
            id="ai-scene-prompt-hint"
            className="flex items-start justify-between gap-3 text-xs text-muted-foreground"
          >
            <span className={errors.prompt ? "text-destructive" : undefined}>
              {errors.prompt ? t(`${C}.promptRequired`) : t("ai.scene.custom.hint")}
            </span>
            <span className="shrink-0 tabular-nums">
              {t("ai.scene.custom.count", { count: sceneLength(prompt), max: SCENE_TEXT_MAX })}
            </span>
          </div>
        </div>
      </DialogBody>
    </FormDialog>
  )
}

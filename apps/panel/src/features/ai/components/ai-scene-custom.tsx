import { useId } from "react"
import { useTranslation } from "react-i18next"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Label } from "@qticaret/admin-ui/ui/label"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import { SCENE_NAME_MAX, SCENE_TEXT_MAX, sceneLength } from "@/features/ai/api/scenes"
import type { CustomScene } from "@/features/ai/use-custom-scene"

const S = "ai.scene.custom"

/**
 * The "Özel" scene's fields, under the scene chips: one box for the
 * background (counted to 200), and "Sahnelerime kaydet" with its name
 * only once ticked. Nothing more: the service and the run stay the
 * dialog's.
 */
export function AiSceneCustom({ scene, disabled }: { scene: CustomScene; disabled: boolean }) {
  const { t } = useTranslation()
  const id = useId()
  const count = sceneLength(scene.text)
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`${id}-text`}>{t(`${S}.label`)}</Label>
      <Textarea
        id={`${id}-text`}
        rows={2}
        maxLength={SCENE_TEXT_MAX}
        placeholder={t(`${S}.placeholder`)}
        value={scene.text}
        disabled={disabled}
        aria-describedby={`${id}-hint ${id}-count`}
        onChange={(event) => {
          scene.setText(event.target.value)
        }}
      />
      <div className="flex items-start justify-between gap-3 text-xs text-muted-foreground">
        <span id={`${id}-hint`}>{t(`${S}.hint`)}</span>
        <span id={`${id}-count`} className="shrink-0 tabular-nums">
          {t(`${S}.count`, { count, max: SCENE_TEXT_MAX })}
        </span>
      </div>
      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
        <Checkbox
          checked={scene.keep}
          disabled={disabled}
          onCheckedChange={(checked) => {
            scene.setKeep(checked === true)
          }}
        />
        {t(`${S}.keep`)}
      </label>
      {scene.keep ? (
        <Input
          aria-label={t(`${S}.name`)}
          maxLength={SCENE_NAME_MAX}
          placeholder={t(`${S}.namePlaceholder`)}
          value={scene.name}
          disabled={disabled}
          onChange={(event) => {
            scene.setName(event.target.value)
          }}
        />
      ) : null}
      {scene.failure ? (
        <p className="text-sm text-destructive" role="alert">
          {scene.failure}
        </p>
      ) : null}
    </div>
  )
}

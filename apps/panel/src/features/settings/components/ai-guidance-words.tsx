import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { ChipInput } from "@qticaret/admin-ui/patterns/chip-input"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { GUIDANCE_LIMITS, textLength } from "@/features/ai/api/guidance"

const C = "ai.guidance"

/**
 * A word list of the writing guidance as chips: Enter or a comma adds the
 * typed words, each kept once (Turkish case), at most twenty, each forty
 * characters at most; a longer one stays in the field with the reason.
 */
export function GuidanceWords({
  label,
  words,
  disabled,
  onChange,
}: {
  label: string
  words: string[]
  disabled: boolean
  onChange: (next: string[]) => void
}) {
  const { t } = useTranslation()
  const id = useId()
  const [text, setText] = useState("")
  const [problem, setProblem] = useState<string | null>(null)

  const commit = () => {
    const typed = text
      .split(",")
      .map((word) => word.replace(/\s+/g, " ").trim())
      .filter(Boolean)
    if (typed.length === 0) {
      setText("")
      return
    }
    if (typed.some((word) => textLength(word) > GUIDANCE_LIMITS.word)) {
      setProblem(t(`${C}.wordTooLong`, { max: GUIDANCE_LIMITS.word }))
      return
    }
    const next = [...words]
    for (const word of typed) {
      const seen = next.some(
        (each) => each.toLocaleLowerCase("tr") === word.toLocaleLowerCase("tr")
      )
      if (!seen) {
        next.push(word)
      }
    }
    if (next.length > GUIDANCE_LIMITS.words) {
      setProblem(t(`${C}.wordsFull`, { max: GUIDANCE_LIMITS.words }))
      return
    }
    setProblem(null)
    setText("")
    onChange(next)
  }

  return (
    <Field
      label={label}
      htmlFor={id}
      hint={t(`${C}.wordsHint`, { max: GUIDANCE_LIMITS.words, length: GUIDANCE_LIMITS.word })}
      error={problem ?? undefined}
    >
      {disabled ? (
        <p id={id} className="text-sm text-muted-foreground">
          {words.length ? words.join(", ") : "—"}
        </p>
      ) : (
        <ChipInput
          id={id}
          chips={words.map((word) => ({ key: word, label: word }))}
          text={text}
          onTextChange={(next) => {
            setText(next)
            setProblem(null)
          }}
          onCommit={commit}
          onRemove={(index) => {
            onChange(words.filter((_, at) => at !== index))
          }}
          removeLabel={(word) => t(`${C}.removeWord`, { label: word })}
          placeholder={t(`${C}.wordsPlaceholder`)}
          invalid={problem !== null}
        />
      )}
    </Field>
  )
}

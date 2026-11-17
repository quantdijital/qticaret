import type { AiTask } from "./registry/tasks"

/**
 * Each task's fixed instruction and its options' (adr/0071 §2): what the
 * system message says. Written here only, never typed by a person; the
 * shop's data goes in the separate data block (lib/ai/prompt.ts). The
 * real tasks' sentences come with them (Aşama 1).
 */

interface TaskInstruction {
  base: string
  options: Readonly<Record<string, string>>
}

const INSTRUCTIONS: Readonly<Record<string, TaskInstruction>> = {
  test_text: {
    base: "Verilen ürün bilgisinden tek cümlelik, düz metin bir tanım yaz.",
    options: {
      plain: "Sade ve kısa yaz.",
      detailed: "Ürünün özelliklerini de an.",
    },
  },
}

/** The instruction for a task and one of its options; null when the task has none. */
export function instructionOf(task: AiTask, option?: string | null): string | null {
  const instruction = INSTRUCTIONS[task.id]
  if (!instruction) {
    return null
  }
  const extra = option ? instruction.options[option] : undefined
  return extra ? `${instruction.base} ${extra}` : instruction.base
}

/** Whether an option is one the task offers (none asked always is). */
export const isTaskOption = (task: AiTask, option: string | null | undefined): boolean =>
  option === undefined || option === null || task.options.includes(option)

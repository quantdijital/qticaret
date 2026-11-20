import { MIN_PRODUCT_WORDS } from "../seo/advisor"
import { wordCount } from "../seo/advisor/text"
import { SERP_TEXT_LENGTH } from "../seo/pixel-width"
import { RULES_HEADING } from "./instructions"
import { FOCUS_KEYWORD_MAX_LENGTH, FOCUS_KEYWORD_MAX_WORDS } from "./registry/catalog-tasks"
import type { AiTask } from "./registry/tasks"
import { ungroundedWords } from "./short-text-gate"

/**
 * The one correction (adr/0074 §4): when no candidate passed the gate,
 * the service is asked once more with the gate's reasons, in our own
 * words ("82 karakter; 30 ile 60 karakter arası olmalı"). A refused text
 * is never echoed back (it may hold what the gate caught); only its
 * length and, for an invented word, the word itself.
 */

export interface RefusedCandidate {
  text: string
  problems: readonly string[]
}

/** Invented words named back at most, each cut to a search word's length. */
const MAX_NAMED_WORDS = 5
const MAX_NAMED_WORD_LENGTH = 30

function lengthReason(task: AiTask, text: string): string {
  const chars = Array.from(text).length
  if (task.gate === "seo_title" || task.gate === "seo_description") {
    const { min, max } = SERP_TEXT_LENGTH[task.gate === "seo_title" ? "title" : "description"]
    return `${String(chars)} karakter; ${String(min)} ile ${String(max)} karakter arası olmalı ve arama sonucunun genişliğine sığmalı`
  }
  if (task.gate === "focus_keyword") {
    return `${String(chars)} karakter, ${String(wordCount(text))} sözcük; 2 ile ${String(FOCUS_KEYWORD_MAX_LENGTH)} karakter, en çok ${String(FOCUS_KEYWORD_MAX_WORDS)} sözcük olmalı`
  }
  return `${String(chars)} karakter; en çok ${String(task.maxLength)} karakter olmalı`
}

const REASONS: Readonly<Record<string, string>> = {
  empty: "boş",
  markup: "HTML ya da biçim işareti var",
  noise: "tümü büyük harf sözcük, art arda simge ya da tekrarlanan sözcük var",
  link: "bağlantı ya da web adresi gibi okunan bir ifade var",
  personal_data: "e-posta, telefon ya da kimlik numarası gibi kişisel veri sayılan bir ifade var",
  lines: "birden çok satıra bölünmüş",
  filler: "görsel, fotoğraf, resim gibi dolgu sözcüğü var",
  masked_name: "gizlenmiş bir ad yeri ([…]) var",
}

function reasonOf(task: AiTask, candidate: RefusedCandidate, problem: string, data: string) {
  if (problem === "length") {
    return lengthReason(task, candidate.text)
  }
  if (problem === "too_short") {
    return `${String(wordCount(candidate.text))} sözcük; en az ${String(MIN_PRODUCT_WORDS)} sözcük olmalı`
  }
  if (problem === "ungrounded") {
    // A text that reads as a person's data names nothing of itself back
    const quiet = candidate.problems.includes("personal_data")
    const named = (quiet ? [] : ungroundedWords(candidate.text, data))
      .slice(0, MAX_NAMED_WORDS)
      .map((word) => Array.from(word).slice(0, MAX_NAMED_WORD_LENGTH).join(""))
    return named.length > 0
      ? `veride olmayan sözcük var (${named.join(", ")}); yalnızca verideki sözcükleri kullan`
      : "veride olmayan sözcük var; yalnızca verideki sözcükleri kullan"
  }
  return REASONS[problem] ?? "kurallara uymuyor"
}

/** The gate's reasons for every refused candidate, as a paragraph of the system message. */
export function correctionNote(
  task: AiTask,
  refused: readonly RefusedCandidate[],
  data: string
): string {
  const several = refused.length > 1
  const items = refused.map((candidate, index) => {
    const reasons = [...new Set(candidate.problems)].map((problem) =>
      reasonOf(task, candidate, problem, data)
    )
    const label = several ? `${String(index + 1)}. aday: ` : ""
    return `- ${label}${reasons.join("; ")}`
  })
  return [
    "Düzeltme: önceki yanıtın denetimden geçmedi.",
    ...items,
    "Aynı görevi bu sorunları gidererek baştan yaz; aşağıdaki kurallar aynen geçerlidir.",
  ].join("\n")
}

/** The system message with the correction note just before its rules, which stay last. */
export function withCorrection(system: string, note: string): string {
  const at = system.lastIndexOf(`\n\n${RULES_HEADING}`)
  return at === -1 ? `${system}\n\n${note}` : `${system.slice(0, at)}\n\n${note}${system.slice(at)}`
}

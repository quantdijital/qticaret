import type { JsonLd } from "@qticaret/types"
import type { HomeSectionView } from "@qticaret/ui"

/**
 * The page's questions and answers as one `FAQPage` (adr/0049 Ek
 * 2026-11-03, docs/13 §3): every FAQ section's items together, a question
 * asked twice kept once. One block per page: search engines report a
 * second `FAQPage` on the same page as a duplicate. None without a FAQ.
 * `JsonLd` escapes the shop's words for the script element.
 */
export function faqJsonLd(sections: readonly HomeSectionView[]): JsonLd[] {
  const seen = new Set<string>()
  const questions = sections.flatMap((section) =>
    section.type === "faq"
      ? section.items.flatMap((item) => {
          const key = item.question.trim().toLocaleLowerCase("tr")
          if (seen.has(key)) {
            return []
          }
          seen.add(key)
          return [
            {
              "@type": "Question",
              name: item.question,
              acceptedAnswer: { "@type": "Answer", text: item.answer },
            },
          ]
        })
      : []
  )
  return questions.length > 0
    ? [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: questions }]
    : []
}

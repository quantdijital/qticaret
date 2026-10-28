import type { JsonLd } from "./jsonld"

/** One question's page as Google's QAPage reads it (F10.10). */
export interface QaFacts {
  question: { body: string; author: string; publishedAt: string; answerCount: number }
  answers: { id: string; body: string; author: string; publishedAt: string; shop: boolean }[]
  /** The shop's name, as the author of its own answers. */
  shopName: string
}

/** The question's "short form": its first sentence, or as much as fits a title. */
const shortForm = (body: string): string => {
  const sentence = /^[^?!.]{10,}[?!.]/.exec(body)?.[0] ?? body
  return sentence.length > 110 ? `${sentence.slice(0, 107).trimEnd()}…` : sentence
}

/**
 * The QAPage block of a question's own page (docs/13 §5, Google's QAPage
 * rules): only for one question with an answer, never for a product page
 * listing several. The shop's answer is the accepted one; customers' are
 * suggested. Each answer has its own link on the page.
 */
export function qaPageJsonLd(facts: QaFacts, url: string): JsonLd | null {
  if (facts.answers.length === 0) {
    return null
  }
  const answer = (row: QaFacts["answers"][number]): JsonLd => ({
    "@type": "Answer",
    text: row.body,
    datePublished: row.publishedAt,
    url: `${url}#cevap-${row.id}`,
    author: row.shop
      ? { "@type": "Organization", name: facts.shopName }
      : { "@type": "Person", name: row.author },
  })
  const accepted = facts.answers.find((row) => row.shop)
  const suggested = facts.answers.filter((row) => row !== accepted)
  return {
    "@context": "https://schema.org",
    "@type": "QAPage",
    mainEntity: {
      "@type": "Question",
      name: shortForm(facts.question.body),
      text: facts.question.body,
      answerCount: facts.question.answerCount,
      datePublished: facts.question.publishedAt,
      author: { "@type": "Person", name: facts.question.author },
      ...(accepted ? { acceptedAnswer: answer(accepted) } : {}),
      ...(suggested.length > 0 ? { suggestedAnswer: suggested.map(answer) } : {}),
    },
  }
}

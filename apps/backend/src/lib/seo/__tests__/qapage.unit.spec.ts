import { qaPageJsonLd } from "../qapage"
import type { QaFacts } from "../qapage"

const URL = "https://magaza.example.com/urun/sef-bicagi/sorular/pq_1"
const facts = (answers: QaFacts["answers"]): QaFacts => ({
  question: {
    body: "Bu bıçak bulaşık makinesinde yıkanır mı? Sapı ahşap gibi duruyor.",
    author: "Ayşe Y.",
    publishedAt: "2026-10-28T10:00:00.000Z",
    answerCount: answers.length,
  },
  answers,
  shopName: "Örnek Mağaza",
})

/** F10.10 (Google's QAPage rules): one question with an answer; the shop's is the accepted one. */
describe("qaPageJsonLd", () => {
  it("names the question by its first sentence, accepts the shop's answer and suggests the others", () => {
    const block = qaPageJsonLd(
      facts([
        {
          id: "pans_1",
          body: "Elde yıkayın.",
          author: "Destek",
          publishedAt: "2026-10-28T11:00:00.000Z",
          shop: true,
        },
        {
          id: "pans_2",
          body: "Ben elde yıkıyorum.",
          author: "Ali V.",
          publishedAt: "2026-10-28T12:00:00.000Z",
          shop: false,
        },
      ]),
      URL
    )
    const question = block?.["mainEntity"] as Record<string, unknown>

    expect(block?.["@type"]).toBe("QAPage")
    expect(question["name"]).toBe("Bu bıçak bulaşık makinesinde yıkanır mı?")
    expect(question["answerCount"]).toBe(2)
    expect(question["acceptedAnswer"]).toMatchObject({
      text: "Elde yıkayın.",
      url: `${URL}#cevap-pans_1`,
      author: { "@type": "Organization", name: "Örnek Mağaza" },
    })
    expect(question["suggestedAnswer"]).toEqual([
      expect.objectContaining({ author: { "@type": "Person", name: "Ali V." } }),
    ])
  })

  it("makes no block for a question without an answer", () => {
    expect(qaPageJsonLd(facts([]), URL)).toBeNull()
  })
})

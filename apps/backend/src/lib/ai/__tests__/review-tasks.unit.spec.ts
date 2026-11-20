import { PRODUCT_QA_MODULE } from "../../../modules/product-qa"
import { PRODUCT_REVIEWS_MODULE } from "../../../modules/product-reviews"
import { AI_REVIEWS, featureDefinition } from "../../../modules/platform-settings/features"
import { taskFlagOpen } from "../../../workflows/ai/connections"
import { entityFacts } from "../facts"
import { productReviewFacts, questionFacts, reviewFacts } from "../facts/reviews"
import type { FactsContainer } from "../facts/types"
import { suggestionProblems } from "../gate"
import { systemOf } from "../instructions"
import { NAME_MASK, maskNames } from "../mask-names"
import { buildPrompt } from "../prompt"
import {
  QUESTION_ANSWER_TASK,
  REVIEW_REPLY_TASK,
  REVIEW_SUMMARY_MAX_REVIEWS,
  REVIEW_SUMMARY_TASK,
  aiTasks,
  factLengthsOf,
  isTaskEntity,
} from "../registry/tasks"

/**
 * Aşama 9 (adr/0071 §6, §10): a product's reviews summed up, a reply and an
 * answer drafted. Customers' words go with their authors' names masked and
 * no name, contact, order or customer field; the shop's own flag, off by
 * default; `operations` among the roles of these tasks and no other.
 */

const EMAIL = "ayse.yilmaz@example.com"
const PHONE = "0532 123 45 67"

interface Listed {
  filters: Record<string, unknown>
  config: { select?: string[]; take?: number }
}

interface Row {
  id: string
  product_id?: string
  rating?: number
  title?: string | null
  body: string
  author_name: string
}

function containerWith(rows: Row[], count = rows.length) {
  const listed: Listed[] = []
  const record = (filters: Record<string, unknown>, config: Listed["config"]) => {
    listed.push({ filters, config })
  }
  const reviews = {
    listAndCountProductReviews: (filters: Record<string, unknown>, config: Listed["config"]) => {
      record(filters, config)
      return Promise.resolve([rows, count])
    },
    listProductReviews: (filters: Record<string, unknown>, config: Listed["config"]) => {
      record(filters, config)
      return Promise.resolve(rows)
    },
  }
  const qa = {
    listProductQuestions: (filters: Record<string, unknown>, config: Listed["config"]) => {
      record(filters, config)
      return Promise.resolve(rows)
    },
  }
  const query = {
    graph: () =>
      Promise.resolve({
        data: [{ title: "Keten Gömlek", description: "Yazlık keten gömlek.", categories: [] }],
      }),
  }
  const container: FactsContainer = {
    resolve: (key: string) =>
      key === PRODUCT_REVIEWS_MODULE ? reviews : key === PRODUCT_QA_MODULE ? qa : query,
  }
  return { container, listed }
}

const sent = (task: typeof REVIEW_REPLY_TASK, fields: Record<string, unknown>) =>
  buildPrompt({
    instruction: "x",
    fields: fields as never,
    maxLengths: factLengthsOf(task, {}),
  }).data

// No reader may even ask for these: who wrote it, and how to reach them
const FORBIDDEN_COLUMNS = /customer|order|email|phone|address|source_ref|moderated|replied/i

describe("masking an author's name (Aşama 9)", () => {
  it("masks each part of the name as a whole word, in the ways Turkish writes it", () => {
    expect(maskNames("Ben Ayşe, AYŞE'nin gömleği; ayşe dedi.", ["Ayşe K."])).toBe(
      `Ben ${NAME_MASK}, ${NAME_MASK}'nin gömleği; ${NAME_MASK} dedi.`
    )
    expect(maskNames("İsmail ve ismail", ["İSMAİL"])).toBe(`${NAME_MASK} ve ${NAME_MASK}`)
  })

  it("leaves an initial, a longer word and other text alone", () => {
    expect(maskNames("K harfi, Ayşegül ve kumaş", ["Ayşe K."])).toBe("K harfi, Ayşegül ve kumaş")
    expect(maskNames("Gömlek güzel", [])).toBe("Gömlek güzel")
  })

  it("takes a name with pattern characters as text", () => {
    expect(maskNames("Merhaba Ali, .* (x) kaldı", ["Ali.* (x)"])).toBe(
      `Merhaba ${NAME_MASK}, .* (x) kaldı`
    )
  })
})

describe("what leaves the shop of reviews and questions (adr/0071 §10)", () => {
  const review = (n: number, body: string): Row => ({
    id: `prev_${String(n)}`,
    product_id: "prod_1",
    rating: 4,
    title: n === 1 ? "Güzel" : null,
    body,
    author_name: n === 1 ? "Ayşe Y." : "Mehmet K.",
  })

  it("sums up approved reviews only: ratings and words, every author's name masked", async () => {
    const { container, listed } = containerWith(
      [
        review(1, `Ayşe olarak çok memnunum, ${EMAIL} ${PHONE}`),
        review(2, "Mehmet: dikişi zayıf, Ayşe haklı"),
        review(3, "İyi"),
      ],
      42
    )

    const facts = await productReviewFacts(container, "prod_1")
    const data = sent(REVIEW_SUMMARY_TASK, facts)

    expect(listed[0]?.filters).toEqual({ product_id: "prod_1", status: "approved" })
    expect(listed[0]?.config.take).toBe(REVIEW_SUMMARY_MAX_REVIEWS)
    for (const column of listed[0]?.config.select ?? []) {
      expect(column).not.toMatch(FORBIDDEN_COLUMNS)
    }
    expect(facts["review_count"]).toBe("42")
    for (const leak of ["Ayşe", "Mehmet", EMAIL, PHONE, "Y.", "K."]) {
      expect(data).not.toContain(leak)
    }
    expect(data).toContain("4/5")
    expect(data).toContain("dikişi zayıf")
  })

  it("turns a product with too few approved reviews away before any call", async () => {
    const { container } = containerWith([review(1, "İyi"), review(2, "Fena değil")])
    await expect(productReviewFacts(container, "prod_1")).rejects.toMatchObject({
      safeMessage: "ai.not_enough_reviews",
    })
  })

  it("drafts a reply from one approved review: rating and words, no name", async () => {
    const { container, listed } = containerWith([review(1, `Teşekkürler, ben Ayşe. ${PHONE}`)])

    const facts = await reviewFacts(container, "prev_1")
    const data = sent(REVIEW_REPLY_TASK, facts)

    expect(listed[0]?.filters).toEqual({ id: "prev_1", status: "approved" })
    for (const column of listed[0]?.config.select ?? []) {
      expect(column).not.toMatch(FORBIDDEN_COLUMNS)
    }
    expect(Object.keys(facts).sort()).toEqual(["product", "rating", "review"])
    expect(data).not.toContain("Ayşe")
    expect(data).not.toContain(PHONE)
    expect(data).toContain("Keten Gömlek")
  })

  it("finds no review that is not approved", async () => {
    const { container } = containerWith([])
    await expect(reviewFacts(container, "prev_1")).rejects.toMatchObject({
      safeMessage: "ai.unknown_entity",
    })
  })

  it("drafts an answer from a question and the product's public fields", async () => {
    const { container, listed } = containerWith([
      {
        id: "pq_1",
        product_id: "prod_1",
        body: `Merhaba ben Zeynep, ${EMAIL}`,
        author_name: "Zeynep A.",
      },
    ])

    const facts = await questionFacts(container, "pq_1")
    const data = sent(QUESTION_ANSWER_TASK, facts)

    expect(listed[0]?.filters).toEqual({ id: "pq_1", status: ["pending", "approved"] })
    expect(data).not.toContain("Zeynep")
    expect(data).not.toContain(EMAIL)
    expect(data).toContain("Yazlık keten gömlek")
  })

  it("reads a product's reviews only for the product, never another record", async () => {
    const { container } = containerWith([])
    await expect(
      entityFacts(container, "review", "prev_1", "product_reviews")
    ).rejects.toMatchObject({ safeMessage: "ai.unknown_entity" })
  })
})

describe("the review tasks in the registry (Aşama 9)", () => {
  const ours = [REVIEW_SUMMARY_TASK, REVIEW_REPLY_TASK, QUESTION_ANSWER_TASK]

  it("wait for the shop's own flag, off by default and the shop's to turn on", () => {
    expect(featureDefinition(AI_REVIEWS)).toMatchObject({ default: false, owner: "tenant" })
    for (const task of ours) {
      expect(task.flag).toBe(AI_REVIEWS)
      expect(task.keepData).toBe(false)
      expect(task.gate).toBe("plain_text")
      expect(systemOf(task)).toEqual(expect.any(String))
    }
  })

  it("open to operations these tasks and no other", () => {
    const withOperations = aiTasks("test")
      .filter((task) => task.roles.includes("operations"))
      .map((task) => task.id)
    expect(withOperations.sort()).toEqual(["question_answer", "review_reply", "review_summary"])
  })

  it("are asked for their own records only; the page tasks never for a review", () => {
    expect(isTaskEntity(REVIEW_SUMMARY_TASK, "product")).toBe(true)
    expect(isTaskEntity(REVIEW_REPLY_TASK, "review")).toBe(true)
    expect(isTaskEntity(REVIEW_REPLY_TASK, "product")).toBe(false)
    expect(isTaskEntity(QUESTION_ANSWER_TASK, "question")).toBe(true)
    for (const task of aiTasks("test").filter((each) => !ours.includes(each))) {
      expect(isTaskEntity(task, "review")).toBe(false)
      expect(isTaskEntity(task, "question")).toBe(false)
    }
  })

  it("refuse a draft with a link, markup, contact details or past the reply's length", () => {
    expect(
      suggestionProblems(REVIEW_REPLY_TASK, "Teşekkür ederiz, iyi günlerde kullanın.")
    ).toEqual([])
    expect(suggestionProblems(REVIEW_REPLY_TASK, "Bize www.ornek.com adresinden yazın.")).toContain(
      "link"
    )
    expect(suggestionProblems(REVIEW_REPLY_TASK, `Bize ${EMAIL} adresinden yazın.`)).toContain(
      "personal_data"
    )
    expect(suggestionProblems(REVIEW_REPLY_TASK, "Teşekkürler <img src=x onerror=1")).toContain(
      "markup"
    )
    expect(suggestionProblems(REVIEW_REPLY_TASK, "a ".repeat(600))).toEqual(["length"])
  })
})

describe("a task's own flag (Aşama 9)", () => {
  const flags = (on: boolean) => {
    const asked: string[] = []
    const container = {
      resolve: () => ({
        isFeatureEnabled: (key: string) => {
          asked.push(key)
          return Promise.resolve(on)
        },
      }),
    } as unknown as FactsContainer
    return { container, asked }
  }

  it("holds a review task while the shop's flag is off, and nothing else", async () => {
    const off = flags(false)
    expect(await taskFlagOpen(off.container, REVIEW_REPLY_TASK)).toBe(false)
    expect(off.asked).toEqual([AI_REVIEWS])
    expect(await taskFlagOpen(flags(true).container, REVIEW_REPLY_TASK)).toBe(true)
    const none = flags(false)
    expect(await taskFlagOpen(none.container, {})).toBe(true)
    expect(none.asked).toEqual([])
  })
})

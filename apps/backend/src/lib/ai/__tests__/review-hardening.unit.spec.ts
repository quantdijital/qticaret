import { MedusaError } from "@medusajs/framework/utils"
import { PRODUCT_REVIEWS_MODULE } from "../../../modules/product-reviews"
import { STAFF_ROLES_MODULE } from "../../../modules/staff-roles"
import { authorizeDecision } from "../../../workflows/ai/decide-suggestion"
import { productReviewFacts } from "../facts/reviews"
import type { FactsContainer } from "../facts/types"
import { suggestionProblems } from "../gate"
import { NAME_MASK, maskNames } from "../mask-names"
import {
  QUESTION_ANSWER_TASK,
  REVIEW_REPLY_TASK,
  REVIEW_SUMMARY_TASK,
  SEO_TITLE_TASK,
} from "../registry/tasks"

/**
 * The security review of Aşama 9 (adr/0071 §6, §10): a decision waits for
 * the task's flag as the request did, a review's own author is masked even
 * past the cap on names, and a draft that echoes a mask is not offered.
 */

const letter = (n: number) => String.fromCharCode(97 + n)

// Thirty authors of three parts each: more name forms than `nameVariants` keeps
const AUTHORS = Array.from({ length: 30 }, (_, i) => {
  const tag = `${letter(Math.floor(i / 26))}${letter(i % 26)}`
  return `Ad${tag} Orta${tag} Soy${tag}`
})

function reviewsContainer(bodies: string[]): FactsContainer {
  const rows = bodies.map((body, i) => ({
    id: `prev_${String(i)}`,
    rating: 5,
    title: null,
    body,
    author_name: AUTHORS[i] ?? "",
  }))
  const reviews = { listAndCountProductReviews: () => Promise.resolve([rows, rows.length]) }
  const query = {
    graph: () => Promise.resolve({ data: [{ title: "Keten Gömlek", categories: [] }] }),
  }
  return { resolve: (key: string) => (key === PRODUCT_REVIEWS_MODULE ? reviews : query) }
}

describe("a summary's reviews, each with its own author masked first", () => {
  const bodies = AUTHORS.map((name) => `Ben ${name}, ${name.toLocaleUpperCase("tr")} memnunum`)

  it("needs it: the list of every author is cut before the last ones", () => {
    const last = bodies[29] ?? ""
    expect(maskNames(last, AUTHORS)).toContain("Adbd")
  })

  it("masks every part of each review's own author, the thirtieth too", async () => {
    const facts = await productReviewFacts(reviewsContainer(bodies), "prod_1")
    const reviews = facts["reviews"] as unknown as { label: string; value: string }[]
    expect(reviews).toHaveLength(30)
    reviews.forEach((review, i) => {
      for (const part of (AUTHORS[i] ?? "").split(" ")) {
        expect(review.value.toLocaleLowerCase("tr")).not.toContain(part.toLocaleLowerCase("tr"))
      }
      expect(review.value).toBe(
        `Ben ${NAME_MASK} ${NAME_MASK} ${NAME_MASK}, ${NAME_MASK} ${NAME_MASK} ${NAME_MASK} memnunum`
      )
    })
  })

  it("still masks another author named in a review", async () => {
    const facts = await productReviewFacts(
      reviewsContainer(["İyi", "Adaa haklı", "Güzel"]),
      "prod_1"
    )
    const reviews = facts["reviews"] as unknown as { value: string }[]
    expect(reviews[1]?.value).toBe(`${NAME_MASK} haklı`)
  })
})

describe("the plain text gate and a mask left in a draft", () => {
  it.each([`Teşekkürler ${NAME_MASK} Hanım`, "Teşekkürler [...] Hanım", "Sevgili [ … ], sağ olun"])(
    "refuses %s",
    (text) => {
      for (const task of [REVIEW_REPLY_TASK, QUESTION_ANSWER_TASK, REVIEW_SUMMARY_TASK]) {
        expect(suggestionProblems(task, text)).toContain("masked_name")
      }
    }
  )

  it("lets a draft with no mask through, and an ellipsis in words", () => {
    expect(
      suggestionProblems(REVIEW_REPLY_TASK, "Yorumunuz için teşekkür ederiz… Sevgiler.")
    ).toEqual([])
  })

  it("leaves the SEO gates to their own rules", () => {
    expect(suggestionProblems(SEO_TITLE_TASK, `Keten Gömlek ${NAME_MASK}`)).not.toContain(
      "masked_name"
    )
  })
})

describe("deciding a review task's suggestion (D1)", () => {
  const container = (role: string | null, flagOn: boolean) => ({
    resolve: (key: string) =>
      key === STAFF_ROLES_MODULE
        ? { roleOf: () => Promise.resolve(role) }
        : { isFeatureEnabled: () => Promise.resolve(flagOn) },
  })

  it("is refused while the shop's flag is off, to the owner too", async () => {
    await expect(
      authorizeDecision(container("owner", false) as never, "review_reply", "user_1")
    ).rejects.toMatchObject({ type: MedusaError.Types.FORBIDDEN, message: "ai.reviews_off" })
  })

  it("passes a role the task allows while the flag is on", async () => {
    await expect(
      authorizeDecision(container("operations", true) as never, "question_answer", "user_1")
    ).resolves.toBeUndefined()
  })

  it("still asks for the task's role, and a task with no flag does not read one", async () => {
    await expect(
      authorizeDecision(container("operations", false) as never, "seo_title", "user_1")
    ).rejects.toMatchObject({ message: "staff.forbidden" })
    await expect(
      authorizeDecision(container("admin", false) as never, "seo_title", "user_1")
    ).resolves.toBeUndefined()
  })
})

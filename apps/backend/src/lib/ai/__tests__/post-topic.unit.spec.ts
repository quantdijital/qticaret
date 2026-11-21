import {
  PHRASE_BONUS,
  TOPIC_WEIGHTS,
  foldText,
  ranked,
  scoreOf,
  stemsOf,
  topicOf,
} from "../facts/post-topic"

/**
 * A post's link candidates ranked by its subject (adr/0074 Ek 7, G5
 * takip): Turkish lower case, apostrophe suffixes and marks folded, words
 * that say nothing left out; the focus keyword weighs most, then the
 * title, then the summary; a tie keeps the list's order.
 */

describe("a post's subject stems", () => {
  it("reads Turkish lower case, drops an apostrophe's suffix and folds the marks", () => {
    expect(foldText("İNCE Işık")).toBe("ince isik")
    expect(foldText("Termos'un ÇELİK kapağı")).toBe("termos celik kapagi")
    expect(foldText("Kâse ve şişe")).toBe("kase ve sise")
    // A quote is no suffix: the quoted word stays
    expect(foldText("'Klasik' termos")).toBe("'klasik' termos")
  })

  it("leaves out short words and words that say nothing of a subject", () => {
    expect([...stemsOf("Termosların temizliği için bir rehber, ve 750 ml")]).toEqual([
      "termo",
      "temiz",
      "750",
    ])
    expect([...stemsOf("Nasıl, neden ve hangi yolları?")]).toEqual([])
  })

  it("meets a word written without Turkish letters and a softened ending", () => {
    expect(stemsOf("bicak")).toEqual(stemsOf("Bıçak"))
    expect(stemsOf("Bıçağı")).toEqual(stemsOf("bıçak"))
    expect(stemsOf("çeliği")).toEqual(stemsOf("Çelik"))
    expect(stemsOf("kitabı")).toEqual(stemsOf("kitap"))
  })

  it("weighs the focus keyword over the title, the title over the summary", () => {
    const topic = topicOf({
      title: "Termos nasıl temizlenir?",
      focusKeyword: "termos temizliği",
      summary: "Termosu karbonatla temizlemek",
    })
    expect(topic.weights.get("termo")).toBe(TOPIC_WEIGHTS.focusKeyword)
    expect(topic.weights.get("karbo")).toBe(TOPIC_WEIGHTS.summary)
    expect(topic.phrase).toBe("termo temiz")
    expect(topicOf({ focusKeyword: "termos" }).phrase).toBeNull()
  })
})

describe("ranking candidates by the post's subject", () => {
  const topic = topicOf({
    title: "Keten gömlek nasıl yıkanır?",
    focusKeyword: "keten gömlek",
    summary: "Ütü ve kurutma önerileri",
  })

  it("adds the stems' weights and the phrase's bonus", () => {
    expect(scoreOf("Keten Gömlek Beyaz", topic)).toBe(TOPIC_WEIGHTS.focusKeyword * 2 + PHRASE_BONUS)
    expect(scoreOf("Gömlek Keten Karışımı", topic)).toBe(TOPIC_WEIGHTS.focusKeyword * 2)
    expect(scoreOf("Buharlı Ütü", topic)).toBe(TOPIC_WEIGHTS.summary)
    expect(scoreOf("Kahve Fincanı", topic)).toBe(0)
  })

  it("puts the keyword's candidates first and keeps the list's order in a tie", () => {
    const names = ["Kahve Fincanı", "Buharlı Ütü", "Çay Bardağı", "Keten Gömlek", "Keten Örtü"]
    expect(
      ranked(
        names.map((name) => ({ name })),
        topic
      ).map((each) => each.name)
    ).toEqual(["Keten Gömlek", "Keten Örtü", "Buharlı Ütü", "Kahve Fincanı", "Çay Bardağı"])
  })
})

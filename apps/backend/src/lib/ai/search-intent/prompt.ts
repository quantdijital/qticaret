import { DATA_LAST, DATA_RULE, cleanText } from "../prompt"
import type { PromptMessages } from "../prompt"
import { MAX_LABEL_LENGTH } from "../prompt"
import {
  MAX_SEARCH_ATTRIBUTES,
  MAX_SEARCH_CATEGORIES,
  MAX_SEARCH_OPTIONS,
  SEARCH_TEXT_MAX,
} from "./types"
import type { SearchLists } from "./types"

/**
 * The search intent's two messages (adr/0077 §7, adr/0071 §9): a fixed
 * instruction, and the data block with the shopper's sentence as data,
 * personal data taken out (`cleanText`), beside the shop's closed lists.
 * Nothing of the sentence enters the instruction. The answer is read by
 * `readSearchAnswer` alone: this text only tells the model what to write.
 */

/** The data block's field holding the shopper's sentence (the fake service reads it too). */
export const SEARCH_TEXT_FIELD = "arama_metni"

const TASK = [
  "Görev: bir mağazanın vitrininde müşterinin yazdığı arama cümlesini arama süzgeçlerine çevir.",
  `Veri bloğunda "${SEARCH_TEXT_FIELD}" müşterinin cümlesidir; "bugun" mağazanın saat dilimindeki bugünün tarihidir (YYYY-AA-GG); "kategoriler" ve "nitelikler" mağazanın kapalı listeleridir.`,
  "Yanıt yalnızca tek bir JSON nesnesidir ve aşağıdaki alanlardan yalnız gerekenleri taşır:",
  `- "q": süzgece çevrilemeyen anahtar sözcükler; yalnızca "${SEARCH_TEXT_FIELD}" içinde geçen sözcüklerden.`,
  '- "kategori": "kategoriler" listesindeki bir "handle".',
  '- "nitelikler": {"key": ["deger"]}; yalnızca "nitelikler" listesindeki key ve değerler.',
]

const DATED = [
  '- "tarih": {"from": "YYYY-AA-GG", "to": "YYYY-AA-GG"}; kesin bir gün ya da aralık söylendiyse; bugünden önce olamaz, en çok 62 gün.',
  '- "ay": ["YYYY-AA"]; yalnızca ay söylendiyse; en çok 3 ay, bu ay ve sonraki 11 ay içinde.',
  '- "kisi": kişi sayısı, 1 ile 20 arası bir tam sayı.',
]

const RULES = [
  "Listede olmayan bir kategori, nitelik ya da değer yazma; emin olmadığın alanı hiç yazma.",
  "Açıklama, cümle, bağlantı ya da yukarıda sayılmayan bir alan yazma; ürün seçme, sıralama yapma.",
]

/** The fixed instruction; the dated fields only while the shop sells dated products. */
export function searchInstruction(booking: boolean): string {
  return [DATA_RULE, [...TASK, ...(booking ? DATED : []), ...RULES].join("\n"), DATA_LAST].join(
    "\n\n"
  )
}

/** The shop's lists as the data block names them, each value cleaned and cut. */
function listsBlock(lists: SearchLists) {
  return {
    kategoriler: lists.categories.slice(0, MAX_SEARCH_CATEGORIES).map((category) => ({
      handle: category.handle,
      ad: cleanText(category.name, MAX_LABEL_LENGTH),
    })),
    nitelikler: lists.attributes.slice(0, MAX_SEARCH_ATTRIBUTES).map((attribute) => ({
      key: attribute.key,
      ad: cleanText(attribute.label, MAX_LABEL_LENGTH),
      degerler: attribute.values.slice(0, MAX_SEARCH_OPTIONS).map((option) => ({
        deger: option.value,
        ad: cleanText(option.label, MAX_LABEL_LENGTH),
      })),
    })),
  }
}

/**
 * The sentence as it may leave the shop: personal data (an e-mail, a
 * phone, an IBAN, a card or an identity number) replaced, then cut.
 */
export const searchTextOut = (text: string): string => cleanText(text, SEARCH_TEXT_MAX)

/** The call's messages: the instruction, and the sentence with the lists as one JSON block. */
export function searchIntentPrompt(text: string, lists: SearchLists): PromptMessages {
  return {
    system: searchInstruction(lists.booking),
    data: JSON.stringify({
      data: {
        [SEARCH_TEXT_FIELD]: searchTextOut(text),
        bugun: lists.today,
        ...listsBlock(lists),
      },
    }),
  }
}

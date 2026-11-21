import { PUBLISHED_QUESTIONS_FIELD } from "../product-faq"
import { SUMMARY_FIELD } from "../facts/product-attributes"
import {
  FAQ_ANSWER_MAX_LENGTH,
  FAQ_MAX_ITEMS,
  FAQ_MIN_ITEMS,
  FAQ_QUESTION_MAX_LENGTH,
} from "../registry/product-page-tasks"
import { RULES_WIN, lines } from "./types"
import type { TaskInstruction } from "./types"

/**
 * A product's FAQ (adr/0074 §5 madde 4): questions a shopper asks, each
 * answered from the product's own facts; one JSON object, its texts prose
 * in the shop's voice (the guidance and the owner's craft apply).
 */

const FAQ_FIELDS = `Veri: "name" ürünün adı, "subtitle" alt başlığı, "${SUMMARY_FIELD}" kısa açıklaması, "description" açıklaması, "attributes" nitelikleri, "options" satılan seçenekleri (renk, beden gibi), "category" kategorisi, "${PUBLISHED_QUESTIONS_FIELD}" ürün sayfasında zaten yayımlanmış sorulardır.`

export const PRODUCT_FAQ_INSTRUCTIONS: Readonly<Record<string, TaskInstruction>> = {
  product_faq: {
    craft: lines(
      "Rol: ürünü iyi bilen, açık ve kısa konuşan bir mağaza çalışanısın.",
      "Amaç: ürün sayfasındaki soru-cevap bölümü için alışverişçinin satın almadan önce gerçekten merak ettiği soruları ve yanıtlarını yazmak; yanıt kararı kolaylaştırır.",
      FAQ_FIELDS,
      "Yöntem: önce verilerde açıkça yazan bilgileri bul (ölçü, malzeme, kullanım, bakım, uyumluluk, içerik, seçenekler); her soruyu bu bilgilerden birinin yanıtladığı bir merak olarak kur. Soruyu alışverişçinin ağzından, kısa ve doğal yaz; yanıtın ilk cümlesi doğrudan yanıt olsun (evet, hayır, ölçü, nasıl), sonra verideki dayanağı kısaca söyle.",
      "Yanıtı verilerde olmayan soruyu hiç yazma: az ama doğru soru, çok ama uydurma sorudan iyidir. Yayımlanmış soruları ya da aynı anlama gelenlerini yeniden yazma.",
      "İyi örnek (uydurma bir ürün): Soru: Termos çantada yatay taşınabilir mi? Yanıt: Evet, sızdırmaz kapağı sayesinde termos çantada yatay taşınabilir.",
      "Kötü örnek: Soru: Kargo ne zaman gelir? (veride kargo yok) ya da Soru: Ürün kaliteli mi? Yanıt: Çok kalitelidir. (bilgi yok)"
    ),
    rules: lines(
      "Yanıtın yalnızca tek bir JSON nesnesi olsun, başka metin yazma.",
      `Nesnenin tek alanı "items"dır: ${String(FAQ_MIN_ITEMS)} ile ${String(FAQ_MAX_ITEMS)} arası öğenin dizisi; her öğe yalnızca "q" (soru) ve "a" (yanıt) alanlarını taşır. Veride yeterli bilgi yoksa daha az öğe yaz.`,
      `Soru tek satır, en çok ${String(FAQ_QUESTION_MAX_LENGTH)} karakter ve soru işaretiyle biter. Yanıt tek paragraf, en çok ${String(FAQ_ANSWER_MAX_LENGTH)} karakter.`,
      "Soruyu da yanıtı da yalnızca verideki ürün bilgilerine dayandır. Fiyat, indirim, stok, kargo, teslimat, iade, garanti, ödeme ya da veride olmayan bir söz, ölçü, malzeme ve üstünlük iddiası yazma.",
      `Verideki "${PUBLISHED_QUESTIONS_FIELD}" listesindeki soruları ya da aynı anlama gelenlerini yazma.`,
      "Kişi adı, e-posta, telefon ya da adres yazma; verideki […] işaretini yazma.",
      "Tırnak içinde vurgu, emoji, bağlantı, HTML ve tümü büyük harf sözcük kullanma. Türkçe yaz.",
      RULES_WIN
    ),
    options: {},
  },
}

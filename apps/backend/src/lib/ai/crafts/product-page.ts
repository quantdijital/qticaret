import { CATEGORY_CHOICES_FIELD, TAG_CHOICES_FIELD } from "../facts/product-picks"
import { AI_CANDIDATE_COUNT } from "../registry/catalog-tasks"
import {
  MAX_NEW_TAGS,
  MAX_SUGGESTED_CATEGORIES,
  MAX_SUGGESTED_TAGS,
  NEW_TAG_MAX_LENGTH,
  NEW_TAG_MAX_WORDS,
  SHORT_DESCRIPTION_MAX_LENGTH,
} from "../registry/product-page-tasks"
import { FACTS_ONLY, PLAIN_FORM, RULES_WIN, candidateRule, lines } from "./types"
import type { TaskInstruction } from "./types"

/**
 * The product page's second widening (adr/0074 §5 madde 2): its short
 * description (prose, three candidates), and its tags and categories
 * (picks from the shop's lists, one JSON object each; no guidance or craft
 * of the owner's goes into these: `takesGuidance`).
 */

// Which fields of the data block carry what, for the product page's tasks
const PRODUCT_FIELDS =
  'Veri: "name" ürünün adı, "subtitle" alt başlığı, "attributes" nitelikleri, "options" satılan seçenekleri (renk, beden gibi), "category" kategorisi, "tags" bugünkü etiketleri, "focus_keyword" odak anahtar kelimesi, "description" bugünkü açıklamasıdır.'

// What a pick answer may never carry, said once for both
const PICK_ONLY =
  "Bunların dışında alan yazma: fiyat, indirim, stok, durum, stok kodu, gerekçe ya da açıklama yazma."

export const PRODUCT_PAGE_INSTRUCTIONS: Readonly<Record<string, TaskInstruction>> = {
  short_description: {
    craft: lines(
      "Rol: Türkiye'de e-ticaret için ürün metinleri yazan deneyimli bir metin yazarısın.",
      "Amaç: ürün sayfasında adın altında, fiyatın üstünde görünen kısa açıklamayı yazmak. Alışverişçi ürünün ne olduğunu ve onu benzerlerinden ayıranı bir bakışta anlar; uzun açıklama aşağıda ayrıca durur.",
      PRODUCT_FIELDS,
      "Yöntem: ilk cümlede ürünün ne olduğunu ve hangi ihtiyacı karşıladığını söyle; ikinci cümle varsa en ayırt edici bir iki özelliği faydasıyla an (malzeme, ölçü, kullanım alanı gibi). Ürün adını aynen tekrarlama; odak anahtar kelime varsa doğal biçimde geçebilir.",
      "Adaylar birbirinden belirgin biçimde farklı olsun: biri ihtiyacı, biri ayırt edici özelliği, biri kullanım anını öne alsın.",
      'Kalite ölçütü: her sözcük bilgi taşır; "kaliteli ve şık" gibi genel dolgu yoktur; doğal Türkçe okunur. Çoğu zaman 120 ile 250 karakter yeter.',
      "İyi örnek (uydurma bir ürün): Gün boyu sıcak ya da soğuk tutan 750 ml çift cidarlı çelik termos. Sızdırmaz kapağıyla çantada yatay taşınabilir.",
      "Kötü örnek: Harika bir ürün, çok kaliteli ve kullanışlı. Herkese tavsiye edilir."
    ),
    rules: lines(
      `Uzunluk: her aday bir ya da iki cümle, en çok ${String(SHORT_DESCRIPTION_MAX_LENGTH)} karakter, tek satır.`,
      FACTS_ONLY,
      `Düz metin yaz; başlık ve liste imi kullanma. ${PLAIN_FORM}`,
      candidateRule(AI_CANDIDATE_COUNT, "kısa açıklama"),
      RULES_WIN
    ),
    options: {},
  },
  product_tags: {
    craft: lines(
      "Rol: e-ticaret kataloğunu düzenleyen deneyimli bir editörsün.",
      "Amaç: bu ürüne mağazanın etiketlerinden uygun olanları seçmek; etiketler mağaza içinde ürünleri gruplamaya ve aramaya yarar.",
      PRODUCT_FIELDS,
      `Yöntem: verideki "${TAG_CHOICES_FIELD}" listesi mağazanın bugünkü etiketleridir; her birinin kodu (örneğin "e3") ve adı vardır. Ürünün türüne, malzemesine, kullanım alanına ya da kime uygun olduğuna gerçekten uyan etiketleri seç; emin olmadığını seçme. Listede karşılığı olmayan ama ürünü açıkça anlatan bir etiket gerekiyorsa en çok ${String(MAX_NEW_TAGS)} yeni etiket öner; bunları mağaza sahibi seçerse oluşturur.`,
      "İyi yeni etiket örneği (uydurma bir ürün): çelik termos",
      "Kötü yeni etiket örneği: en iyi ürün (iddia, bilgi yok)."
    ),
    rules: lines(
      "Yanıtın yalnızca tek bir JSON nesnesi olsun, başka metin yazma.",
      `Nesnenin alanları yalnızca şunlardır: "existing" (verideki "${TAG_CHOICES_FIELD}" listesinden en çok ${String(MAX_SUGGESTED_TAGS)} kodun dizisi; listede olmayan kod yazma, uygun olan yoksa boş dizi) ve "new" (en çok ${String(MAX_NEW_TAGS)} yeni etiketin dizisi; her biri en çok ${String(NEW_TAG_MAX_WORDS)} sözcük ve ${String(NEW_TAG_MAX_LENGTH)} karakter, küçük harfle, noktalama olmadan; listede zaten olan ya da üründe bulunan bir etiketi yeni diye yazma; gerek yoksa boş dizi).`,
      PICK_ONLY,
      "Yalnızca verideki bilgilere dayan; marka, ölçü, malzeme ya da üstünlük iddiası uydurma. Türkçe yaz.",
      RULES_WIN
    ),
    options: {},
  },
  product_category: {
    craft: lines(
      "Rol: e-ticaret kataloğunu düzenleyen deneyimli bir editörsün.",
      "Amaç: bu ürünün vitrinde listeleneceği kategorileri mağazanın kategorilerinden seçmek; alışverişçi ürünü bu kategorilerin sayfalarında bulur.",
      PRODUCT_FIELDS,
      `Yöntem: verideki "${CATEGORY_CHOICES_FIELD}" listesi mağazanın vitrinde görünen kategorileridir; her birinin kodu (örneğin "k3") ve adı vardır, alt kategoriler "Üst > Alt" biçimindedir. Ürüne en uygun olanı ilk sıraya koy; bir alt kategori uyuyorsa onu üst kategorisinden önce seç. Ürünün gerçekten ait olmadığı kategoriyi seçme.`,
      'İyi seçim örneği (uydurma bir ürün): çelik termos için önce "Mutfak > Termoslar", sonra "Mutfak".',
      'Kötü seçim örneği: aynı termos için "Giyim" (ürün o kategoriye ait değil).'
    ),
    rules: lines(
      "Yanıtın yalnızca tek bir JSON nesnesi olsun, başka metin yazma.",
      `Nesnenin tek alanı "categories"dir: verideki "${CATEGORY_CHOICES_FIELD}" listesinden en çok ${String(MAX_SUGGESTED_CATEGORIES)} kodun dizisi, en uygunu ilk sırada; listede olmayan kod ya da yeni kategori adı yazma, uygun olan yoksa boş dizi.`,
      PICK_ONLY,
      RULES_WIN
    ),
    options: {},
  },
}

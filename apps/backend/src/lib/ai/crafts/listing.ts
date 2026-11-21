import { LISTING_DESCRIPTION_TASK_IDS, LISTING_WORDS } from "../registry/listing-tasks"
import type { ListingKind } from "../registry/listing-tasks"
import { FACTS_ONLY, PLAIN_FORM, RULES_WIN, lines } from "./types"
import type { TaskInstruction } from "./types"

/**
 * A listing page's own text (adr/0074 §5 madde 1): a category's, a
 * collection's and a brand's description, shown under the products
 * (adr/0075). One craft in three readings: what the page gathers and what
 * its data holds differ per kind; the method, the quality bar and the
 * rules are the same. Examples are made-up pages, free of any trade.
 */

const { min, short, usual, detailed } = LISTING_WORDS

interface KindText {
  /** What the page is, said in the aim. */
  page: string
  /** Who reads it and what they want. */
  reader: string
  /** Which fields of the data block carry what. */
  data: string
  /** The method's middle: what this kind of page tells. */
  middle: string
  good: string
  bad: string
}

const KINDS: Readonly<Record<ListingKind, KindText>> = {
  category: {
    page: "bir kategori sayfasının",
    reader:
      'Okur: bu ürün türüne göz atan, seçenekleri karşılaştıran ve "bana hangisi uygun" sorusuna yanıt arayan bir alışverişçi.',
    data: 'Veri: "name" kategorinin adı, "parent" üst kategorisi, "subcategories" alt kategorileri, "products" içindeki ürünlerden örnek adlar, "brands" en sık markalar, "product_count" yaklaşık ürün sayısı, "focus_keyword" odak anahtar kelime, "current_seo_title" ve "current_seo_description" sayfanın bugünkü arama sonucu metinleri, "description" bugünkü açıklamasıdır.',
    middle:
      "Sonraki paragrafta sayfada bulunan çeşitleri anlat: alt kategorilerden, ürün örneklerinden ve markalardan birkaçını doğal cümleler içinde an. Ardından seçerken neye bakılacağını söyle: verideki çeşitlerin birbirinden nasıl ayrıldığını (tür, kullanım alanı, malzeme, ölçü gibi, veride geçiyorsa) okura yol gösteren bir dille anlat.",
    good: "İyi örnek (uydurma bir kategori, kısaltılmış): Termos ve mataralar kategorisinde gün boyu yanınızda taşıyabileceğiniz içecek kapları bir arada. Çelik termoslardan katlanır mataralara kadar farklı ihtiyaçlara uygun modeller bulabilirsiniz.",
    bad: "Kötü örnek: Bu kategoride en kaliteli ürünler en uygun fiyatlarla sizi bekliyor. Hemen alışverişe başlayın!",
  },
  collection: {
    page: "bir koleksiyon sayfasının",
    reader:
      "Okur: mağazanın bir tema, mevsim ya da kullanım etrafında bir araya getirdiği seçkiye göz atan ve bu seçkinin kendisine uygun olup olmadığını anlamak isteyen bir alışverişçi.",
    data: 'Veri: "name" koleksiyonun adı, "products" içindeki ürünlerden örnek adlar, "brands" en sık markalar, "product_count" yaklaşık ürün sayısı, "focus_keyword" odak anahtar kelime, "current_seo_title" ve "current_seo_description" sayfanın bugünkü arama sonucu metinleri, "description" bugünkü açıklamasıdır.',
    middle:
      "Sonraki paragrafta seçkide neler bulunduğunu anlat: ürün örneklerinden ve markalardan birkaçını doğal cümleler içinde an, bu ürünleri bir araya getiren ortak noktayı adından ve ürünlerinden çıkarabildiğin kadarıyla söyle. Ardından kime ve hangi ihtiyaca uygun olduğunu, ürünleri birlikte nasıl kullanabileceğini anlat.",
    good: "İyi örnek (uydurma bir koleksiyon, kısaltılmış): Piknik koleksiyonu, açık havada geçireceğiniz bir gün için gerekenleri tek sayfada topluyor. Termoslardan katlanır sepetlere kadar birbiriyle uyumlu parçalar bulabilirsiniz.",
    bad: "Kötü örnek: Bu koleksiyon çok özel ve eşsizdir. Herkes için mükemmel ürünler burada.",
  },
  brand: {
    page: "bir marka sayfasının",
    reader:
      "Okur: bu markanın ürünlerine bakan, markanın mağazada hangi ürün türleriyle yer aldığını ve kendisine uygun bir model bulup bulamayacağını anlamak isteyen bir alışverişçi.",
    data: 'Veri: "name" markanın adı, "products" markanın mağazadaki ürünlerinden örnek adlar, "categories" bu ürünlerin en sık bulunduğu kategoriler, "product_count" yaklaşık ürün sayısı, "focus_keyword" odak anahtar kelime, "current_seo_title" ve "current_seo_description" sayfanın bugünkü arama sonucu metinleri, "description" bugünkü açıklamasıdır.',
    middle:
      "Sonraki paragrafta markanın bu mağazada hangi ürün türleriyle yer aldığını anlat: kategorilerden ve ürün örneklerinden birkaçını doğal cümleler içinde an. Ardından seçerken neye bakılacağını, verideki modellerin birbirinden nasıl ayrıldığını okura yol gösteren bir dille anlat. Markanın kuruluşu, geçmişi, ülkesi ya da üretim yeri gibi bilgileri yalnızca bugünkü açıklamada geçiyorsa yaz.",
    good: "İyi örnek (uydurma bir marka, kısaltılmış): Örnekmarka ürünleri bu sayfada termoslar, mataralar ve saklama kapları olarak üç ana grupta toplanıyor. Günlük kullanıma uygun küçük hacimli modellerden kamp için tasarlanmış büyük termoslara kadar farklı seçenekler bulabilirsiniz.",
    bad: "Kötü örnek: Dünyanın en iyi markası Örnekmarka, yılların tecrübesiyle sizlerle (veride olmayan iddia).",
  },
}

function listingInstruction(kind: ListingKind): TaskInstruction {
  const text = KINDS[kind]
  return {
    craft: lines(
      "Rol: Türkiye'de e-ticaret siteleri için yazan, arama motoru optimizasyonunu (SEO) iyi bilen deneyimli bir metin yazarısın.",
      `Amaç: ${text.page} özgün açıklamasını yazmak. Metin sayfada ürünlerin altında görünür; alışverişçiye bu sayfada ne bulacağını ve nasıl seçeceğini anlatır, arama motorlarına da sayfanın konusunu söyler.`,
      text.reader,
      text.data,
      `Yöntem: ilk paragrafta sayfanın ne olduğunu ve hangi ihtiyacı karşıladığını söyle; odak anahtar kelime varsa ilk cümlelerde, bir iki kez daha da metnin içinde doğal biçimde geçsin, yığılmasın. ${text.middle} Ürün sayısını yalnızca verideki aralık olarak (örneğin 40'tan fazla ürün) anabilirsin. Bugünkü açıklama varsa içindeki bilgileri koru ama kopyalama: daha akıcı ve düzenli yaz.`,
      'Kalite ölçütü: her cümle bir bilgi taşır; "geniş ürün yelpazesi", "kaliteli ürünler" gibi genel dolgu cümlesi yoktur; ürün adları uzun bir virgüllü liste olarak sıralanmaz; aynı sözcük sık tekrarlanmaz; doğal Türkçe okunur.',
      text.good,
      text.bad
    ),
    rules: lines(
      `Uzunluk: yukarıda bir uzunluk seçeneği verildiyse ona uy; verilmediyse en az ${String(min)}, en çok ${String(usual)} sözcük.`,
      FACTS_ONLY,
      "Fiyat, stok, indirim, kargo süresi, iletişim bilgisi ya da müşteri yorumu yazma; yalnızca verideki adları kullan, veride olmayan ürün, marka ya da kategori adı uydurma.",
      `Düz metin yaz: iki ile dört paragraf, paragraflar arasında boş satır; başlık ve liste imi kullanma. ${PLAIN_FORM}`,
      "Yalnızca açıklama metnini yaz.",
      RULES_WIN
    ),
    options: {
      short: `Kısa tut: en az ${String(min)}, en çok ${String(short)} sözcük, iki paragraf.`,
      detailed: `Ayrıntılı yaz: ${String(usual)} ile ${String(detailed)} sözcük arasında, üç ya da dört paragraf (bu uzunluk kurallardaki olağan üst sınırın yerine geçer); seçerken neye bakılacağını ayrı paragrafta anlat.`,
    },
  }
}

export const LISTING_INSTRUCTIONS: Readonly<Record<string, TaskInstruction>> = Object.fromEntries(
  (Object.keys(LISTING_DESCRIPTION_TASK_IDS) as ListingKind[]).map((kind) => [
    LISTING_DESCRIPTION_TASK_IDS[kind],
    listingInstruction(kind),
  ])
)

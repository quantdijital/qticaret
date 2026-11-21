import { SERP_TEXT_LENGTH } from "../../seo/pixel-width"
import {
  AI_CANDIDATE_COUNT,
  FOCUS_KEYWORD_MAX_LENGTH,
  FOCUS_KEYWORD_MAX_WORDS,
  PRODUCT_TITLE_MAX_LENGTH,
  PRODUCT_TITLE_TARGET,
} from "../registry/catalog-tasks"
import { FACTS_ONLY, PLAIN_FORM, RULES_WIN, candidateRule, lines } from "./types"
import type { TaskInstruction } from "./types"

/**
 * The search-facing short texts (adr/0074 §4): a page's search result
 * title and description, its focus keyword and a product's name. Each is
 * asked for as `AI_CANDIDATE_COUNT` candidates, every one gated on its
 * own. Length targets are the advisor's (`SERP_TEXT_LENGTH`), never typed twice.
 */

const { title, description } = SERP_TEXT_LENGTH
const N = AI_CANDIDATE_COUNT

const SEO_WRITER =
  "Rol: Türkiye'de e-ticaret siteleri için yazan, arama motoru optimizasyonunu (SEO) iyi bilen deneyimli bir metin yazarısın."

// Which fields of the data block carry what, told once for the SEO tasks
const SEO_FIELDS =
  'Verideki "focus_keyword" sayfanın odak anahtar kelimesidir; "current_seo_title" ve "current_seo_description" sayfanın bugünkü arama sonucu metinleridir; kategori, koleksiyon ve marka sayfasında "products" içindeki ürünlerden örnek adlar, "brands" en sık markalar, "categories" (marka sayfasında) en sık kategoriler, "product_count" ürün sayısıdır; içerik sayfasında ve blog yazısında "summary" yazının özeti, "body" metninin başıdır.'

const SEARCH_INTENT =
  "Okur: arama kutusuna ürün türünü ya da ihtiyacını yazmış, sonuç listesini birkaç saniyede tarayan bir alışverişçi. Ürün sayfasında niyet çoğunlukla satın almaktır; kategori, koleksiyon ve marka sayfasında seçenekleri görmek ve karşılaştırmaktır; içerik sayfasında ve blog yazısında bilgi almaktır."

const SINGLE_LINE = `Tek satır, düz metin; köşeli ya da açılı ayraç kullanma. ${PLAIN_FORM}`

export const SEO_INSTRUCTIONS: Readonly<Record<string, TaskInstruction>> = {
  seo_title: {
    craft: lines(
      SEO_WRITER,
      "Amaç: bu sayfanın arama sonuçlarındaki başlığını yazmak. Başlık arama motoruna sayfanın konusunu söyler ve sonuç listesinde tıklamayı kazanır.",
      SEARCH_INTENT,
      SEO_FIELDS,
      'Yöntem: odak anahtar kelime varsa onu başlığın başına ya da başına yakın, doğal biçimiyle koy; yoksa sayfanın ürün türünü ya da konusunu ilk sözcüklere al. Ardından okuru ikna eden, sayfayı rakiplerinden ayıran bir bilgi ekle: marka, model, malzeme, renk, ölçü, kullanım alanı ya da liste sayfasındaki (kategori, koleksiyon, marka) çeşitler. Mağaza adı veride varsa ve sığıyorsa sona "| Mağaza adı" biçiminde eklenebilir. Bugünkü başlık varsa onu aynen yazma; daha açık ve daha çekici olanını öner.',
      "Adaylar birbirinden belirgin biçimde farklı olsun: biri anahtar kelimeyle başlasın, biri ayırt edici özelliği öne alsın, biri kullanım alanını ya da kime uygun olduğunu söylesin.",
      "Kalite ölçütü: ilk üç dört sözcükte konu anlaşılır; her sözcük bilgi taşır; anahtar kelime yığılmaz; doğal Türkçe okunur.",
      "İyi örnek (uydurma bir ürün): Çelik Termos 750 ml, Çift Cidarlı ve Sızdırmaz | Örnek Mağaza",
      "Kötü örnek: En İyi Termos En Uygun Fiyat Termos Al (abartı, tekrar, veride olmayan iddia)."
    ),
    rules: lines(
      `Uzunluk: ${String(title.min)} ile ${String(title.max)} karakter arası.`,
      "Bir sözcüğü iki kez kullanma.",
      FACTS_ONLY,
      SINGLE_LINE,
      candidateRule(N, "başlık"),
      RULES_WIN
    ),
    options: {},
  },
  seo_description: {
    craft: lines(
      SEO_WRITER,
      "Amaç: arama sonuçlarında başlığın altında görünecek açıklamayı yazmak. Bu metin sıralamayı değil, tıklanıp tıklanmamayı belirler: okura sayfada ne bulacağını ve neden tıklaması gerektiğini söyler.",
      SEARCH_INTENT,
      SEO_FIELDS,
      "Yöntem: odak anahtar kelime varsa ilk cümlede doğal biçimde geçir. Sayfada ne bulunacağını somut söyle: ürün türü ve öne çıkan bir iki özellik; kategori, koleksiyon ya da marka sayfasında verideki ürün örneklerinden, markalardan, kategorilerden ya da çeşitlerden birkaçı. Özelliği okurun kazancına çevir. Sonu kısa ve yumuşak bir davetle bitir (inceleyin, seçenekleri görün gibi). Başlığı tekrar etme; bugünkü açıklama varsa onu aynen yazma.",
      "Adaylar birbirinden belirgin biçimde farklı olsun: biri faydayı öne alsın, biri ayırt edici özelliği, biri çeşitliliği ya da kullanım alanını.",
      "Kalite ölçütü: tek okumada ne olduğu anlaşılır; somut bilgi taşır; genel dolgu cümlesi yoktur.",
      "İyi örnek (uydurma bir ürün; veride çift cidar, 750 ml ve sızdırmaz kapak yazıyor): Çift cidarlı çelik termos, 750 ml hacmi ve sızdırmaz kapağıyla çantada güvenle taşınır. Renk seçeneklerini inceleyin.",
      "Kötü örnek: Termos modelleri burada. En kaliteli termoslar uygun fiyatlarla sitemizde, kaçırmayın!"
    ),
    rules: lines(
      `Uzunluk: her aday ${String(description.min)} ile ${String(description.max)} karakter arası, bir ya da iki cümle.`,
      FACTS_ONLY,
      SINGLE_LINE,
      candidateRule(N, "açıklama"),
      RULES_WIN
    ),
    options: {
      short: `Kısa tut: ${String(description.min)} karaktere yakın, tek cümle yeter.`,
    },
  },
  focus_keyword: {
    craft: lines(
      "Rol: Türkiye'de alışveriş aramalarını iyi bilen bir SEO uzmanısın.",
      "Amaç: bu sayfanın arama motorlarında hedefleyeceği odak anahtar kelimeyi seçmek: Türkiye'de alışveriş yapan birinin bu sayfayı bulmak için arama kutusuna gerçekten yazacağı kısa bir ifade.",
      "Arama niyeti: ürün sayfasında ürün türü ve onu ayıran özellik (malzeme, kullanım, renk, ölçü, marka) birleşir; kategori ve koleksiyon sayfasında çeşidin ya da seçkinin adı kullanılır, ama çok genel tek sözcükten kaçınılır; marka sayfasında marka adı tek başına ya da ürün türüyle birlikte kullanılır.",
      SEO_FIELDS,
      "Yöntem: insanların yazdığı gibi doğal sırada ve küçük harfle yaz; Türkçe karakterleri koru. İlk satır sayfaya en uygun ve en çok aranabilecek ana ifade olsun; ikincisi daha özgül, uzun kuyruk bir ifade; üçüncüsü aynı niyeti başka sözcüklerle söyleyen bir ifade. Bugünkü odak anahtar kelime varsa onu da tart; daha iyisi yoksa adaylardan biri olabilir.",
      "Kalite ölçütü: genellikle iki ile dört sözcük; ne cümle ne tek genel sözcük.",
      "İyi örnek (uydurma bir ürün): çelik termos 750 ml",
      "Kötü örnekler: termos (çok genel), en ucuz termos (veride olmayan iddia), paslanmaz çelik çift cidarlı mavi sızdırmaz termos 750 ml (cümle gibi uzun)."
    ),
    rules: lines(
      `Her ifade en çok ${String(FOCUS_KEYWORD_MAX_WORDS)} sözcük ve ${String(FOCUS_KEYWORD_MAX_LENGTH)} karakter olsun.`,
      FACTS_ONLY,
      "Mağaza adını ekleme. Yalnızca harf, rakam, boşluk ve kısa çizgi kullan; noktalama, tırnak, emoji ve bağlantı kullanma. Türkçe yaz.",
      candidateRule(N, "anahtar kelime"),
      RULES_WIN
    ),
    options: {},
  },
  product_title: {
    craft: lines(
      "Rol: e-ticaret kataloglarını düzenleyen deneyimli bir editörsün.",
      "Amaç: ürün adını, ürünü mağazanın listelerinde, mağaza içi aramada ve arama motorlarında açıkça tanıtacak biçimde yeniden yazmak.",
      "Yöntem: verideki mevcut adı temel al ve bilgilerini koru. Sıra: marka (veride varsa), ürün türü, model, sonra ürünü ayıran bir ya da iki özellik (malzeme, ölçü, renk, kapasite gibi). Odak anahtar kelime veride varsa ve doğal düşüyorsa adın içinde geçsin.",
      "Adaylar birbirinden belirgin biçimde farklı olsun: biri kısa ve sade, biri özellik ağırlıklı, biri model ya da ölçü ağırlıklı.",
      "Kalite ölçütü: okuyan ürünün ne olduğunu ve hangi modelin olduğunu ilk bakışta anlar.",
      "İyi örnek (uydurma bir ürün): Örnekmarka Çelik Termos 750 ml Çift Cidarlı",
      "Kötü örnek: Süper Kaliteli Termos Kampanyalı Ürün (abartı, bilgi yok)."
    ),
    rules: lines(
      `Uzunluk: ${String(PRODUCT_TITLE_TARGET.min)} ile ${String(PRODUCT_TITLE_TARGET.max)} karakter arası; ${String(PRODUCT_TITLE_MAX_LENGTH)} karakteri asla geçme.`,
      "Yalnızca verideki sözcükleri ve bilgileri kullan; veride olmayan özellik, ölçü, malzeme, marka, fiyat, indirim, kargo ya da üstünlük sözcüğü (en iyi, kaliteli gibi) ekleme.",
      "Mağaza adını ekleme, bir sözcüğü iki kez kullanma.",
      SINGLE_LINE,
      candidateRule(N, "ürün adı"),
      RULES_WIN
    ),
    options: {},
  },
}

import {
  CAMPAIGN_BODY_WORDS,
  CAMPAIGN_PRODUCTS_FIELD,
  CAMPAIGN_SMS_ROOM_FIELD,
  CAMPAIGN_PARAGRAPHS,
  CAMPAIGN_PARAGRAPH_MAX_LENGTH,
  CAMPAIGN_PREHEADER_MAX_LENGTH,
  CAMPAIGN_SMS_COUNT,
  CAMPAIGN_SUBJECT_COUNT,
  CAMPAIGN_SUBJECT_MAX_LENGTH,
} from "../registry/campaign-tasks"
import type { CampaignPurpose } from "../registry/campaign-tasks"
import { RULES_WIN, lines } from "./types"
import type { TaskInstruction } from "./types"

/**
 * A bulk message's words (adr/0074 §5 madde 6): an e-mail's subject lines,
 * preview line and short body, or a text's candidates. One JSON object;
 * its texts prose in the shop's voice (the guidance and the owner's craft
 * apply). The purpose picked is the option; nothing is typed.
 */

const SMS_ROOM = CAMPAIGN_SMS_ROOM_FIELD

const PURPOSES: Readonly<Record<CampaignPurpose, string>> = {
  new_product:
    "Amaç yeni ürün duyurusu: neyin yeni olduğunu ve okura ne kazandırdığını öne çıkar; veride ürün adı varsa onu an.",
  discount:
    "Amaç indirim ya da fırsat duyurusu: fırsatı açıkça söyle. Oran, tutar, kod ya da son tarih yalnızca veride yazıyorsa ve verideki biçimiyle yazılır; veride yoksa rakam vermeden fırsatı anlat.",
  season:
    "Amaç sezon ya da dönem iletisi: dönemin ihtiyacını mağazanın ürünleriyle bağla; veride olmayan tarih ya da özel gün uydurma.",
  win_back:
    "Amaç bir süredir alışveriş yapmayan müşteriyi geri çağırmak: sıcak ve baskısız bir dille mağazayı hatırlat, neyin yeni ya da değerli olduğunu söyle; suçlayıcı ya da yalvaran bir dil kullanma.",
}

const COMMON_FIELDS = `"campaign" mağazanın bu iletiye verdiği addır (çoğu zaman konusunu ya da fırsatını söyler), "shop" mağazanın adıdır`

const EMAIL_FIELDS = `Veri: ${COMMON_FIELDS}, "${CAMPAIGN_PRODUCTS_FIELD}" e-postada kart olarak gösterilen ürünlerin adları, "subject" bugünkü konu satırı, "preheader" bugünkü önizleme satırı, "body" bugünkü metindir. Boş alan yazılmamıştır.`

const SMS_FIELDS = `Veri: ${COMMON_FIELDS}, "sms_text" bugünkü metin, "${SMS_ROOM}" bir metnin en çok kaç karakter olabileceğidir.`

const NO_INVENTION =
  "Yalnızca verideki bilgileri kullan. Veride olmayan rakam, oran, fiyat, indirim kodu, tarih, süre, ücretsiz kargo, hediye, stok ya da üstünlük iddiası (en iyi, en ucuz gibi) yazma; verideki bir rakamı yazacaksan verideki biçimiyle yaz."

const NO_PERSON =
  "Kişi adı, e-posta, telefon, adres ya da {ad} gibi süslü parantezli yer tutucu yazma; alıcıya adıyla seslenme."

export const CAMPAIGN_INSTRUCTIONS: Readonly<Record<string, TaskInstruction>> = {
  campaign_email: {
    craft: lines(
      "Rol: küçük bir mağazanın e-posta bültenini yazan, sade ve samimi konuşan bir pazarlama yazarısın.",
      "Amaç: mağazanın izin vermiş müşterilerine gidecek kısa bir kampanya e-postası için konu satırları, bir önizleme satırı ve kısa bir metin yazmak. Okur gelen kutusunda konu satırına bir saniye bakar: konu merak uyandırır ama yanıltmaz, ne sunulduğunu söyler.",
      EMAIL_FIELDS,
      "Yöntem: önce iletinin ne söylediğini tek cümleyle belirle (verideki ad, ürünler, bugünkü metin). Konu satırları farklı açılardan yazılır: biri doğrudan fayda, biri merak, biri ürün ya da dönem. Önizleme satırı konunun söylemediğini tamamlar. Metin ilk cümlede konuya girer, sonra bir iki cümleyle nedenini anlatır ve okuru mağazaya davet eden kısa bir cümleyle biter. Bugünkü metin varsa onun söylediklerini koru, daha açık ve akıcı yaz.",
      "İyi örnek (uydurma bir mağaza): Konu: Yeni seramik kupalar raflarda. Önizleme: El yapımı, her biri tek. Metin: Bu hafta atölyemizden yeni kupalar geldi. Her biri elde şekillendirildi ve sırlandı; sabah kahveniz artık biraz daha özel.",
      "Kötü örnek: Konu: KAÇIRMAYIN!!! %50 İNDİRİM (veride oran yok, bağırıyor) ya da Konu: Merhaba (hiçbir şey söylemiyor)."
    ),
    rules: lines(
      "Yanıtın yalnızca tek bir JSON nesnesi olsun, başka metin yazma.",
      `Nesnenin alanları yalnızca "subjects", "preheader" ve "paragraphs"tır. "subjects" tam olarak ${String(CAMPAIGN_SUBJECT_COUNT)} farklı konu satırının dizisidir, en güçlüsü ilk sırada; her biri tek satır, en çok ${String(CAMPAIGN_SUBJECT_MAX_LENGTH)} karakter, tercihen 50 karakterin altında. "preheader" tek satır, en çok ${String(CAMPAIGN_PREHEADER_MAX_LENGTH)} karakter. "paragraphs" ${String(CAMPAIGN_PARAGRAPHS.min)} ile ${String(CAMPAIGN_PARAGRAPHS.max)} arası paragrafın dizisidir; her paragraf düz metin, en çok ${String(CAMPAIGN_PARAGRAPH_MAX_LENGTH)} karakter; metnin tümü ${String(CAMPAIGN_BODY_WORDS.min)} ile ${String(CAMPAIGN_BODY_WORDS.max)} sözcük arası, yaklaşık ${String(CAMPAIGN_BODY_WORDS.target)} sözcük.`,
      NO_INVENTION,
      NO_PERSON,
      "Başlık, liste imi, bağlantı, adres, düğme metni, HTML, emoji ve tümü büyük harf sözcük kullanma; ünlem işaretini en çok bir kez kullan. Türkçe yaz.",
      RULES_WIN
    ),
    options: PURPOSES,
  },
  campaign_sms: {
    craft: lines(
      "Rol: küçük bir mağazanın kısa mesajlarını yazan, az sözle çok şey söyleyen bir pazarlama yazarısın.",
      "Amaç: mağazanın izin vermiş müşterilerine gidecek tek bir kısa mesaj (SMS) için metin adayları yazmak. Mağazanın adı ve ret satırı metnin sonuna ayrıca eklenir; sen yazma.",
      SMS_FIELDS,
      "Yöntem: tek bir mesaj seç ve onu ilk sözcüklerde söyle; sonra okuru harekete geçiren kısa bir cümle ekle. Adaylar farklı açılardan yazılır. Bugünkü metin varsa onun söylediklerini koru, daha kısa ve açık yaz. Kısa yaz: ş, ğ, ı, İ ve ç harfleri SMS'te iki karakter yer kaplar.",
      "İyi örnek (uydurma bir mağaza): Yeni seramik kupalar geldi, her biri el yapımı. Atölyemize bekleriz.",
      "Kötü örnek: SON GÜN!!! Tüm ürünlerde %40 indirim, hemen tıkla (veride oran ve süre yok, bağırıyor, bağlantı istiyor)."
    ),
    rules: lines(
      "Yanıtın yalnızca tek bir JSON nesnesi olsun, başka metin yazma.",
      `Nesnenin tek alanı "texts"tir: tam olarak ${String(CAMPAIGN_SMS_COUNT)} farklı metnin dizisi, en güçlüsü ilk sırada. Her metin tek satır ve verideki "${SMS_ROOM}" sayısından kısa olur.`,
      "Mağazanın adını, ret satırını, bağlantı ya da adres yazma.",
      NO_INVENTION,
      NO_PERSON,
      "Emoji, HTML, tırnak içinde vurgu ve tümü büyük harf sözcük kullanma; yalnızca Türkçe harfler, rakamlar ve olağan noktalama kullan.",
      RULES_WIN
    ),
    options: PURPOSES,
  },
}

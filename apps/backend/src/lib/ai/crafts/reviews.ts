import { REVIEW_REPLY_MAX_LENGTH, REVIEW_SUMMARY_MAX_LENGTH } from "../registry/tasks"
import { PLAIN_FORM, RULES_WIN, lines } from "./types"
import type { TaskInstruction } from "./types"

/**
 * Customers' words (Aşama 9): a summary of reviews, a reply to one, an
 * answer to a question. Nobody is named, nothing is promised.
 */

// What none of them may carry: a person, a hole where a name was, contact data
const NO_PERSON =
  'Kimseyi adıyla anma, kimseye adıyla seslenme; "[…]" ile gizlenmiş yeri yazma. E-posta, telefon, adres, sipariş bilgisi ya da bağlantı yazma.'

export const REVIEW_INSTRUCTIONS: Readonly<Record<string, TaskInstruction>> = {
  review_summary: {
    craft: lines(
      "Rol: müşteri geri bildirimlerini mağaza ekibi için özetleyen bir analistsin.",
      "Amaç: mağaza çalışanının neyin övüldüğünü, neyin eleştirildiğini hızla görmesi; ürün açıklamasını ya da ürünü buna göre iyileştirebilmesi.",
      "Veri: bir ürünün mağazada onaylanmış müşteri yorumları; her yorumun etiketi puanıdır (5 üzerinden).",
      "Yöntem: önce yorumların genel eğilimini puanlara bakarak bir cümleyle söyle. Sonra birden çok yorumda tekrar eden temaları bul; en sık geçenleri öne al.",
      'Kalite ölçütü: temalar somuttur (kapak sızdırıyor, rengi fotoğraftakiyle aynı); "bazı sorunlar var" gibi genel ifade yoktur.',
      "İyi örnek (uydurma bir ürün): Yorumların çoğu olumlu. Artılar: ısıyı uzun süre koruması, sağlam gövde. Eksiler: kapağın zor açılması.",
      "Kötü örnek: Müşteriler genelde memnun ama bazı sorunlar var."
    ),
    rules: lines(
      'Biçim: genel eğilim cümlesinden sonra "Artılar:" satırında en çok üç nokta, "Eksiler:" satırında en çok üç nokta, virgülle ayrılmış; bir yön yorumlarda yoksa o satıra "belirgin değil" yaz.',
      `Uzunluk: en çok ${String(REVIEW_SUMMARY_MAX_LENGTH / 2)} karakter.`,
      "Yalnızca yorumlarda geçeni yaz; tek bir yorumda geçeni genelleme, uydurma ve yorum alıntılama.",
      NO_PERSON,
      `Düz metin: başlık, liste imi kullanma. ${PLAIN_FORM}`,
      "Yalnızca özeti yaz.",
      RULES_WIN
    ),
    options: {},
  },
  review_reply: {
    craft: lines(
      "Rol: mağazanın müşteri ilişkilerinden sorumlu, sıcak ve ölçülü konuşan bir çalışanısın.",
      "Amaç: yorumu yazan müşteriye ve yanıtı okuyacak diğer alışverişçilere mağazanın ilgili ve güvenilir olduğunu göstermek.",
      "Yöntem: yorumun somut bir noktasına değin; şablon gibi okunmasın. Memnuniyette teşekkür et ve övülen noktayı an. Şikâyette özür dile, anlayış göster, mağazanın konuyla ilgileneceğini söyle ve müşteriyi mağazayla iletişime geçmeye davet et. Savunmaya geçme, müşteriyi suçlama.",
      "İyi örnek (uydurma bir ürün): Termosun ısıyı uzun süre korumasını beğenmenize çok sevindik. Güzel yorumunuz için teşekkür ederiz, keyifli kullanımlar dileriz.",
      "Kötü örnek: Değerli müşterimiz, yorumunuz bizim için önemlidir. (genel şablon, yoruma değinmiyor)"
    ),
    rules: lines(
      `Uzunluk: iki ile dört cümle, en çok ${String(REVIEW_REPLY_MAX_LENGTH / 2)} karakter.`,
      "İndirim, iade, ücretsiz ürün, tarih ya da veride olmayan bir söz verme; ürün hakkında veride olmayan bilgi ekleme.",
      NO_PERSON,
      PLAIN_FORM,
      "Yalnızca yanıt metnini yaz.",
      RULES_WIN
    ),
    options: {},
  },
  question_answer: {
    craft: lines(
      "Rol: ürünü iyi bilen, açık ve kısa konuşan bir mağaza çalışanısın.",
      "Amaç: soruyu doğrudan yanıtlamak; yanıt herkese açıktır, aynı şeyi merak eden diğer alışverişçilere de yarar.",
      "Yöntem: ilk cümlede doğrudan yanıt ver (evet, hayır, ölçü, nasıl); sonra verideki dayanağı kısaca söyle. Veride yanıt yoksa tahmin etme; mağazanın bilgiyi kontrol edip döneceğini söyle.",
      "İyi örnek (uydurma bir ürün): Evet, termosun kapağı sızdırmazdır; çantanızda yatay taşıyabilirsiniz.",
      "Kötü örnek: Ürünümüz çok kalitelidir, gönül rahatlığıyla alabilirsiniz. (soruyu yanıtlamıyor)"
    ),
    rules: lines(
      `Uzunluk: bir ile dört cümle, en çok ${String(REVIEW_REPLY_MAX_LENGTH / 2)} karakter.`,
      "Yanıtı yalnızca verideki ürün bilgilerine dayandır. Fiyat, stok, kargo süresi, indirim ya da veride olmayan bir söz verme.",
      NO_PERSON,
      PLAIN_FORM,
      "Yalnızca yanıt metnini yaz.",
      RULES_WIN
    ),
    options: {},
  },
}

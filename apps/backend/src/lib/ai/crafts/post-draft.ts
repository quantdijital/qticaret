import { OPENING_WORDS } from "../../seo/advisor/rules-content"
import { LINK_CHOICES_FIELD } from "../post-draft"
import {
  POST_HEADING_MAX_LENGTH,
  POST_LINK_WHY_MAX_LENGTH,
  POST_MAX_LINKS,
  POST_PARAGRAPH_MAX_LENGTH,
  POST_SECTIONS,
  POST_WORDS,
} from "../registry/content-tasks"
import { RULES_WIN, lines } from "./types"
import type { TaskInstruction } from "./types"

/**
 * A blog post's draft (adr/0074 §5 madde 5): an article in headed sections
 * from the post's title, focus keyword and summary; one JSON object, its
 * texts prose in the shop's voice (the guidance and the owner's craft
 * apply). Internal links are codes of the shop's list, apart from the text.
 */

const POST_FIELDS = `Veri: "name" yazının başlığı, "focus_keyword" odak anahtar kelimesi, "summary" yazarın kısa özeti, "shop" mağazanın adı, "${LINK_CHOICES_FIELD}" mağazanın vitrinde görünen kategorileri ve ürünleridir (her biri bir kod ve adla).`

export const POST_DRAFT_INSTRUCTIONS: Readonly<Record<string, TaskInstruction>> = {
  post_draft: {
    craft: lines(
      "Rol: Türkiye'de e-ticaret mağazalarının blogları için yazan, arama motoru optimizasyonunu (SEO) bilen deneyimli bir içerik yazarısın.",
      "Amaç: başlığın vaat ettiği soruya ya da konuya gerçekten yanıt veren, okuru bilgilendiren özgün bir blog yazısı taslağı yazmak. Yazı mağazanın uzmanlığını gösterir; satış metni değildir.",
      "Okur: konuyu arama motorunda aratmış, net ve uygulanabilir bilgi arayan biri. Niyet bilgi almaktır.",
      POST_FIELDS,
      `Yöntem: ilk bölümün başlığını boş bırak; bu giriş, başlıktaki soruya doğrudan ve kendi başına anlaşılır bir yanıttır (${String(OPENING_WORDS.min)}–${String(OPENING_WORDS.max)} sözcük). Odak anahtar kelime varsa girişte ve bir ara başlıkta doğal biçimde geçsin. Sonraki her bölüm okurun bir alt sorusunu ele alır; başlığı o soruyu ya da yanıtını kısaca söyler. Bir bölümü alt başlıklara bölmek gerekirse alt bölümü "level": 3 ile yaz. Paragraflar iki ile dört cümle olsun; somut bilgi, adım ve örnek ver. Son bölüm kısa bir toparlama olsun.`,
      `Mağazanın ürün ve kategorilerinden yalnızca "${LINK_CHOICES_FIELD}" listesindekileri, adıyla ve konuya gerçekten uyuyorsa anabilirsin. Listede olmayan ürün, marka, model ya da kategori adı yazma; bir ürüne veride olmayan özellik yükleme.`,
      "Kalite ölçütü: her paragraf okura yeni bir bilgi katar; genel dolgu cümlesi yoktur; aynı sözcük sık tekrarlanmaz; doğal Türkçe okunur.",
      'İyi örnek (uydurma bir konu, kısaltılmış): Başlık: Termos nasıl temizlenir? Giriş: Termosu temizlemenin en etkili yolu, her kullanımdan sonra ılık suyla çalkalamak ve haftada bir karbonatlı suyla bekletmektir… Bölüm başlığı: "Kokuyu gidermek için ne yapmalı?"',
      "Kötü örnek: Bu yazımızda termoslar hakkında her şeyi bulacaksınız. Termoslar çok önemlidir. En iyi termoslar mağazamızda! (bilgi yok, iddia ve çağrı)"
    ),
    rules: lines(
      "Yanıtın yalnızca tek bir JSON nesnesi olsun, başka metin yazma.",
      `Nesnenin alanları yalnızca "sections" ve "links"tir. "sections" ${String(POST_SECTIONS.min)} ile ${String(POST_SECTIONS.max)} arası bölümün dizisidir; her bölüm "heading" (başlık, tek satır, en çok ${String(POST_HEADING_MAX_LENGTH)} karakter), isteğe bağlı "level" (2 ya da 3; yazılmazsa 2) ve "paragraphs" (paragraf metinlerinin dizisi, her biri en çok ${String(POST_PARAGRAPH_MAX_LENGTH)} karakter) alanlarını taşır. Yalnızca ilk bölümün başlığı boş ("") olabilir.`,
      `"links" en çok ${String(POST_MAX_LINKS)} öğenin dizisidir; her öğe yalnızca "code" (verideki "${LINK_CHOICES_FIELD}" listesinden bir kod, örneğin "k3" ya da "u2") ve "why" (bu sayfaya neden ve yazının neresinden bağlantı verilmeli, tek satır, en çok ${String(POST_LINK_WHY_MAX_LENGTH)} karakter) alanlarını taşır. Listede olmayan kod yazma; uygun olan yoksa boş dizi yaz.`,
      `Uzunluk: yukarıda bir uzunluk seçeneği verildiyse ona uy; verilmediyse başlıklar ve paragraflar birlikte en az ${String(POST_WORDS.min)}, en çok ${String(POST_WORDS.usual)} sözcük.`,
      'Metnin içine bağlantı, adres, kod ya da köşeli ayraç yazma; bağlantılar yalnızca "links" dizisinde olur.',
      "Fiyat, indirim, kampanya, stok, kargo, teslimat, iade ya da garanti sözü ve veride olmayan ürün, ölçü, malzeme ya da üstünlük iddiası (en iyi, bir numara gibi) yazma.",
      "Kişi adı, e-posta, telefon ya da adres yazma.",
      "Tırnak içinde vurgu, emoji, liste imi, HTML ve tümü büyük harf sözcük kullanma. Türkçe yaz.",
      RULES_WIN
    ),
    options: {
      short: `Kısa tut: en az ${String(POST_WORDS.min)}, en çok ${String(POST_WORDS.short)} sözcük; dört ya da beş bölüm.`,
      detailed: `Ayrıntılı yaz: ${String(POST_WORDS.usual)} ile ${String(POST_WORDS.detailed)} sözcük arasında (bu uzunluk kurallardaki olağan üst sınırın yerine geçer); konuyu alt başlıklarla derinleştir.`,
    },
  },
}

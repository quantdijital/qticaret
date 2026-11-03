import type { Block } from "../../content"
import { bullets, h2, h3, p } from "./blocks"
import { WITHDRAWAL_EXCEPTIONS } from "./shared"

/*
 * The clauses the pre-information form and the distance sales contract
 * both hold, numbered as each places them. "Kanun" is 6502 sayılı
 * Tüketicinin Korunması Hakkında Kanun, "Yönetmelik" the Mesafeli
 * Sözleşmeler Yönetmeliği (RG 27.11.2014/29188) as amended up to
 * RG 24.5.2025/32909, whose changes apply since 1.1.2026.
 */

/**
 * The right of withdrawal (Kanun md. 48/4; Yönetmelik md. 9–15). Its
 * heading is the text's first to name "cayma": the server places the
 * order's personal and gift card lines at the end of this section
 * (`withPersonalLines`), after the exceptions.
 */
export function withdrawalClause(n: string): Block[] {
  return [
    h2(`${n}. Cayma Hakkı`),
    p(
      `${n}.1. Alıcı, hiçbir gerekçe göstermeksizin ve cezai şart ödemeksizin {iade_süresi} gün içinde sözleşmeden cayma hakkına sahiptir (Kanun md. 48/4; Yönetmelik md. 9). Cayma süresi, ürünün Alıcıya veya Alıcının belirlediği, taşıyıcı dışındaki üçüncü kişiye teslim edildiği gün başlar. Ayrı ayrı teslim edilen birden fazla ürünü kapsayan siparişlerde süre son ürünün, birden fazla parçadan oluşan üründe son parçanın teslim edildiği gün başlar. Alıcı, sözleşmenin kurulmasından ürünün teslimine kadar geçen sürede de cayma hakkını kullanabilir.`
    ),
    p(
      `${n}.2. Cayma hakkı, süresi içinde Satıcıya yöneltilecek açık bir bildirimle kullanılır; bildirimin süre dolmadan Satıcıya ulaşması yeterlidir (Yönetmelik md. 11). Bildirim aşağıdaki yollardan biriyle yapılabilir:`
    ),
    bullets([
      "Sipariş sayfasındaki iade talebi formu (üye girişi yapılarak ya da sipariş e-postasındaki bağlantıyla)",
      "E-posta: {e_posta}",
      "KEP: {kep}",
      "Posta veya elden teslim: {adres}",
    ]),
    p(
      `${n}.3. Alıcı bildirimini serbestçe yazabilir ya da Yönetmeliğin ekindeki örnek cayma formunu kullanabilir. Sipariş sayfası üzerinden yapılan bildirimin alındığı Alıcıya e-postayla hemen bildirilir. Cayma hakkının süresinde kullanıldığını ispat yükü Alıcıdadır (Yönetmelik md. 11).`
    ),
    p(
      `${n}.4. Teslimattan sonra cayma hakkını kullanan Alıcı, ürünü cayma bildirimini yönelttiği tarihten itibaren 14 gün içinde Satıcıya geri gönderir (Yönetmelik md. 13/1). Ürün, varsa aksesuarları, kullanım kılavuzu ve birlikte gönderilen hediyeleriyle iade edilir.`
    ),
    p(
      `${n}.5. İade gönderimi, iade talebi onaylandığında Alıcıya iletilen iade kodu ile Satıcının iade için anlaşmalı olduğu kargo firması aracılığıyla yapılır. Alıcı ürünü bu taşıyıcıyla gönderdiğinde iade masrafından sorumlu tutulamaz. Satıcı iade için bir taşıyıcı belirtmemişse Alıcıdan iade masrafı istenemez; belirtilen taşıyıcının Alıcının bulunduğu yerde şubesi yoksa Satıcı, ürünün Alıcıdan ek bir masraf istenmeksizin alınmasını sağlar (Yönetmelik md. 12).`
    ),
    p(
      `${n}.6. Satıcı, teslim masrafları da dahil olmak üzere tahsil ettiği tüm ödemeleri en geç 14 gün içinde iade eder. Bu süre; ürün teslim edildikten sonra cayıldıysa ürünün Satıcının iade için belirlediği taşıyıcıya teslim edildiği tarihten, Alıcı ürünü başka bir taşıyıcıyla gönderdiyse ürünün Satıcıya ulaştığı tarihten, ürün teslim edilmeden cayıldıysa cayma bildiriminin Satıcıya ulaştığı tarihten başlar (Yönetmelik md. 12).`
    ),
    p(
      `${n}.7. İade, Alıcının ödemede kullandığı ödeme aracına uygun şekilde, tek seferde ve Alıcıya herhangi bir masraf veya yükümlülük getirilmeden yapılır. Kredi veya banka kartıyla yapılan ödemelerin iadesi kartı çıkaran kuruluşça karta yansıtılır. Hediye kartı veya mağaza kredisiyle ödenen kısım aynı karta ya da krediye geri yüklenir. Kapıda ödeme veya havale/EFT ile yapılan ödemeler, Alıcının bildireceği ve Alıcı adına kayıtlı banka hesabına havale/EFT ile iade edilir.`
    ),
    p(
      `${n}.8. Alıcı, cayma süresi içinde ürünün işleyişine, teknik özelliklerine ve kullanım talimatlarına uygun kullanımı nedeniyle oluşan değişiklik ve bozulmalardan sorumlu değildir (Yönetmelik md. 13/2).`
    ),
    p(
      `${n}.9. Cayma hakkının kullanılmasıyla satış sözleşmesine bağlı olarak kurulmuş yan sözleşmeler de (ör. bağlı kredi sözleşmesi) Alıcı için herhangi bir masraf, tazminat veya cezai şart doğmaksızın kendiliğinden sona erer (Yönetmelik md. 14; Kanun md. 30).`
    ),
    h3("Cayma hakkının kullanılamayacağı haller"),
    p(
      `${n}.10. Taraflarca aksi kararlaştırılmadıkça Yönetmelik md. 15/1 uyarınca aşağıdaki sözleşmelerde cayma hakkı kullanılamaz:`
    ),
    WITHDRAWAL_EXCEPTIONS,
    p(
      `${n}.11. Bu istisnalara giren ürünler ürün sayfasında belirtilir. Koruyucu ambalajı açılmamış ürünlerde ${n}.10'daki sağlık ve hijyen istisnası uygulanmaz. Siparişte Alıcının isteğiyle kişiye özel hazırlanan ürünler veya hediye kartları bulunuyorsa, bunlar ve bunlarda cayma hakkının nasıl uygulanacağı bu maddenin sonunda ayrıca sayılır.`
    ),
  ]
}

const REMEDIES = bullets([
  "Satılanı geri vermeye hazır olduğunu bildirerek sözleşmeden dönme,",
  "Satılanı alıkoyup ayıp oranında satış bedelinden indirim isteme,",
  "Aşırı bir masraf gerektirmediği takdirde bütün masrafları Satıcıya ait olmak üzere satılanın ücretsiz onarılmasını isteme,",
  "İmkân varsa satılanın ayıpsız bir misli ile değiştirilmesini isteme.",
])

/** Defective goods (Kanun md. 8–12), and warranty and after-sales service (md. 55, 56, 58). */
export function defectClause(n: string): Block[] {
  return [
    h2(`${n}. Ayıplı Ürün, Garanti ve Satış Sonrası Hizmetler`),
    p(
      `${n}.1. Satıcı, ürünü siparişte belirtilen niteliklere ve sözleşmeye uygun olarak teslim etmekle yükümlüdür (Kanun md. 9). Kararlaştırılan örneğe veya modele uygun olmayan; ambalajında, etiketinde, tanıtma ve kullanma kılavuzunda, internet sitesinde veya reklamlarında belirtilen ya da teknik düzenlemesinde yer alan niteliklere aykırı olan veya kullanım amacı bakımından değerini ya da Alıcının ondan makul olarak beklediği faydaları azaltan veya ortadan kaldıran ürün ayıplıdır (Kanun md. 8).`
    ),
    p(
      `${n}.2. Teslim tarihinden itibaren altı ay içinde ortaya çıkan ayıpların teslim tarihinde var olduğu kabul edilir; aksini ispat yükü Satıcıdadır (Kanun md. 10).`
    ),
    p(
      `${n}.3. Ürünün ayıplı olması halinde Alıcı, Kanun md. 11 uyarınca şu haklardan birini kullanabilir:`
    ),
    REMEDIES,
    p(
      `${n}.4. Ücretsiz onarım veya ayıpsız misliyle değiştirme talebi, talebin Satıcıya ulaşmasından itibaren en geç 30 iş günü içinde yerine getirilir. Sözleşmeden dönmede ödenen bedel, bedel indiriminde indirim tutarı derhal iade edilir. Seçilen hakkın yerine getirilmesine ilişkin masraflar (ayıplı ürünün gönderim masrafı dahil) Satıcıya aittir. Alıcı ayrıca Türk Borçlar Kanunu hükümlerine göre tazminat isteyebilir (Kanun md. 11).`
    ),
    p(
      `${n}.5. Ayıptan doğan sorumluluk, ayıp daha sonra ortaya çıksa bile ürünün teslim tarihinden itibaren iki yıllık zamanaşımına tabidir; ayıp ağır kusur veya hile ile gizlenmişse zamanaşımı uygulanmaz (Kanun md. 12).`
    ),
    p(
      `${n}.6. Garanti belgesiyle satılması zorunlu ürünler garanti belgesi ve Türkçe tanıtma ve kullanma kılavuzuyla birlikte teslim edilir. Garanti süresi teslim tarihinden başlar ve en az iki yıldır (Kanun md. 55, 56; Garanti Belgesi Yönetmeliği). Satış sonrası bakım ve onarım hizmetleri, Satış Sonrası Hizmetler Yönetmeliği uyarınca üretici veya ithalatçı tarafından sağlanır (Kanun md. 58).`
    ),
    p(
      `${n}.7. Ayıplı ürün başvurusu cayma süresiyle sınırlı değildir ve Satıcının iletişim bilgileri üzerinden her zaman yapılabilir. Cayma süresi içinde sipariş sayfasındaki iade talebi formunda "Hasarlı geldi", "Yanlış ürün geldi" veya "Açıklamadaki gibi değil" nedenlerinden biri seçilerek de başvurulabilir.`
    ),
  ]
}

/** The short form for the pre-information form: the rights, the presumption, the limitation. */
export function defectSummary(n: string): Block[] {
  return [
    h2(`${n}. Ayıplı Ürün ve Garanti`),
    p(
      `${n}.1. Ayıplı çıkan üründe Alıcı, Kanun md. 11'deki seçimlik haklarından birini kullanabilir: sözleşmeden dönme, ayıp oranında bedel indirimi, ücretsiz onarım veya ayıpsız misliyle değiştirme. Seçilen hakkın yerine getirilmesine ilişkin masraflar Satıcıya aittir; onarım veya değiştirme talebi en geç 30 iş günü içinde yerine getirilir.`
    ),
    p(
      `${n}.2. Teslimden itibaren altı ay içinde ortaya çıkan ayıpların teslim anında var olduğu kabul edilir (Kanun md. 10). Ayıptan sorumluluk teslimden itibaren iki yıllık zamanaşımına tabidir (Kanun md. 12). Garanti belgesiyle satılması zorunlu ürünlerde garanti süresi en az iki yıldır (Kanun md. 56).`
    ),
  ]
}

import type { Block } from "../../content"
import { bullets, draftNote, h2, p } from "./blocks"

/**
 * Teslimat ve Kargo Politikası: when an order leaves and arrives (the
 * shipping settings' days, F7.8), and what happens on the way (Yönetmelik
 * md. 16–17, 19; adr/0029 cash on delivery; adr/0031 tracking).
 */
const NOTE = draftNote([
  "Anlaşmalı kargo firmalarınızın adları: mağaza ayarlarında metne yazılabilecek bir alan yok. İsterseniz 4. maddeye ekleyin.",
  "Teslim edilemeyen ya da teslim alınmayan gönderinin yeniden gönderim ücretinin kime ait olacağı (7. madde) ve kapıda ödemeli gönderinin teslim alınmamasının cayma sayılıp sayılmayacağı (9. madde).",
  "Yurt dışına gönderim yapıyorsanız 1. madde ve gümrük, vergi kuralları için ayrı bir bölüm.",
  "Kişiye özel hazırlanan ürünlerde 30 günü aşan teslim süresinin ürün sayfasında açıkça yazılması (3. madde; Yönetmelik md. 16/1).",
  "Hazırlama ve taşıma süreleri Ayarlar > Kargo ve teslimat > Teslim süresi'ndeki gün aralıklarından gelir; cumartesi, pazar ve resmî tatillerde kargoya verme yapıp yapmadığınız (2. madde bunları iş günü saymıyor).",
])

export const shippingPolicy: { title: string; content: Block[] } = {
  title: "Teslimat ve Kargo Politikası",
  content: [
    NOTE,
    p(
      "Bu politika, {alan_adı} üzerinden verdiğiniz siparişlerin nasıl hazırlandığını, kargoya verildiğini ve size teslim edildiğini açıklar. Teslimata ilişkin haklarınız 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliğine dayanır; bu politika yasal haklarınızı sınırlamaz."
    ),
    h2("1. Gönderim Bölgesi"),
    p("Siparişler Türkiye içindeki adreslere gönderilir."),
    h2("2. Siparişin Hazırlanması"),
    p(
      "Siparişiniz, ödemeniz onaylandıktan sonra {hazırlama_süresi} içinde hazırlanarak kargoya verilir. Havale/EFT ile ödenen siparişlerde bu süre ödemenin hesabımıza ulaştığı günden, kapıda ödemeli siparişlerde siparişin verildiği günden başlar. Cumartesi, pazar ve resmî tatiller iş gününden sayılmaz."
    ),
    p(
      "Kişiye özel hazırlanan ürünlerde hazırlama süresi ürün sayfasında ayrıca belirtilir. Siparişiniz kargoya verildiğinde size e-postayla bildirilir."
    ),
    h2("3. Teslimat Süresi"),
    p(
      "Kargoya verilen siparişler, kargo firması tarafından genellikle {kargo_süresi} içinde teslim edilir. Bu süre, teslimat adresinin bulunduğu yere ve kargo firmasının yoğunluğuna göre değişebilir."
    ),
    p(
      "Siparişiniz her durumda, siparişin bize ulaşmasından itibaren en geç 30 gün içinde teslim edilir (6502 sayılı Kanun md. 48/3; Yönetmelik md. 16/1). Bu süre aşılırsa sözleşmeyi feshedebilirsiniz; bu durumda kargo ücreti dahil ödediğiniz tüm tutar, fesih bildiriminizin bize ulaşmasından itibaren 14 gün içinde kanuni faiziyle birlikte iade edilir (Yönetmelik md. 16/2-3). Siparişinizi teslim edemeyeceğimizi öğrenirsek bunu 3 gün içinde size bildirir ve ödediğiniz tutarı 14 gün içinde iade ederiz (md. 16/4)."
    ),
    h2("4. Kargo Firması ve Gönderi Takibi"),
    p(
      "Siparişler anlaşmalı kargo firmalarımızla gönderilir. Siparişiniz kargoya verildiğinde kargo firmasının adı ve takip numarası size e-postayla iletilir; gönderinizi sipariş sayfanızdan da takip edebilirsiniz."
    ),
    h2("5. Kargo Ücreti"),
    p(
      "Kargo ücreti ve varsa ücretsiz kargo koşulu, siparişinizi onaylamadan önce ödeme adımında gösterilir ve sipariş toplamına eklenir. Ödeme adımında gösterilmeyen bir kargo ücreti sizden istenmez (Yönetmelik md. 5/3, md. 19)."
    ),
    p(
      "Cayma hakkını kullandığınızda siparişin kargo ücreti de iade edilir; siparişin yalnızca bir kısmını iade ettiğinizde de ilk iadenizle birlikte bir kez iade edilir. İade kodu ile anlaşmalı kargo firmamız aracılığıyla gönderdiğiniz iadelerde kargo ücreti sizden istenmez. Ayrıntılar İade ve Değişim Politikamızda yer alır."
    ),
    h2("6. Teslimat"),
    p(
      "Gönderi, siparişte belirttiğiniz teslimat adresinde size veya sizin teslim almaya yetkili kıldığınız kişiye teslim edilir. Kargo görevlisi teslimat sırasında kimlik doğrulaması isteyebilir."
    ),
    p(
      "Ürün size veya belirlediğiniz, kargo firması dışındaki bir kişiye teslim edilinceye kadar oluşan kayıp ve hasardan biz sorumluyuz (Yönetmelik md. 17)."
    ),
    h2("7. Adres Değişikliği ve Teslim Edilemeyen Gönderiler"),
    p(
      "Teslimat adresini değiştirmek isterseniz siparişiniz kargoya verilmeden önce bize {e_posta} adresinden veya {telefon} numarasından ulaşın. Kargoya verilen gönderide adres değişikliği kargo firmasının olanaklarına bağlıdır."
    ),
    p(
      "Adreste kimse bulunmazsa kargo firması bildirim bırakır ve gönderiyi kendi uygulamasına göre şubede bekletir ya da yeniden teslim etmeyi dener. Adresin eksik veya hatalı olması ya da gönderinin bekleme süresi içinde teslim alınmaması halinde gönderi bize geri döner. Bu durumda sizinle iletişime geçeriz; tercihinize göre ürün yeniden gönderilir ya da sipariş iptal edilerek ödediğiniz tutar iade edilir."
    ),
    h2("8. Hasarlı veya Eksik Teslimat"),
    p(
      "Gönderiyi teslim alırken paketi kontrol etmenizi öneririz. Paket hasarlı, ezik, ıslak veya açılmış görünüyorsa kargo görevlisine hasar tespit tutanağı düzenletin; dilerseniz paketi teslim almayabilirsiniz. Durumu en kısa sürede bize bildirin:"
    ),
    bullets(["E-posta: {e_posta}", "Telefon: {telefon}"]),
    p(
      "Hasarlı, eksik veya yanlış ürün için yeni gönderim, onarım ya da iade masrafları bize aittir. Tutanak düzenlenmemiş olması, ayıplı ürüne ilişkin yasal haklarınızı ortadan kaldırmaz (6502 sayılı Kanun md. 11)."
    ),
    h2("9. Kapıda Ödeme"),
    p(
      "Kapıda ödeme, yalnızca ödeme adımında sunulduğu siparişlerde kullanılabilir. Kapıda ödeme için bir hizmet bedeli alınıyorsa tutarı siparişinizi onaylamadan önce ödeme adımında ayrıca gösterilir ve sipariş toplamına eklenir (Yönetmelik md. 19). Ödeme, kargo görevlisine kargo firmasının kabul ettiği yöntemlerle yapılır."
    ),
    p(
      "Kapıda ödemeli gönderiyi teslim almamanız halinde gönderi bize geri döner ve siparişiniz iptal edilir."
    ),
    h2("10. Hediye Kartları"),
    p(
      "Hediye kartları kargoyla gönderilmez; ödemeniz onaylandığında kartın alıcısına e-postayla iletilir. Hediye kartı için kargo ücreti alınmaz."
    ),
    h2("11. İletişim"),
    bullets([
      "Unvan: {mağaza_unvanı}",
      "E-posta: {e_posta}",
      "Telefon: {telefon}",
      "Adres: {adres}",
    ]),
  ],
}

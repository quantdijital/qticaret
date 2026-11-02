# ADR-0052: Ürün ek seçenekleri (D13)

- **Durum:** Öneri (kullanıcı kararı bekliyor; 2026-11-03 gece taslağı)
- **Tarih:** 2026-11-03
- **İlgili:** D13; docs/gecis/mylarte/envanter.md §4.6; adr/0007 (KDV), adr/0010 (kuruş), adr/0026 §8 (iade tutarı), adr/0029 (ücret satırı deseni), adr/0032 (iade ve değişim), adr/0033 (sipariş düzenleme), adr/0034 (e-fatura), adr/0036 Ek (müşteri metni e-postada), adr/0041 (cayma istisnası, F13.6), docs/13 (feed ve JSON-LD fiyatı)

## Bağlam

İlk müşterinin eski sitesinde iki ek seçenek var:

- **"Ürün Üzerindeki Yazı":** +35 TL/adet; işlenecek adet 1–10; en çok 50 karakter, "yalnızca düz yazı ve rakam"; "Bana özel opsiyonlu siparişlerde iade yapılamaz". Eski sitede işleme adedi ürün adedinden ayrı girilir.
- **"Kılıf"** (tek seçim): Kılıf istemiyorum; Desenli Kahverengi ve Desenli Siyah (+300 TL); Desensiz Kahverengi ve Desensiz Siyah (+250 TL).

Kısıtlar: **kural 5** (fiyat istemciden asla kabul edilmez) ve **sektöre özel kod yok** (özellik "yazı" ve "seçim" türleriyle genel kurulur).

Rakiplerde (docs/20): Shopify'da satır özellikleri fiyatsızdır, ücretli ek uygulamayla gelir (gizli ürün satırı ya da Cart Transform); ikas'ta yok; TR platformlarında var.

**Medusa 2.21.2** (Context7, 2026-11-03):
- Medusa'nın "kişiselleştirilmiş ürün" tarifinde veri satırın `metadata`'sında durur. Fiyat kendi iş akışında hesaplanır ve sepet kilidi altında `addToCartWorkflow`'a `unit_price` olarak verilir. Satır böylece özel fiyatlı olur (`is_custom_price`).
- Aynı varyant farklı `metadata`'yla eklenirse ayrı satır olur. Özel fiyatlı satır yalnız aynı metadata ve aynı birim fiyatla birleşir (`findMatchingLineItem`).
- Vitrinin satır güncelleme ucu yalnız `quantity` ve `metadata` alır. `updateLineItemInCartWorkflow` özel fiyatı korur, yeniden hesaplamaz.
- Satır ayarlaması (adjustment) promosyonun indirimidir: tutar düşülür ve promosyonlar her sepet güncellemesinde ayarlamaları yeniden yazar. Bu Medusa 2.21.2 davranışıdır; görevin başında kaynaktan yeniden doğrulanır.

Bizde hazır olanlar: vitrin `qt_` ile başlayan metadata'yı yazamaz (`refuseReservedMetadata`); kapıda ödeme ücreti sunucunun eklediği özel fiyatlı bir satırdır (`qt_fee`, `protectFeeLine`); KDV oranı ürün tipinden gelir (adr/0007); cayma istisnası ürün düzeyindedir (`withdrawal_excluded`) ve iade kuralı `excludedLines` ile okur; fatura satırı `lib/invoicing/lines.ts`'te ürün ve varyant adıyla yazılır.

## Karar

1. **Model: aynı satır, sunucuda hesaplanan özel birim fiyat** (Medusa'nın kendi tarifi).
   - Birim fiyat iki parçanın toplamıdır:
     - varyantın sepet bağlamındaki fiyatı (Medusa fiyatlaması: bölge, para birimi, müşteri grubu, fiyat listesi);
     - seçilen eklerin birim fiyatları (kuruş, KDV dahil).
   - Ek, satırın **her adedine** uygulanır. Eski sitedeki "işlenecek adet" bizde satır adedidir: 5 bıçağın 2'sine yazı isteyen iki satır ekler.
   - Satır metadata'sı:
     - `qt_addons`: seçim anının kopyası. Her öğede `id`, `kind`, `label`, `value` ya da `choice_label`, `amount` ve `withdrawal_excluded` var.
     - `qt_addons_base`: taban birim fiyat.

     Ek sonradan değişse de sipariş ne satıldığını bilir.

   Yolların karşılaştırması:

   | Yol | Fiyat (kural 5) | Promosyon | KDV | İade ve e-fatura |
   |---|---|---|---|---|
   | **A. Aynı satır, özel birim fiyat (seçilen)** | Sunucuda; vitrin fiyat gönderemez | Satırın tamamına (ek dahil) | Ürünün oranı kendiliğinden | Satır bir bütün; tek fatura satırı |
   | B. Ayrı ek satırı (`qt_addon_of`, ücret satırı deseni) | Sunucuda | Ek ayrı, indirim dışı tutulabilir | Ürünsüz satır bölge oranını (%20) alır; ürünün oranı için doğrulanmamış alan ya da kendi vergi adımımız | Adet eşitleme, birlikte silme ve birlikte iade; iki satır |
   | C. Satır ayarlaması | Pozitif tutar yok | Promosyon yenilemesi siler | — | İndirim gibi görünür |
   | D. Metadata + fiyat kuralı | Fiyat kümesinde | Normal | Normal | Serbest metin fiyat kuralı olamaz; her varyant × ek × fiyat listesi için ayrı fiyat |

   B yalnız "ayrı işleme adedi" ya da "ek ücreti indirime girmesin" şartı çıkarsa seçilir (sorular 1 ve 3).

2. **`product-addons` modülü** (ürüne modül bağlantısı; `catalog-extension` deseni).
   - **Ortak alanlar:** sıra, tür, ad (en çok 60), yardım metni (en çok 160), zorunlu, satır başına en çok adet (1–99, boşsa sınırsız), cayma dışı (`withdrawal_excluded`), etkin.
   - **Yazı (`text`):**
     - fiyat;
     - uzunluk 1–200 (varsayılan 50);
     - karakter kümesi: `letters_digits` (Türkçe dahil harf, rakam, boşluk) ya da `text` (bunlara ek olarak `. , ' - &`).
   - **Seçim (`choice`):** 2–20 seçenek; her seçenekte ad ve fiyat.
   - **Sınırlar:** ürün başına en çok 5 ek; fiyat 0–10.000 TL; yalnız TRY (çok para birimi F19'da).
   - **Ücretli ek zorunlu olamaz** (`addons.required_must_be_free`). Sayfanın, feed'in ve JSON-LD'nin fiyatı taban fiyattır; zorunlu ücretli ek bu eşitliği bozardı (docs/13, kural 11).

3. **Vitrin ucu:** `POST /store/carts/:id/addon-lines`, gövdesi `{ variant_id, quantity, addons: [{ addon_id, value | choice_id }] }`. İş akışı sepet kilidi altında şunları yapar:
   1. Sepetin açık ve bu vitrinin olduğunu denetler.
   2. Eklerin ürüne ait ve etkin olduğunu, zorunluların bulunduğunu denetler.
   3. Yazıyı temizler ve doğrular:
      - NFC'ye çevrilir, kırpılır, ardışık boşluklar teke iner;
      - karakter kümesi ve uzunluk denetlenir;
      - denetim ve biçim karakterleri reddedilir;
      - bağlantıya benzeyen metin (`://`, `www`, `@`, alan adı biçimi) reddedilir. Bu, adr/0036 Ek'teki süzgeçtir: sipariş veren, başkasının adresine mağaza e-postasıyla bağlantı yollayamasın.
   4. Adedi eklerin sınırına göre denetler.
   5. Fiyatı hesaplar ve `addToCartWorkflow`'u `unit_price` ve `qt_addons` ile çağırır.

   Hatalar alan bazlıdır: `addons.text_too_long`, `addons.charset`, `addons.required`, `addons.max_quantity`. Ürün yüküne `addons` alanı eklenir; vitrin canlı toplamı yalnız göstermek için hesaplar.

4. **Çekirdek uçların korunması.**
   - `POST /store/carts/:id/line-items`: ürünün zorunlu eki varsa reddedilir (`addons.required`). İsteğe bağlı eki olan ürün eksiz eklenebilir.
   - `qt_addons`'lu satırın `metadata`'sı değiştirilemez (`addons.line_locked`). Adet değişebilir ama ekin sınırını aşamaz; özel fiyat korunur.

5. **Fiyat tutarlılığı.**
   - Medusa özel fiyatlı satırı yenilemez. Fiyat listesi biterse ya da müşteri giriş yapıp grubu değişirse taban fiyat eskir.
   - Bu yüzden iki yerde her ekli satırın beklenen birim fiyatı yeniden hesaplanır:
     - ödeme başlatmada, `applyPaymentFeeStep`'in yanında;
     - `completeCartWorkflow.hooks.validate` içinde.
   - Fiyat farklıysa satır yeni fiyata çekilir ve 409 `cart.prices_changed` döner. Vitrin sepeti yeniden gösterir; müşteri yeni toplamı görüp yeniden onaylar (mesafeli satışta son fiyat onaydan önce görünür).
   - Eki silinmiş ya da pasif olan satır `addons.unavailable` ile durur.
   - Üstü çizili fiyat: `compare_at_unit_price` = taban karşılaştırma fiyatı + ekler. Bu alanın özel fiyatlı satırda korunup korunmadığı doğrulanacak.

6. **Promosyon.** İndirim satırın tamamına uygulanır, ek ücreti dahil; Medusa satır ara toplamından hesaplar. Panelin ek düzenleyicisi bunu not olarak söyler.

7. **KDV.** Satırın ürününün oranı birim fiyatın tamamına uygulanır: ek ücret asıl teslimin parçasıdır ve matraha dahildir (KDV K. md. 24/c). `docs/mali-musavir-sorulari.md`'ye soru olarak eklenir.

8. **İade.**
   - **Cayma dışı ek:** `qt_addons` içinde `withdrawal_excluded` bir ek varsa satır cayma hakkı dışındadır; `excludedLines` buna göre genişler. Satır yalnız kusurlu ya da yanlış gelirse döner (MSY md. 15/1-ç). Bayrak satırdaki kopyadan okunur; ekin sonraki değişikliği geçmiş siparişi etkilemez.
   - **Para iadesi:** satırın birim fiyatıyla yapılır, ek dahil (adr/0026 §8 defteri değişmez). Kılıf gibi cayma içi ek, ücretiyle birlikte normal iade edilir.
   - **Değişim (adr/0032 §6):** ek taşınmaz. Kusurlu kişiye özel ürün için iade + yeni sipariş yapılır (adr/0051 bağlantısı).
   - **Sipariş düzenleme (adr/0033):** ekli satır azaltılabilir ya da silinebilir. Panelden ekli satır eklenmez (v1).
   - **Vitrin uyarısı:** ürün sayfasında seçimin altında "Bu seçenekle alınan ürün kişiye özeldir, cayma hakkı kapsamı dışındadır" yazar. Ön bilgilendirme formu cayma dışı satırları adlandırır; yasal metin danışman onayına işaretli kalır.

9. **Gösterim.**
   - **Sepet, ödeme, müşterinin sipariş sayfası ve sipariş e-postası:** satırın altında "Ürün üzerine yazı: Ahmet (+35,00 TL)" ya da "Kılıf: Desenli Siyah (+300,00 TL)". Birim fiyat ekler dahildir. Değer şablon katmanında kaçışlanır.
   - **Panel sipariş sayfası, kargoya hazır listesi ve yazdırma:** değer tam gösterilir (üretim için).
   - **Personelin yeni sipariş e-postası ve zili:** yalnız ek adı gösterilir (adr/0047 §5 gerekçesi).
   - **Fatura:** satır açıklamasına ek adı eklenir ("… - Ürün üzerine yazı"). Yazılan metin girmez: 10 yıl saklanan belgede kişi adı olabilir. Ayrı fatura satırı yoktur.

10. **KVKK.** Yazı müşterinin verisidir ve siparişle saklanır. KVKK silmesinde (L9) `qt_addons` değerleri "—" olur; ek adı ve tutarı kalır. Loglara değer yazılmaz. Envantere satır eklenir.

11. **Panel: ürün sayfasında "Ek seçenekler" kartı** (fiyat kartının altında).
    - Liste: ad, tür, fiyat, "iade dışı" rozeti, sıra.
    - "Ek ekle" yan paneli: tür, ad, açıklama, fiyat; yazı için sınırlar ve karakter kümesi, seçim için seçenek satırları (yukarı/aşağı düğmeli); adet sınırı; "Kişiye özel: cayma hakkı dışında" kutusu.
    - "Başka üründen kopyala" var; toplu düzenleme ve Excel sütunları sonraki adımdır. Yazma katalog yetkisiyle (`owner`, `admin`), denetim kaydına düşer.

12. **İlk müşterinin kurulumu (veri, kod değil).**
    - "Ürün üzerine yazı": yazı, 1–50 karakter, `letters_digits`, +35 TL, satırda en çok 10 adet, cayma dışı.
    - "Kılıf": seçim, dört seçenek (+300, +300, +250, +250), isteğe bağlı, cayma içi. "Kılıf istemiyorum" seçilmemiş haldir.

## Alternatifler

| Seçenek | Artı | Eksi |
|---|---|---|
| **Ek seçenek modülü, aynı satır (seçilen)** | Sektörden bağımsız; fiyat, KDV ve iade tek satırda tutarlı | Özel fiyatlı satırın taban fiyatı eskiyebilir (§5 korur); indirim eke de uygulanır |
| Kılıfı varyant ekseni yapmak | Stok takibi, Medusa'nın kendi yolu | Varyant sayısı katlanır (28 × 5); yazı varyant olamaz |
| Kılıfı ayrı ürün + sepette öneri | Stok takibi, ayrı fatura satırı | Ürüne bağlı seçim deneyimi kaybolur; çapraz satış henüz yok |
| Fiyatsız satır notu + personel farkı elle tahsil eder | Kod çok az | Kural 5'e aykırı ödeme dışı tahsilat; fatura ve iade tutmaz |

## Sonuçlar

- **Backend:** `modules/product-addons` ve ürün bağlantısı; `workflows/addons/{save,add-line,reprice}.ts`; `/admin/products/:id/addons*`, `POST /store/carts/:id/addon-lines`; satır koruma ara katmanı; `excludedLines`, e-posta şablonu, fatura açıklaması ve KVKK silmesi için ekler.
- **Vitrin:** ürün sayfasında ek alanları (canlı toplam ve uyarı); sepet, ödeme ve sipariş satırlarında ek satırları.
- **Panel:** ürün sayfasında kart; sipariş sayfasında ve kargoya hazır listesinde ekler.
- **Testler:**
  - Birim: karakter kümesi (Türkçe harfler, NFC), bağlantı süzgeci, kuruş toplamı.
  - HTTP `product-addons.spec`:
    - istemci fiyat ya da `qt_addons` gönderemez;
    - satır fiyatı taban + ek;
    - aynı yazı birleşir, farklı yazı ayrı satır olur;
    - zorunlu ek çekirdek uçta reddedilir;
    - adet sınırı ve metadata kilidi;
    - fiyat listesi bitince ödeme başlatma 409 verir ve satır yeni fiyatta olur;
    - promosyon satırın tamamına uygulanır;
    - cayma dışı satır yalnız kusurla iade talebine girer;
    - faturada yazı yok;
    - KVKK silmesinde yazı gider;
    - e-postada kaçış.
  - e2e: ürün sayfası → sepet → ödeme özeti.

## Boyut ve bağımlılıklar

- **Boyut: M, yaklaşık 4 gün** (testler dahil): backend 2, panel 1, vitrin 0,5–1.
- **Bağımlılıklar:** `catalog-extension` ve iade kuralı (F13.6); ödeme başlatma ve tamamlama kancaları (adr/0026, adr/0029); e-fatura satırları (adr/0034); sipariş e-postası (adr/0036); KVKK silmesi (L9); vitrin ürün sayfası (D5).
- **Kod dışı:** KDV sorusu mali müşavire; cayma uyarısı ve ön bilgilendirme metni danışmana (danışman yok; taslak işaretli kalır).

## Kullanıcıya sorular

1. **İşleme adedi:** Eski sitede işleme adedi ürün adedinden ayrıydı. Öneri: yazı satırdaki her adede uygulanır; farklı adet için müşteri ikinci satır ekler. Uygun mu? Ayrı adet şartsa ayrı ek satırı modeline (B) geçilir; yaklaşık 1–2 gün daha.
2. **Kılıf:** Kılıf ek seçenek olsun (stok tutmaz), yoksa stoğu izlenen ayrı ürün mü?
3. **İndirim:** Kampanya indirimleri ek ücretine de uygulanır. Bu kabul mü?
4. **Faturada yazı:** Faturada yalnız ek adı ("Ürün üzerine yazı") görünsün, yazılan metin görünmesin. Uygun mu?

# ADR-0052: Ürün ek seçenekleri (D13)

- **Durum:** Kabul (2026-11-03, kullanıcı: "önerilerine uyuyorum")
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
- **Kod dışı:** KDV sorusu mali müşavire; cayma uyarısı ve ön bilgilendirme metni danışmana (danışman yok; taslak işaretli kalır). **Kullanıcı (2026-11-03): "kişiye özel cayma hakkı yoktur doğru"** — cümle ve kapsam onaylandı; TASLAK işareti avukat gelene kadar kalır.

## Kullanıcıya sorular

1. **İşleme adedi:** Eski sitede işleme adedi ürün adedinden ayrıydı. Öneri: yazı satırdaki her adede uygulanır; farklı adet için müşteri ikinci satır ekler. Uygun mu? Ayrı adet şartsa ayrı ek satırı modeline (B) geçilir; yaklaşık 1–2 gün daha.
2. **Kılıf:** Kılıf ek seçenek olsun (stok tutmaz), yoksa stoğu izlenen ayrı ürün mü?
3. **İndirim:** Kampanya indirimleri ek ücretine de uygulanır. Bu kabul mü?
4. **Faturada yazı:** Faturada yalnız ek adı ("Ürün üzerine yazı") görünsün, yazılan metin görünmesin. Uygun mu?

Cevaplar (2026-11-03): dört soruda da öneri kabul edildi. Yazı satırın her adedine uygulanır; kılıf ek seçenektir; indirim eke de uygulanır; faturada yalnız ek adı görünür.

## Uygulama notları (backend, 2026-11-03)

**Karardan sapmalar** (ADR'nin yolu korunur: aynı satır, sunucuda hesaplanan özel birim fiyat):

- **Depolama:** Ayrı `product-addons` modülü yerine `product_extension.addons` JSON sütunu kullanıldı (`{ items: [...] }`; migration `Migration20261103055421`). Ürün başına en çok 5 ek var ve ürünle birlikte okunur. Ürün bağlantısı zaten vardı; ayrı tablo ve link gerekmedi.
- **Yazma:** Ekler ürünün katalog ucundan kaydedilir: `POST /admin/products/:id/catalog { addons }`. Ayrı `/admin/products/:id/addons*` ucu yok. Denetim kaydı katalog kaydıyla düşer.
- **Etkin alanı yok:** Ek silinince onu taşıyan sepet satırı ödemede `addons.unavailable` ile durur.
- **Seçim sayısı:** Seçim türünde 2–10 seçenek var (taslakta 2–20).
- **Vitrin ucu satır düzeyinde:** Taslaktaki `addon-lines` yerine `POST /store/carts/:id/line-items/:line_id/addons`. Satır önce çekirdek uçla eklenir, sonra ekleri seçilir.
  - Zorunlu ek, çekirdek ekleme ucunda değil; ödeme başlatmada ve tamamlamada denetlenir (`addons.required`).
  - Yalnız ücretsiz ek zorunlu olabilir.
- **Ürün sayfasının okuması:** Ürün yüküne alan eklenmedi. `GET /store/products/:id/addons` bayrak kapalıyken 404 verir; ürün yükünden okunsaydı bayrak süzülemezdi.
- **Fiyatlar:** JSON'da lira (Medusa'nın tutar biçimi) tutulur. Hesap kuruşla yapılır.
- **Tamamlamada eskime:** `completeCartWorkflow` sepet kilidini tutar; Medusa'nın satır iş akışları orada çalışamaz. Bu yüzden tamamlama satırı düzeltmez, yalnız 409 `cart.prices_changed` döner. Satırı yeni fiyata ödeme başlatma çeker (409 ile durur); müşteri yeni toplamı görüp ödemeyi yeniden başlatır.
- **Silme işareti:** KVKK silmesi yazıyı "—" yapar; ek adı, seçim ve tutar kalır.
- **Kapsam dışı (açık):** panelden ekli satır düzenleme (adr/0033). Personelin yeni sipariş e-postası satır listelemez (yalnız adet); ek adı orada da yok.
- **Sonradan eklenenler (2026-11-03):**
  - **İletiler:** `order.placed`, `order.shipped`, `order.delivered` ve `return.*` e-postaları her seçimi satırın altında yazar: "Kılıf: Desenli Siyah (+₺300,00)", ücretsiz seçimde tutar yok. Fiyatsız listelerde (koli içeriği, iade talebi) seçimler tutarsız yazılır. Cayma dışı satırın altında "Kişiye özel ürün: cayma hakkı yok" notu çıkar. SMS metinleri değişmedi.
  - **Sözleşmeler:** ön bilgilendirme formu ve mesafeli satış sözleşmesinin sipariş kopyası (ve ödeme adımındaki sepet metni) cayma dışı her satırı ürün ve seçimiyle adlandırır, MSY md. 15/1-ç cümlesiyle. Blok, metnin "cayma" geçen ilk başlığının bölümünün sonuna sunucu tarafından konur; böyle başlık yoksa metnin sonuna. Mağaza bu belirteci yazamaz (`kişiye_özel_ürünler`, sipariş belirteci değil). Cümle taslaktır, avukat onayı bekler (docs/12). Ürün düzeyindeki `withdrawal_excluded` işareti (F13.6) bu cümleye girmez: istisnanın dayanağı ürüne göre değişir.
  - **Vitrin:** `GET /store/storefront` → `features.product_addons` (bayrak `catalog.addons`). Kapalıyken vitrin ek uçlarını çağırmaz.
  - **Geri alma:** ek kaldırmanın telafisi satırın yalnız `qt_addons` anahtarını eski hâline getirir (önceden yoksa `""`); başka adımların yazdığı anahtarlara dokunmaz.

**Medusa 2.21.2 (Context7, 2026-11-03, testle doğrulandı):**

- `updateLineItemInCartWorkflow`'a `update.unit_price` verilince satır özel fiyatlı olur (`is_custom_price: true`). Verilmezse eski fiyat ve işaret korunur; özel fiyat bu akışla kaldırılamaz.
  - Ek kaldırma bu yüzden satırı cart modülüyle `is_custom_price: false` yapar. Ardından `refreshCartItemsWorkflow`'u `force_refresh` ile çalıştırır; satırı Medusa kendi fiyatlamasıyla yeniden fiyatlar.
- İç içe çalışan iş akışında `acquireLockStep` kilit almaz. Ekleri yazan akış sepet kilidini kendisi alır, Medusa'nın satır güncelleme ve yenileme akışlarını iç içe çalıştırır.
- Promosyon ayarlamaları her sepet güncellemesinde yeniden hesaplanır. Özel fiyatlı satır da indirime girer: kod önce, ekler sonra seçilse de indirim yeni birim fiyattan çıkar (test: %10, 1.335 TL satırda 133,50 TL).
- `compare_at_unit_price` güncellemede taşınır. Satış listesindeyken üstü çizili fiyat "liste öncesi fiyat + ekler" olarak yazılır.
- Fiyat bağlamı: para birimi, bölge, müşteri ve grupları (`customer.groups.id`), satır adedi. Grup fiyat listesi testle doğrulandı.
- Satır metadata'sı sipariş satırına geçer; `qt_addons` siparişte kalır.
- Satır ve JSON sütunu güncellemeleri birleştirir: üst düzey anahtarlar eklenir, iç içe nesne bütün olarak değişir, boş dize anahtarı siler. Ek kaldırma `qt_addons: ""` yazar. Ürünün ekleri bu yüzden `{ items }` içinde tutulur; her kayıt listeyi bütün olarak değiştirir.
- Satır adedi çekirdek uçla değişince özel fiyat korunur (test).
- Medusa'nın doğrulayıcısı boyut hatalarını kendi cümlesiyle yazar. Panel i18n anahtarını alsın diye sınırlar `refine` ile denetlenir.

**Sözleşme (vitrin):**

- `GET /store/products/:id/addons` → `{ addons: [{ id, kind: "text"|"choice", label, help, required, max_quantity, non_withdrawable, price?, text?: { max_length, charset }, choices?: [{ id, label, price }] }] }`. Bayrak kapalıysa ya da ürün bu vitrinin yayımlanmış ürünü değilse 404.
- `POST /store/carts/:id/line-items/:line_id/addons` → gövde `{ selections: [{ addon_id, value? , choice_id? }] }` (en çok 5; boş liste ekleri kaldırır). Fiyat, birim fiyat ya da `qt_` gönderilirse 400 döner. Yanıt `{ line: { id, quantity, unit_price, compare_at_unit_price, is_custom_price, addons } }`.
- Hata anahtarları: `addons.unknown`, `addons.duplicate`, `addons.text_required`, `addons.text_too_long`, `addons.charset`, `addons.text_link`, `addons.max_quantity`, `addons.not_addon_line`, `cart.line_unknown`.
- Satırın ekleri: `item.metadata.qt_addons` = `{ items: [{ addon_id, kind, label, value?, choice_id?, choice_label?, amount, non_withdrawable }], base, non_withdrawable, max_quantity }`. Tutarlar birim başına lira.
- Çekirdek satır ucu: ekli satırın `metadata`'sı değiştirilemez (`addons.line_locked`). Adet, ekin sınırını aşamaz (`addons.max_quantity`).
- Ödeme başlatma ve tamamlama: 409 `cart.prices_changed` gelirse sepet yeniden okunur ve gösterilir, ödeme yeniden başlatılır. 400 `addons.unavailable`, `addons.required` ya da `catalog.addons_disabled` gelirse satır düzeltilir.

**Vitrinin yapacakları:**

- **Ürün sayfası:** ek formu (yazı alanı uzunluk ve karakter kümesiyle; seçim için radyo, "istemiyorum" seçilmemiş hâldir) ve canlı toplam (yalnız gösterim).
  - `non_withdrawable` ekte uyarı: "Bu seçenekle alınan ürün kişiye özeldir, cayma hakkı kapsamı dışındadır."
  - Sepete ekleme iki adımdır: önce çekirdek ekleme, sonra `.../addons`. Fiyat etiketi "Fiyat + ekler".
- **Sepet, ödeme özeti, müşterinin sipariş sayfası:** satır altında "Ürün üzerine yazı: Ahmet (+35,00 TL)" ya da "Kılıf: Desenli Siyah (+300,00 TL)". Değer kaçışlanır. Birim fiyat ekler dahil gösterilir.
- **Ön bilgilendirme formu:** cayma dışı satırlar adlandırılır (yasal metin danışman onayına işaretli kalır).

**Panelin yapacakları:**

- **Ürün sayfası:** fiyat kartının altında "Ek seçenekler" kartı.
  - Liste: ad, tür, fiyat, "cayma dışı" rozeti, sıra.
  - "Ek ekle" yan paneli: tür, ad, açıklama, fiyat, yazı sınırları ve karakter kümesi, seçenek satırları, adet sınırı, "Kişiye özel: cayma hakkı dışında" kutusu.
  - Kayıt `POST /admin/products/:id/catalog { addons }` ile yapılır. Mevcut eklerin `id`'si geri gönderilir, yoksa sepetteki satırlar `addons.unavailable` olur.
  - Bayrak kapalıyken kart gizlenir (`catalog.addons_disabled`). İndirimin eke de uygulandığı not olarak yazılır.
- **Sipariş sayfası ve kargoya hazır listesi:** satırın ekleri `metadata.qt_addons`'tan okunur; değer üretim için tam gösterilir.
- **İade talepleri:** cayma dışı satırda "cayma dışı" rozeti. Kural sunucuda: `returnable-lines` yanıtında `withdrawal_excluded: true` olur; yalnız kusurlu ya da yanlış gelen ürün kabul edilir.
- **Ayarlar > Özellikler:** `catalog.addons` bayrağının metni (`qticaret.features.catalog_addons.label`/`.description`).

## Ek (2026-11-03): madde atfı ve ürün düzeyindeki işaret

**Dayanak:** Mesafeli Sözleşmeler Yönetmeliği md. 15/1, mevzuat.gov.tr işlenmiş metni (MevzuatNo 20237), 2026-11-03'te kontrol edildi. Ayrıntı adr/0032 Ek 2026-11-03'te.

1. **Kişiye özel ürünün dayanağı md. 15/1-b'dir:** "tüketicinin istekleri veya kişisel ihtiyaçları doğrultusunda hazırlanan mallara ilişkin sözleşmeler".
   - md. 15/1-ç, koruyucu ambalajı açılmış ve iadesi sağlık ve hijyen açısından uygun olmayan maldır.
   - Bu ADR'deki "15/1-ç" atıfları (§8 ve "Uygulama notları > Sözleşmeler") 15/1-b okunur.
   - `lib/catalog/addons/schema.ts` yorumu düzeltildi. Sözleşme bloğunun cümlesi (`lib/legal/withdrawal.ts`) yasal metin dalında düzeltildi. Panelin `nonWithdrawableHint` metni panel işidir.
   - `returns.withdrawal_excluded` hata metni artık "hijyen" demiyor: kişiye özel ürün, teslim edilen dijital içerik ya da ifa edilen hizmet.
2. **Ürün düzeyindeki `withdrawal_excluded` işareti** ürünün türüne göre okunur (`lib/orders/withdrawal-rules.ts` `productMarkOf`):
   - **Fiziksel ürün:** hijyen ürünüdür (15/1-ç). Ambalajı açılmadıkça cayma hakkı sürer. Talep kabul edilir; satır `withdrawal_excluded: false` ve `withdrawal_warning: "sealed_goods"` taşır (mağaza ve panel).
   - Personel teslim almada ambalajı açılmış birimi reddeder (`refused`, adr/0032 Ek §4).
   - JSON-LD bu üründe artık `MerchantReturnNotPermitted` demez; mağazanın iade süresini yazar.
   - **Dijital ya da hizmet ürünü:** teslim ya da ifa edilince kesin istisnadır (15/1-ğ, h): `withdrawal_excluded_reason: "product"`.
   - Kişiye özel ek (§8) değişmedi: satır cayma dışıdır, yalnız kusurla döner.
3. **Açık:** Bütünü kişiye özel üretilen ama eki olmayan bir fiziksel ürünü işaretleyecek ayrı bir alan yok. Böyle üründe ücretsiz, zorunlu ve "kişiye özel" işaretli bir ek kullanılır (§2: ücretsiz ek zorunlu olabilir). Ürün düzeyinde ikinci bir işaret gerekirse ayrı karar.

## Ek (2026-11-09): KVKK silmesi yazının her kopyasını siler

**Bulgu (testle doğrulandı, `integration-tests/http/addon-erasure.spec.ts`):** §10'daki silme yalnız sipariş satırını (`order_line_item.metadata`) ve sepet satırını değiştiriyordu. Yazı silmeden sonra şu yerlerde kalıyordu:

- **`order_item.metadata`, siparişin her sürümünde:** Medusa 2.16'dan beri sipariş kaleminin metadata'sını sürümlü kayıtta da tutar ve sipariş açılırken her sürüme kopyalar. Sipariş düzenleme ve teslim her biri yeni sürüm açar. Tutarlarıyla okunan sipariş `items.metadata`'yı bu kayıttan verir. Bu yüzden yazı panelin sipariş sayfasında (`GET /admin/orders/:id`), sipariş e-postası yükleyicisinde (`loadOrderMessage`; kargo ve iade e-postaları da aynı alanı okur) ve sözleşme metnini kuran okumada görünmeye devam ediyordu. `lineMetadataOf` ile okuyanlar (koli fişi, sipariş listesi, dışa aktarma satırları) satırın kendi kaydını öne aldığı için temizdi. Fatura yazıyı hiç yazmaz.
- **`workflow_execution.context`:** Medusa tamamlanan `complete-cart` çalışmasını 3 gün saklar (aynı sepetin yeniden tamamlanması aynı siparişi döndürsün diye). Bağlamı bütün sepettir; e-posta, adresler ve satır metadata'sı da içindedir.
- **Sipariş listesi dosyaları (`order.export`, 7 gün):** her dosya listelenen siparişlerin alıcısını, adresini ve ek yazılarını taşır. Hangi siparişleri içerdiği kaydedilmez.

**Karar:**

1. Silme her kopyayı kendi içeriğinden yeniden yazar (`workflows/legal/erasure/order-lines.ts` `rewriteOrderLines`): sipariş satırı (`listOrderLineItems` + `updateOrderLineItems`), siparişin bütün sürümlerinin kalemleri (Medusa'nın üretilmiş `listOrderItems`'ı ve `updateOrderItem` seçici biçimi `{ selector: { id }, data: { metadata } }`) ve sepet satırı. Her sürüm kendi metadata'sından yeniden yazılır; sürümler arasında farklı olan anahtarlar korunur.
2. Yazı "—" olur (`ERASED_TEXT`). Ek adı, seçim, tutar ve `non_withdrawable` kalır; muhasebe ve cayma kuralı değişmez. Tekrar çalışınca başka bir şey değişmez.
3. Hediye kartı alıcısı (`qt_gift`, adr/0025 Ek 2026-11-03) aynı açığa sahipti ve aynı yardımcıyla silinir.
4. Silinen siparişlerin sepetlerinin bitmiş çalışmaları (`done`, `failed`, `reverted`) silinir (`erasure/stored-copies.ts` `eraseCheckoutRuns`). Çalışma sepeti yalnız bağlamında (`data.payload.id` ya da `cart_id`) andığı için kimlikler bu tablodan dar bir SQL okumasıyla bulunur. Silme motorun üretilmiş `deleteWorkflowExecutions`'ı ile yapılır (anahtar: `workflow_id`, `transaction_id`, `run_id`). Süren çalışmaya dokunulmaz.
5. Bir silme, saklanmakta olan bütün sipariş listesi dosyalarını siler ve işlerini dosyasız bırakır (`expireOrderExports`). Liste panelden yeniden alınır.

**Kalanlar (bilerek):**

- Gönderilmiş e-postanın kendisi alıcının posta kutusundadır, platformun elinde değildir. `notification` kaydı yalnız kimlik tutar; testte de yazı orada çıkmadı.
- Sözleşme kopyası (`legal_order_copy`, şifreli) yazıyı cayma dışı satırın adında taşır. Yasal saklama süresince kilitli kalır, süre dolunca silinir. Bu, kopyadaki ad ve adresle aynı kuraldır.
- Vitrinin sipariş sayfası silmeden sonra açılmaz (404).

## Ek (2026-11-23): ek seçenek şablonları

**Bağlam:** Sahip (2026-11-23): "Ürün ek seçenekleri ayarları ürün sayfasındaki Ek seçenekler kartında. Bunu tüm ürünlere uygula gibi bir seçeneğim yok; ayrıca bu ürün özellikleri içinde olabilir." Aynı eki ("Bıçağa isim kazıma, +150 TL") onlarca ürüne tek tek girmek ve fiyat değişince hepsini tek tek düzeltmek gerekiyordu. Önerilen tasarım onaylandı.

**Karar:**

1. **Model.**
   - `addon_template` tablosu `product-attributes` modülünde: `id` (`adtpl_`), `name` (en çok 60), `addons` (ürünün kendi ekleriyle aynı `{ items }` biçimi ve aynı doğrulama: tür, sınırlar, ücretli ek zorunlu olamaz, en çok 5; şablon önce yalnız adıyla, eksiz oluşturulabilir). Migration `Migration20261123120000` (elle yazıldı, anlık görüntü güncellendi).
   - Ürün ↔ şablon: çoktan çoğa modül bağlantısı (`links/product-addon-template.ts`; tablo `db:migrate` ile senkronlanır). Canlı bağdır, kopya değildir: ürün şablonun eklerini her okumada şablondan alır.
   - Özellik şablonu ↔ ek şablonu: `attribute_template.addon_template_ids` (sıralı kimlik listesi, JSON). Özellik şablonunu kullanan her ürün bu şablonların eklerini alır.
2. **Etkin ekler ve sıra** (`lib/catalog/addons/templates.ts` `effectiveAddons`, saf):
   - Önce ürünün kendi ekleri, sonra özellik şablonunun taşıdıkları (listedeki sırayla), sonra ürüne doğrudan bağlı şablonlar (ada göre, Türkçe sıralama).
   - İki yoldan gelen şablon bir kez sayılır (özellik şablonundan gelmiş sayılır). Aynı ek kimliği ikinci kez gelirse atlanır.
   - Ek kimlikleri şablonda bir kez verilir ve değişmez; sepet satırı eki kimliğiyle andığı için şablon eki ürünün kendi ekiyle aynı biçimde fiyatlanır.
3. **Sınır:** ürün başına en çok 5 ek kalır; şablon ekleri buna sayılır. Yazma yollarında denetlenir:
   - ürüne şablon bağlama ve ürünün kendi eklerini kaydetme: toplam 5'i aşıp artıyorsa `addons.too_many` (azalan kayıt hep geçer);
   - şablonun ek sayısını artırma ve özellik şablonuna şablon ekleme: kullanan bir ürün 5'i aşacaksa `addon_templates.too_many`;
   - toplu atama: aşacak ürün atlanır ve raporda yazılır.
   - Ürünün özellik şablonu değişince denetim yoktur (o akışa dokunulmadı). Okuma bu durumda ilk 5'i verir (kendi ekleri önce); panel kartı gizli kalan sayıyı uyarı olarak gösterir (`addons_hidden`). Vitrin sözleşmesinin 5 sınırı böylece hiç aşılmaz.
4. **Okuma yolları** tek çözücüden geçer (`workflows/addons/effective.ts`): vitrin `GET /store/products/:id/addons`, sepet satırının fiyatlanması (`set-line`), ödeme başlatma ve tamamlamadaki yeniden fiyatlama (`reviewAddonLines`) ve ürün kartındaki hızlı ekleme (zorunlu ek varsa kapalı). Fiyat yine sunucuda hesaplanır (kural 5); hesap değişmedi.
5. **Şablon değişince, kalkınca, silinince:**
   - **Ürünler:** hemen etkilenir (canlı bağ).
   - **Sepetler:** §5'teki kurallar aynen geçerlidir. Fiyat değiştiyse ödeme başlatma 409 `cart.prices_changed` ile satırı yeni fiyata çeker. Ek ya da seçim kalktıysa (bağ kaldırıldı, şablon silindi, ek çıkarıldı) satır `addons.unavailable` ile durur.
   - **Siparişler:** değişmez. Satır `qt_addons` kopyasını (ad, değer, tutar, cayma işareti) taşır; şablon kimliği kopyaya yazılmaz, gerek yok.
   - **Silme:** kullanımdaysa da yapılır. Önce ürün bağları kaldırılır, sonra özellik şablonlarından çıkarılır, en son şablon yumuşak silinir. Her adımın telafisi vardır; panel onay penceresi kaç üründen kalkacağını söyler.
6. **Uçlar** (ince route, iş akışında doğrulama):
   - `GET/POST /admin/addon-templates`, `GET/POST/DELETE /admin/addon-templates/:id`;
   - `POST /admin/products/:id/addon-templates { template_ids }` (bütün liste);
   - `POST /admin/attribute-templates/:id/addon-templates { addon_template_ids }` (bütün liste, sıralı);
   - toplu düzenleme işi `catalog.bulk_edit`, değişiklik `{ action: "addon_template", mode: "add" | "remove", template_id }`. Seçili ürünler, bir kategori ya da bütün katalog listenin süzgeci ve "hepsini seç" ile seçilir (en çok 1.000 ürün).
   - Bayrak: ek yazmak ya da bağ kurmak `catalog.addons` ister; bağ kaldırmak ve silmek istemez.
   - Ürün kopyalama, kaynağın doğrudan bağlı şablonlarını da bağlar; özellik şablonu zaten kopyalanıyordu.
7. **Yetki ve denetim:** katalog yazmasıyla aynıdır. Uçlar sahip ve yönetici içindir, `operations` reddedilir (izin tablosu testi); plan kapısında katalog alanındadır. Denetim kaydı önce/sonra tutar: şablonun adı ve ekleri, ürünün bağlı şablonları, özellik şablonunun taşıdıkları (`audit/resources/addon-templates.ts`). Toplu işte her ürünün kendi kaydı vardır.
8. **Panel:**
   - **Ayarlar > Ürün özellikleri:** özellik şablonlarının altında "Ek seçenek şablonları" tablosu. Satıra tıklayınca şablonun kendi sayfası açılır (`/settings/attributes/addon-templates/:id`). Sayfada ad kartı ve ekler kartı vardır; ek, ürün sayfasındaki tek ek penceresiyle eklenir ya da düzenlenir. Sağ sütunda kullanım (doğrudan bağlı ürün sayısı, taşıyan özellik şablonları), başlık menüsünde silme yer alır. Pencere üstünde pencere açılmaz. "Şablon oluştur" yalnız adı sorar, şablonu oluşturup sayfasına götürür.
   - **Ürün sayfası, özellik şablonu değişirken:** yeni şablonun taşıdığı ekler ürünü 5'in üstüne çıkaracaksa ya da zorunlu bir ek gizlenecekse kaydetmeden önce uyarı çıkar; kayıt engellenmez.
   - **Ürün sayfası "Ek seçenekler" kartı:** bağlı şablonların ekleri salt okunur görünür. Şablonun nereden geldiği yazar ("Şablon" ya da "Özellik şablonundan"). Doğrudan bağlı olan buradan kaldırılır. "Şablon ekle" sığmayan şablonu gösterir ama seçtirmez.
   - **Toplu düzenleme:** "Ek seçenek şablonu ata / kaldır".
   - **Özellik şablonu penceresi:** "Ek seçenekler" sekmesi (bayrak açıkken ya da şablon taşıyorsa).
9. **SEO ve vitrin:** etkisi yok. Ürün yükü, JSON-LD ve feed fiyatı değişmez; ücretli ek zorunlu olamadığı için taban fiyat eşitliği korunur. Vitrinin sözleşmesi aynıdır; şablon ekleri ürünün kendi ekleri gibi gelir.

**Alternatifler:**

| Seçenek | Artı | Eksi |
|---|---|---|
| **Canlı bağlı şablon (seçilen)** | Bir değişiklik bütün ürünlere; kimlikler sabit, sepet ve sipariş kuralları aynen geçerli | Okumada bir sorgu daha; 5 sınırı birden çok yerde denetlenir |
| "Tüm ürünlere kopyala" (toplu kopya) | Okuma değişmez | Fiyat değişince yine her ürün tek tek düzeltilir; kopyalar zamanla ayrışır |
| Ekleri özellik şablonuna gömmek (yalnız 3. yol) | Tek yer | Özellik şablonu olmayan ya da farklı şablonlu ürünlerde kullanılamaz |
| Ürün başına sınırı kaldırmak | Basit denetim | Vitrin ve sepet sözleşmesi (en çok 5 seçim) değişirdi |

**Testler:**
- Birim: `lib/catalog/addons/__tests__/templates.unit.spec.ts` (birleştirme, sıra, tekrar, sınır, fiyatın değişmediği) ve `bulk-edit/__tests__/plan-addon-template.unit.spec.ts`.
- HTTP: `integration-tests/http/addon-templates.spec.ts` (CRUD, ürün/toplu/özellik şablonu bağı, düzenlemenin ürüne yansıması, sepet fiyatı, şablon değişip silinince siparişin değişmemesi, bağ kalkınca sepetin durması, yetki reddi).
- Panel: `addon-templates.spec.tsx`, `bulk-form.spec.ts`, `attributes/form.spec.ts`.

**Güvenlik incelemesinden sonra (2026-11-23):**
- **5 sınırı:** ek gönderen her şablon kaydında denetlenir. Ölçü liste uzunluğu değil, birleştirilmiş sayıdır (tekrarlar bir kez); kayıt öncesi ve sonrası karşılaştırılır (`growsPastLimit`).
- **Kimlikler:** şablon kaydında şablonun hiç sahip olmadığı bir ek ya da seçenek kimliği reddedilir (`addon_templates.id_unknown`). Yenilerin kimliğini sunucu verir; oluştururken kimlik gönderilemez.
- **Kilitler:** ürüne şablon bağlama ve özellik şablonuna şablon ekleme, eklenen her şablonun kilidini de alır (sıralı, Medusa'nın `acquireLockStep`'i). Bağlama ile şablonun düzenlenmesi ya da silinmesi böylece sıraya girer: silinmekte olan şablona bağ ya kurulmadan reddedilir ya da silme onu kaldırır.
- **Toplu düzenleme:** yalnız tek değişikliği (ekle ya da kaldır) gönderir. Bütün liste ürünün kilidi altında, o anki bağlardan hesaplanır; arada kurulan bir bağ düşmez.
- **Toplu atamada bayrak:** ek seçenekler kapalıyken iş, başında `catalog.addons_disabled` ile durur.
- **Saklı fiyatın okunması:** fiyat okunurken de 0–10.000 TL sınırına bağlıdır; sınır dışı bir kayıt ek sayılmaz.

**Ekin eki (2026-11-23): oluşturulduğu yerde "tüm ürünlere uygula".** Sahip: "Burada tüm ürünlere uygula gibi bir şey lazım."
- **Ürün sayfası, yeni ek seçenek penceresi:** altta "Kapsam": *Yalnız bu ürün* (varsayılan, eskisi gibi) ya da *Şablon olarak kaydet ve uygula* → *Tüm ürünler* / *Bu ürünün kategorisindeki ürünler* (birincil kategori, yoksa ilki; alt kategoriler dahil) / *Bu ürün*. Şablon yolu eki ürünün kendi listesine yazmaz: ekin adıyla (değiştirilebilir) yeni bir şablon oluşturur, *Bu ürün*de ürünün bağlarına ekler, ötekilerde toplu düzenleme işini başlatır. Pencere kapanır; işin sonucu (güncellenen, zaten bağlı, atlanan) rapor bağlantısıyla bir bildirimde görünür. Şablon oluşup bağlama başarısız olursa şablon kalır, bildirim şablon sayfasından yeniden denemeyi söyler.
- **Şablon sayfası:** "Ürünlere uygula" (birincil düğme): *Bağla / Kaldır* ve *Tüm ürünler / Kategori / Seçili ürünler*; aynı iş, ilerleme ve sonuç pencerenin içinde; bitince kullanım sayıları yenilenir. Ek seçenekler kapalıyken yalnız *Kaldır* seçilebilir.
- **Sunucu:** `catalog.bulk_edit` girdisi `product_ids` yerine `scope: { kind: "all" } | { kind: "category", category_id }` alabilir; yalnız `addon_template` değişikliğinde (ikisi birden ya da hiçbiri reddedilir). Kapsam sunucuda 200'lük sayfalarla (kimliğe göre, keyset) okunur, 20'lik parçalarla yazılır; 1.000 sınırı yoktur, bellekte bir sayfadan fazla kimlik tutulmaz. Hediye kartı ürünleri kapsama girmez. 5 sınırı, rapor, ürün başına denetim kaydı, yetki ve bayrak denetimi aynıdır (`workflows/catalog/bulk-edit/scope.ts`).
- **Testler:** `bulk-edit/__tests__/scope.unit.spec.ts`, `integration-tests/http/addon-templates-scope.spec.ts`, panel `addon-scope.spec.tsx`.

# ADR-0074: Yapay zekâ öneri kalitesi, mağazanın yazım yönergesi ve yeni kullanım yerleri

- **Durum:** Kabul (otonom, 2026-11-20; sahip "kararları sen al, yenilikçi bir e-ticaret sistemi yazıyoruz, stratejiyi ona göre belirle" dedi; gözden geçir).
- **Tarih:** 2026-11-20
- **İlgili:** adr/0071 (yapay zekâ çekirdeği; bu ADR onun §2 "serbest istem yok" ve §9 "talimat sabittir" maddelerini sınırlı biçimde genişletir), adr/0005 (kural motoru önce), docs/13, docs/14 (SEO ve advisor), docs/22 (uygulama planı).

## Bağlam

Sahip (2026-11-20): "Yapay zekâ kullandığımız yerlerdeki öneriler çok yetersiz ve kalitesiz, örneğin SEO taraflarında. Kafa promptlarıyla mı iyileşir? Yollarını bul; gerekirse kişiselleştirilebilir olsun, kafa promptuna müdahale edilebilsin. Yapay zekâ kullanılan yerlerin sayısını da artır."

Kod incelemesinde (dev 40934dc3) kalitesizliğin nedenleri:

1. **Veri yoksul.** SEO başlık ve açıklama işine sayfanın **odak anahtar kelimesi gitmiyor** (`seo_meta.focus_keyword` var, `facts/product.ts` okumuyor). Ürün açıklaması veri bloğunda 300 karakterde kesiliyor. Kategoriye yalnız adı, üst ve alt kategori adları gidiyor; içindeki ürünlerden, markalardan, özellik aralıklarından hiçbiri gitmiyor. Model elindeki üç kelimeden genel bir cümle kuruyor.
2. **Talimat yasak listesi.** `lib/ai/instructions.ts` her iş için "şunu ekleme, bunu kullanma" dizisi; rol, amaç, arama niyeti, yöntem, iyi ve kötü örnek yok. Model güvenli ama sıradan metin yazıyor.
3. **Tek aday.** Kısa metinlerde (başlık, açıklama, anahtar kelime, ürün adı) tek öneri dönüyor; kapıdan düşerse kullanıcı boş "Yeniden dene"ye kalıyor.
4. **Mağazanın sesi yok.** Ton, hitap (sen/siz), hedef kitle, marka sözcükleri, kaçınılacak sözcükler hiçbir yerde tutulmuyor; her mağaza aynı sesle yazıyor. Talimata kimse müdahale edemiyor (adr/0071 §2 bilerek kapattı).
5. **Kapı geri bildirimi kullanılmıyor.** Kapıdan geçmeyen öneri sessizce düşüyor; neden düştüğü modele söylenip bir kez düzelttirilmiyor.

Büyüklerin yaptığı (Shopify Magic / Sidekick "brand voice", Jasper ve Writer "brand voice + style guide", Klaviyo "brand tone", ikas yapay zekâ içerik): mağaza düzeyinde **marka sesi** (ton seçimi + serbest yönerge + örnek metinler) ve iş düzeyinde **ek yönerge**; güvenlik kuralları kullanıcıya açılmaz. Biz de bunu yaparız ve üstüne talimatın "zanaat" kısmını gelişmiş ayar olarak açarız.

## Karar

### 1. Talimat üç katmana ayrılır

Her işin sistem iletisi şu sırayla kurulur:

| Sıra | Katman | Kim yazar | Düzenlenir mi |
|---|---|---|---|
| 1 | Veri kuralı (`DATA_RULE`) | kod | hayır |
| 2 | **Görev talimatı (zanaat):** rol, amaç, okur ve arama niyeti, yöntem, kalite ölçütü, iyi/kötü örnek | kod (varsayılan) | evet, gelişmiş ayar (§3) |
| 3 | **Mağazanın yazım yönergesi:** ton, hitap, kitle, serbest yönerge, örnek metinler; işe özel ek yönerge | mağaza | evet (§2) |
| 4 | **Değişmez kurallar:** uydurma yok (veride olmayan özellik, fiyat, indirim, kargo, garanti, üstünlük iddiası), biçim (düz metin, tırnak/emoji/bağlantı yok), uzunluk, kişisel veri yok, çıktı biçimi (aday sayısı, JSON) | kod | hayır |

Değişmez kurallar **en sonda** durur ve "yukarıdaki yönergelerle çelişirse bu kurallar geçerlidir" der. Asıl savunma yine yapıdır (adr/0071 §9): araç yok, çıktı yalnız öneri kutusuna düşer, **kapı aynen çalışır** (uzunluk, bağırma, bağlantı, kişisel veri, SEO kuralları), insan onaylar. Mağazanın kendi yönergesi kendi mağazasını etkiler; başka kiracıya, anahtara, veriye erişim vermez (instance-per-tenant).

`instructions.ts` her işi `{ craft, rules, options }` olarak tutar; `base` ikiye bölünür. Kod `instructionOf` yerine `systemOf(task, option, entityType, guidance)` kurar.

### 2. Mağazanın yazım yönergesi (Ayarlar › Yapay zekâ › Yazım yönergesi)

Platform ayar deposunda yeni bölüm `ai_guidance` (adr/0071 Ek 2026-11-19'daki `ai_scenes` gibi; **migration yok**):

- `tone`: `warm | professional | expert | premium | plain` (varsayılan `warm`: "samimi ama ölçülü"); her biri kodda sabit bir cümleye çevrilir.
- `address`: `sen | siz | none` (varsayılan `siz`).
- `audience`: tek satır, ≤ 160 karakter ("ev aşçıları ve kamp severler").
- `guide`: serbest yönerge, ≤ 1500 karakter ("Ürünlerimiz el yapımıdır; 'ucuz' deme, 'uygun fiyatlı' de; teknik terimleri açıkla").
- `prefer` / `avoid`: sözcük listeleri, her biri ≤ 20 öğe, öğe ≤ 40 karakter.
- `tasks[taskId]`: işe özel `extra` (≤ 600 karakter), `examples` (en çok 3 beğenilen örnek, her biri ≤ 600 karakter: modele "ton ve yapı örneği, içeriğini kopyalama" diye verilir), `craft` (§3).

Kurallar: değerler `cleanText` ile kişisel veri filtresinden geçer; HTML ve denetim karakterleri atılır; yalnız `owner` ve `admin` yazar, herkes okur; değişiklik denetim kaydına yazılır (adr/0011); boş bırakılan alan varsayılana düşer. Yönerge sistem iletisinde açıkça etiketli bir bölüm olarak gider; veri bloğuna girmez.

Panel: tek sayfa, üstte ton/hitap/kitle (ikili soru değil, varsayılanlı seçim), altında serbest yönerge ve sözcük çipleri; "İşlere göre" sekmesinde her iş bir satır (ek yönerge, örnekler, gelişmiş). Sayfada **"Dene"**: seçilen bir ürünle iki öneriyi (varsayılan ve yönergeli) yan yana gösterir; kota harcar, kaydetmez.

### 3. Gelişmiş: görev talimatını düzenleme

`tasks[taskId].craft` (≤ 3000 karakter) doluysa varsayılan zanaat katmanının **yerine** geçer. Panelde "Gelişmiş" altında, varsayılan metin düzenleme alanında hazır gelir; "Varsayılana dön" tek tıktır; varsayılan sürüm değiştiğinde (kod güncellemesi) düzenlenmiş talimatın yanında "varsayılan güncellendi, farka bak" uyarısı çıkar (`craftBase` sürüm etiketi saklanır). Değişmez kurallar alanın altında salt okunur gösterilir ki kullanıcı neyin her zaman ekleneceğini bilsin. Yalnız `owner`.

### 4. Kalite: veri, talimat, aday, düzeltme

- **Daha zengin veri** (adr/0071 §10 sınırı korunur: fiyat, stok, sipariş, müşteri, personel alanı okunmaz):
  - Ürün: odak anahtar kelime ve mevcut SEO başlığı/açıklaması (varsa), seçenek adları ve değerleri (Renk: siyah, kahve), koleksiyon adları, etiketler; SEO işlerinde açıklama 1500 karaktere kadar.
  - Kategori/koleksiyon/marka: odak anahtar kelime; içindeki yayımlanmış ürünlerden en çok 12 ad, en sık 5 marka, en sık özellik değerleri (yüzde değil, ad listesi); ürün sayısı aralığı ("40+ ürün").
  - İçerik sayfası ve yazı: gövdeden 1500 karakter.
- **Talimat yeniden yazımı:** her iş rol ("Türkiye'de e-ticaret için yazan deneyimli bir SEO metin yazarısın"), amaç, okurun arama niyeti, yöntem (anahtar kelimeyi başa yakın, somut fayda, ayırt edici özellik), kalite ölçütü ve bir iyi + bir kötü örnek (sektörden bağımsız, uydurma bir ürün üzerinden) taşır. Sektör sözcüğü yazılmaz; sektör paketi isterse işe özel örnek verir (sonra).
- **Çok aday:** `seo_title`, `seo_description`, `focus_keyword`, `product_title`, `short_description` üç aday ister (tek çağrı, JSON dizi). Her aday kapıdan ayrı geçer; geçenler sırayla gösterilir, kullanıcı birini seçer ya da düzenler. Kota ve kredi çağrı başınadır, aday başına değil.
- **Bir kez düzeltme:** hiçbir aday kapıdan geçmezse, kapının gerekçesi ("82 karakter, en çok 60") eklenerek aynı servise **bir kez** daha sorulur; ikinci çağrı kullanım kaydına yazılır ama kullanıcıdan ikinci kota düşmez (günlük tavan yine sayar). Yine geçmezse bugünkü hata.
- **Sıcaklık:** kısa SEO metinlerinde 0.7, uzun metinde 0.8, yapılandırılmış işlerde 0.2; servis kaydında desteklenmiyorsa gönderilmez.
- **Ölçüm:** `ai_usage`'a `accepted` bayrağı (öneri kabul edildi mi) zaten var mı bakılır, yoksa öneri kaydından (`content_draft` kararı) okunur; panelde Ayarlar › Yapay zekâ altında iş başına kabul oranı gösterilir. Talimat değişikliğinin işe yarayıp yaramadığı buradan görülür.

### 5. Yeni kullanım yerleri (genişletme 2)

Sıra, kazanca ve var olan altyapıya göre:

1. **Kategori, koleksiyon, marka açıklaması** (uzun metin; liste sayfası SEO'sunun en büyük boşluğu) ve bu sayfalarla blog yazısının **SEO başlık/açıklama/odak anahtar kelimesi** (yeni varlık türleri `collection`, `brand`, `post`).
2. **Ürün kısa açıklaması** (`subtitle`) ve **etiket + kategori önerisi** (mevcut listelerden seçim, yeni kategori uydurmaz).
3. **Özellik değerlerini doldurma:** açıklama ve fotoğraftan şablondaki niteliklere değer önerisi (fotoğraftan ürün kartının katı şema altyapısıyla; yalnız boş nitelikler).
4. **Ürün SSS taslağı** (3–5 soru/cevap, yalnız veriden; vitrinde SSS bölümüne ve FAQ JSON-LD'ye gider, onaylanınca).
5. **Blog yazısı taslağı** (başlık + anahtar kelime → taslak; mağaza ürünlerine iç bağlantı önerisi listesi, bağlantıyı insan ekler).
6. **E-bülten / kampanya metni** (konu satırı adayları + kısa gövde).
7. **Toplu SEO doldurma:** advisor'ın "eksik meta" bulgusu olan sayfalar için toplu iş (≤ 50), toplu onay penceresi (alt metindeki desen).

Akıllı arama, görünüm asistanı ve toplu düzenleme komutu docs/22'deki ayrı ADR'lerle kalır.

### 6. adr/0071 ile ilişki

adr/0071 §2 "serbest istem yok" kuralı korunur: **istek anında** kullanıcı istem yazmaz; düğme yine tek tıktır. Değişen: mağaza **ayar olarak** kalıcı yönerge ve (yalnız sahip) görev talimatı belirleyebilir. §9 "talimat sabittir" yerine: "güvenlik ve biçim kuralları sabittir ve en sondadır; zanaat katmanı ve mağaza yönergesi ayardır". Kapı, roller, kota, veri sınırı değişmez.

## Uygulama sırası (PR)

1. **K1 backend kalite:** talimatların katmanlara ayrılması ve yeniden yazımı, zengin veri (odak anahtar kelime, seçenekler, koleksiyon, kategori ürün örnekleri), çok aday + kapıdan aday aday geçiş, bir kez düzeltme, sıcaklık. Panel: öneri kutusunda üç aday arasından seçim. Testler: talimat kurucu, veri okuyucular, aday kapısı, düzeltme döngüsü (sahte servis).
2. **K2 yazım yönergesi:** `ai_guidance` bölümü, doğrulama, denetim kaydı, sistem iletisine ekleme; panel Ayarlar › Yapay zekâ › Yazım yönergesi + "Dene". Güvenlik incelemesi.
3. **K3 gelişmiş talimat:** `craft` düzenleme, sürüm etiketi, varsayılana dön, kabul oranı göstergesi. Güvenlik incelemesi.
4. **G1–G7:** §5 sırasıyla, her biri ayrı PR.

## Alternatifler

- **Yalnız talimatları iyileştirmek, kişiselleştirme yok:** kaliteyi artırır ama her mağaza aynı sesle yazar; sahibin istediği müdahale yok. Reddedildi.
- **Tam serbest sistem iletisi:** kullanıcı güvenlik ve biçim kurallarını da silebilir, kapı çok daha sık düşer, destek yükü artar. Reddedildi; zanaat katmanı açık, kurallar kapalı.
- **Daha büyük model:** maliyeti artırır, asıl sorun (yoksul veri, yasak listesi talimat) çözülmez. Servis kaydında işe göre model seçimi sonra değerlendirilir (kalite kipi), bu ADR'nin kapsamı dışında.

## Sonuçlar

- Öneriler sayfanın anahtar kelimesini, mağazanın sesini ve gerçek ürün içeriğini taşır; kullanıcı üç aday arasından seçer.
- Mağaza ayarı olarak talimat düzenlenebilir; güvenlik kuralları ve kapı değişmez.
- Yeni yerler liste sayfalarının SEO boşluğunu kapatır.
- Bedel: sistem iletisi uzar (belirteç maliyeti küçük artar); düzeltme çağrısı nadiren ikinci çağrı yapar.

## Ek 2026-11-21: bağlama, "Dene" ve kabul oranı

- **Yönerge kimin:** yalnız düzyazı yazan metin işleri (`capability: text`, JSON değil). Görsel alt metni (görüneni tarif eder, mağaza sesiyle değil) ve fotoğraftan ürün kartı (katı şemalı yapılandırılmış veri) yönerge almaz (`takesGuidance`, `lib/ai/guidance.ts`).
- **Başlık tek kaynaktan:** yönerge bölümünün başlığı ve bitiş satırı `guidanceText`'in; `systemOf` bölümü olduğu gibi yerine koyar. Sıra birim testiyle kilitli: veri kuralı → sayfa → zanaat → yönerge → seçilen ayar → (düzeltme notu) → değişmez kurallar.
- **"Dene":** `POST /admin/ai/guidance/preview` (owner/admin; hız profili önce `ai_text`, Ek (2) ile `ai_preview`). Kaydedilmemiş yönerge `ai_guidance` bölüm şemasıyla temizlenir; aynı ürün ve iş için iki çağrı (yönergesiz, yönergeyle) yapılır, ikisi de günlük tavandan ve aylık işlemden düşer ve `ai_usage`'a yazılır; öneri kaydı açılmaz, ürüne bir şey yazılmaz. İşler: arama başlığı, arama açıklaması, ürün açıklaması.
- **Kabul oranı:** kabulde seçilen aday `content_draft.accepted_index`'e yazılır (istek `candidate_index`; önerinin adaylarından biri değilse 400 `ai.candidate_unknown`). `GET /admin/ai/acceptance` son 30 gün iş başına sunulan (kapıdan geçen) ve kabul edilen öneri sayısını ve oranı verir; Ayarlar › Yapay zekâ'da küçük tablo.

## Ek 2026-11-21 (2): gelişmiş görev talimatı (K3) ve #247 güvenlik takipleri

- **Alan:** `ai_guidance.tasks[id].craft` (≤ 3000 karakter; HTML, görünmez/denetim karakteri ve kişisel veri diğer yönerge metinleri gibi temizlenir) ve `craft_base`. Yalnız yönerge alan ve varsayılan zanaatı olan metin işleri (`isCraftTask`; alt metin ve fotoğraftan ürün kartı hariç). Varsayılanla aynı metin talimat sayılmaz (`null`).
- **Sürüm etiketi:** varsayılan zanaat metninin SHA-256 özetinin ilk 12 onaltılık hanesi (`craftVersion`). Gerekçe: koddaki metin her değiştiğinde kendiliğinden değişir, elle sürüm artırmayı unutmak mümkün olmaz; yazım düzeltmesi de uyarı çıkarır, bu bilinçli (sahip farka bakar). `craft_base` sunucunun alanıdır: talimat metni değişince güncel sürüm yazılır, değişmeden gönderilince eskisi korunur; istemci yalnız güncel sürümü gönderebilir ("Talimatımı koru"), başka bir değer 400 `ai.guidance_craft_base_unknown`.
- **Birleştirme:** bölüm tanımına isteğe bağlı `merge` kancası (`define.ts`); `craft` göndermeyen kayıt (yöneticinin ek yönergesi) saklı talimatı ve sürümünü korur.
- **Yetki:** bölüm owner/admin'e açık kalır; gövde `craft` ya da `craft_base` taşıyorsa ve gönderen owner değilse istek bütünüyle 403 `ai.guidance_craft_owner_only` (yok sayılmaz). Aynı denetim "Dene" ucunda da var; "Dene" talimat göndermezse saklı talimatla dener.
- **Sistem iletisi:** talimat varsayılan zanaatın yerine, etiketli (`CRAFT_HEADING` … `CRAFT_END`) ve her satırı girintili girer; veri kuralı başta, değişmez kurallar sonda kalır. Sahte "Değişmez kurallar:" ya da veri kuralı satırı satır başına çıkamaz (birim ve HTTP testi).
- **Varsayılanlar:** `GET /admin/ai/guidance/crafts` (owner/admin): her işin varsayılan talimatı, sürümü, veri kuralı ve değişmez kuralları. Panel "İşlere göre" satırında yalnız sahibe kapalı "Gelişmiş" bölümü çizer.
- **#247 takipleri:** D1 "Dene" kendi hız profilinde (`ai_preview`: kişi başına 10 dakikada 5, adres başına 10). D2 kategori verisi yalnız vitrinin satış kanallarındaki ürünleri adlandırır (kullanımdaki yayımlanabilir anahtarların kanalları; iptal edilmiş anahtar ve kapalı kanal sayılmaz; kanal yoksa ad, marka, sayı gönderilmez). D3 öneri kararı tek koşullu UPDATE ile yazılır (`status = 'draft'`); aynı anda gelen ikinci karar 400 `ai.suggestion_not_open`. B1 yönerge sözcükleri kendi tırnak işaretlerinden arındırılarak tırnaklanır (`lib/ai/quote.ts`, düzeltme notuyla ortak).

## Ek 2026-11-21 (3): G1 liste sayfası açıklamaları ve yeni varlıklar

- **İşler:** `category_description`, `collection_description`, `brand_description` (`registry/listing-tasks.ts`); her tür kendi işi, böylece mağaza yönergesi ve sahibin talimatı türe göre ayrılabilir; zanaat ortak, türe göre okunur (`crafts/listing.ts`). Seçenekler Kısa / Ayrıntılı. Çıktı düz paragraflar; panel, ürün açıklaması gibi `docOfParagraphs` ile liste açıklaması belgesine (adr/0075) kaydedilmemiş değişiklik olarak koyar.
- **Kapı:** yeni `listing_description` kapısı advisor'ın liste eşiğini (`MIN_LISTING_WORDS`, C/B/K-CONT-01) ve ortak yasakları (bağlantı, kişisel veri, gürültü) uygular; düzeltme notu liste eşiğini söyler.
- **Varlıklar:** `collection` (`pcol_`) ve `brand` (`brand_`). Veri: ad, düz metin açıklama (belgenin aynası), odak anahtar kelime ve bugünkü SEO metinleri, içindeki yayımlanmış ve vitrin kanalındaki ürünlerden en çok 12 ad, koleksiyonda en sık 5 marka, markada en sık 5 kategori (iç ya da kapalı kategori sayılmaz), ürün sayısı aralığı. Okuyucu kategoriyle ortak (`facts/listing-products.ts`). Kapalı koleksiyon ya da marka, kapalı kategori gibi açılmadan hazırlanabilir (kaydın kendisi); kapalı marka ve iç/kapalı kategori adı başka sayfanın verisinde geçmez.
- **SEO işleri:** arama başlığı, arama açıklaması ve odak anahtar kelime koleksiyon ve marka için de açık; panel SEO kartında ✨ çıkar.
- **Advisor:** CONT-01 tür başına eşlenir: ürün → `product_description`, kategori/koleksiyon/marka → kendi açıklama işi (Ayrıntılı). TITLE-01/03 ve META-01 koleksiyon ve markada da düzeltme düğmesi verir.
- **Kapsam dışı:** blog yazısı (`post`) SEO'su ve içerik sayfası verisi (`facts/page.ts`) bu ekte değişmez.

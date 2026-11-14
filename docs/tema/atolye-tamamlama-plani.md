# Atölye tamamlama ve hazır görünümler planı (2026-11-14)

> Durum: ONAYLANDI (sahip, 2026-11-14). Faz 0 bitti; Faz 1 sürüyor. Dayanak: `atolye-eksik-denetimi-2026-11-14.md`,
> `ikinci-tema-ihtiyac-taslagi.md`. Karar (sahip, 2026-11-14): yeni tema yazılmaz; Atölye'nin
> eksikleri tamamlanır, sonra aynı temadan sektöre uygun hazır görünümler çıkarılır.
> İlk sektör: outdoor ve bıçak. Dal: `dev`.

## Çalışma düzeni

- Her faz 2–4 alt ajana, dosya alanları çakışmayacak biçimde dağıtılır; aynı dosyalara dokunan işler tek ajanda toplanır ya da sıraya konur.
- Her iş: Medusa API'si Context7 ile doğrulanır → kod → test → `code-reviewer` (ödeme/yetki dokunuyorsa `security-reviewer`) → lint, typecheck, ilgili testler → faz sonunda ana oturum birleştirip vitrinde gözle doğrular.
- Mimari kararlar önce ADR olarak yazılır ve sahip onayına sunulur; onaysız kodlanmaz.
- Her faz sonunda sahip vitrinde bakar, sonraki faz onun onayıyla başlar.

## Faz 0: Kararlar (kod yok; tamamlandı 2026-11-14)

- ADR-A = **adr/0062** (kabul edildi): Atölye bütün tema ayarlarını uygular (adr/0057 karar 3 ve adr/0053 §B değişti; ikisine ek yazıldı). Grafit kimliği varsayılan görünüm olarak kalır.
- ADR-B = **adr/0063** (kabul edildi): Hazır görünümler (preset): sektör paketinde şemalı veri demeti; taslağa uygulanır, önizlenir, yayınlanır. Tema ayarı ve menülerin önizlemeye girmesi dahil.
- Sahibin açık yanıtları (ayrıntı iki ADR'ın "Sahip kararları" bölümünde): koyu-sert görünümde sayfa zemini açık kalır, koyu zemin kapsam dışı; tema ayarı "Yayınla" ile yayına girer; ortalanmış üst bilgi ayrı dalda yapılır, sahip görüp onaylayınca `dev`'e girer; diğer sorularda öneriler geçerli.

## Faz 1: Tema ayarlarının tamamı çalışsın

Önkoşul (adr/0062 iş 1) tamamlandı (2026-11-14): yeni varsayılanlar (Grafit), `steel` zemini, `settings_version` ve eski satırların okuma anında eşlenmesi, tipler, vitrin `DEFAULT_THEME`, panel listesi. `atolyeSettings` süzgeci sıradaki işle kalkar.

| # | İş | Boyut | Ajan |
|---|---|---|---|
| 1.1 | Kart oranı hatası (4:5 kare çıkıyor) | S | T1 |
| 1.2 | Yazı tipleri ayara bağlanır; önyükleme bütçesi; dm-serif ağırlığı; ₺ eksikleri; caslon/hanken kalıntısı temizlenir | M | T1 |
| 1.3 | Köşeler `--radius-scale`'e bağlanır | M | T1 |
| 1.4 | Düğme biçimi: ayrı `--radius-button`; düğme ile çip ayrılır | M | T1 |
| 1.5 | Zemin tonu: `paper*` zemine göre; kontrast yeniden ölçülür | M-L | T1 |
| 1.6 | Vurgu rengi: rozet ve vurgularda kullanılır | S-M | T1 |
| 1.7 | Üst bilgi "ortada" düzeni; yapışkan kapalıyken boşluk düzeltmesi | L | T2 |
| 1.8 | Kartta puan: card-facts'e ortalama ve sayı; `show_rating` ile süzme | M | T3 |
| 1.9 | Panel: ipuçları ve örnek önizleme gerçeği göstersin | M | T4 |
| 1.10 | Testler, CSS/önyükleme bütçesi ölçümü (docs/21) | S | T1–T4 |

T1 tek ajan (aynı CSS/token dosyaları). T2, T3, T4 paralel.

## Faz 2: Hazır görünüm altyapısı (ADR-B onayından sonra)

| # | İş | Boyut |
|---|---|---|
| 2.1 | Tema ayarları ve menüler taslak/önizlemeye girer | M-L |
| 2.2 | Görünüm şeması ve yükleyici (sektör paketi içinde; tutamaçla başvuru) | S |
| 2.3 | `applyPresetWorkflow`: tutamaç çözümü, görsellerin medyaya alınması, taslağa yazma | M |
| 2.4 | Demo içerik görünümün parçası olur (bugünkü elle yükleme buraya taşınır) | M |
| 2.5 | Bölümlere biçim seçenekleri (hero, raf, karolar: 2–3 biçim) | M-L |
| 2.6 | Panelde görünüm galerisi: seç, önizle, uygula | M |
| 2.7 | Üst panelde mağaza kurarken görünüm seçimi | S |

## Faz 3: Küçük özellikler (S)

Sıralama (çok satan, puana göre) · menü ögesine vurgu/rozet · karoların filtre sayfasına ve koleksiyona bağlanması · bağlantılı hizmet şeridi · ürün yasal/güvenlik notu ve yaş notu · evet/hayır filtresi · "kutuda ne var" bloğu · kategori sayfasında ürün rafı · marka ve filtre sayfasına özgü başlık (logo, açıklama) · distribütör rozeti.

## Faz 4: Orta özellikler (M, çoğu ADR eki ister)

Kartta anahtar özellikler, varyant sayısı, tedarik süresi, rozet · sayı aralığı filtresi (boy, ağırlık) · ürüne özel SSS, bakım sekmesi, artı/eksi, "kimler için" · karşılaştırma butonu ve sayfası.

## Faz 5: Büyük işler (her biri ayrı ADR ve ayrı onay)

Set / birlikte al / sepet üstü eklenti ürünleri (L) · video galeri (M) · fiyat alarmı (M) · havale indirimi (M; adr/0029 ve 0024 ile çakışıyor) · seçim testi ve set kurucu.

## Faz 6: İlk hazır görünüm: outdoor ve bıçak

Görsel yön (renk, yazı tipi, fotoğraf dili) sahip ile; ana sayfa, ürün ve kategori düzenleri; menüler; demo katalog; `cutlery` paketine bağlanır. Kılıç ve benzeri ürünler sahip kararıyla (2026-11-14) hazır içerikte yer alır; hukuki not (6136) doğrulanmamış olarak kayıtta durur.

## Sahip kararları (2026-11-14)

1. **Sıra:** Faz 0 → 6, bu sırayla.
2. **Tema ayarları:** hepsi vitrinde çalışır. Bugünkü Grafit tasarımının kuralları panelde kayıtlı varsayılan olur: panel açıldığında gerçek görünümü (Manrope, pill düğme, Grafit köşeleri, zemini, şarap tonu ana renk) gösterir; kimse bir şey değiştirmezse vitrin aynı kalır. Gerekirse seçenek listelerine Grafit değerleri eklenir. Grafit ilk hazır görünümdür.
3. **Commit:** iş başına commit `dev` dalına; her faz sonunda testler geçince otomatik push.
4. **Faz 5:** set ve birlikte al, fiyat alarmı, havale indirimi yapılır; ayrıca seçim testi ve set kurucu Faz 5'e eklenir. Video sonraya.
5. **Karşılaştırma:** Faz 4'te.
6. **Hava:** outdoor ve bıçak için iki hazır görünüm: koyu-sert ve açık-temiz.
7. **Riskli ürünler (kılıç vb.):** sahip kararıyla hazır içerikte yer alır. Hukuki not (6136) doğrulanmamış olarak kayıtta durur; ürün düzeyinde yasal not yeteneği yine yapılır.

## Ek istek (sahip, 2026-11-14): bileşen başına hazır tasarımlar

Sahip, Elementor'daki gibi üst bilgi (navbar), menü, hero ve diğer bölümler için birden çok hazır tasarım arasından seçim ve bileşenleri tek tek özelleştirme istiyor. Bu, Faz 2 iş 2.5'i (bölüm biçimleri) genişletir: üst bilgi, mega menü, hero, ürün rafı, kategori karoları, alt bilgi için biçim galerisi (ilk hedef: bölüm başına 3–4 biçim) ve biçime özgü ayar alanları. Sınır (adr/0049): serbest sürükle-bırak konumlandırma ve özel HTML/CSS yok; seçim şemalı biçimler ve alanlar üzerinden. Üst bilgi bugün yalnız `announcement_bar` bölümü ve `header.layout` ayarı taşıyor; üst bilgi ve menü biçimleri için ADR-0063'e ek gerekir. Kapsam ve biçim sayısı sahip ile netleşecek.

## Ek istekler ve kararlar (sahip, 2026-11-14 öğleden sonra)

Maket galerisinin ikinci turu sırasında sahibin istediği, Faz 2 iş 2.5 (bölüm biçimleri) ve Faz 3 ile birlikte yapılacak işler. Hepsi şemalı alanlarla çözülür; sektöre özel kod yok.

| # | İş | Not |
|---|---|---|
| E1 | Kayan yazı şeridi (yeni bölüm türü) | Ögeler (simge, başlık, alt satır, bağlantı; 1–8), hız, yön, zemin, boyut, ayraç; üzerine gelince durur; `prefers-reduced-motion`'da kaymaz. Maket: KY1–KY3 |
| E2 | Görsel bant ayarları | Bugün `banner` tek bağlantı taşır, biçim ayarı yok. Eklenecek: ikinci düğme, düğme stili (dolu / çerçeveli / yazı), genişlik (tam / kutulu), yükseklik, metin konumu, perde gücü, metin rengi, telefon görseli |
| E3 | Kategori listeli, çok karolu hero | Hero yanında ürün sayılı kategori listesi, hızlı bağlantı çipleri, 3 görsel karo. Kategori başına ürün sayısı verisi doğrulanacak. Maket: H17 |
| E4 | Klasik katalog üst bilgisi | Yazılı arama düğmesi, yazılı hesap bağlantısı, tutar ve adet gösteren sepet düğmesi. Maket: N14 |
| E5 | Ürün kartı ayarları | Üstüne gelince ikinci fotoğraf (aç/kapat; dokunmatikte kaydırma; ikinci görsel yalnız gerektiğinde yüklenir), teslimat notu satırı, kartta tam genişlik "Sepete ekle / Seçenekler" düğmesi, yorumsuz üründe boş yıldız seçeneği |
| E6 | Raf yoğunluğu ve sayfa genişliği | Rafta 4 / 5 sütun; kapsayıcı genişliği ayarı |
| E7 | Hero'da ürün ve kampanya geri sayımı | Sayaç gerçek kampanyanın bitiş tarihine bağlanır; süre bitince bölüm kapanır ya da normal hero'ya döner; fiyat sunucuda hesaplanır. Maket: H7, FS1, H11 |
| E8 | Bölüm başına gelişmiş CSS | Karar aşağıda |

### Karar: bölüm başına gelişmiş CSS (sahip onayı, 2026-11-14)

Sahip "Shopify mantığıyla gidelim" dedi. adr/0049'un "özel CSS yok" kuralı bu kapsamda değişir; kodlamadan önce adr/0049'a ek yazılır.

- Önce zengin ayarlar (E1–E7); gelişmiş CSS bölüm biçimleri ve ayarları bittikten sonra gelir.
- Kutu bölüm başınadır; yazılan kurallar o bölümün kutusuna kapsanır, sayfanın geri kalanına dokunamaz.
- Temanın stilleri bir kaskad katmanında, özel CSS sonraki katmanda durur; `!important` gerekmeden üstün gelir.
- Kayıtta süzülür: dış adres, `@import`, sayfaya sabitlenen katmanlar ve benzeri tehlikeli yapılar reddedilir; uzunluk sınırı vardır.
- Sepet ve ödeme adımlarında kapalıdır.
- Yalnız mağaza sahibi rolü yazar; taslak, önizleme ve sürüm geçmişine girer.
- Panelde not: tema güncellemesinde bozulabilir, destek kapsamı dışındadır.
- Sınırsız tema kodu düzenleme yoktur.

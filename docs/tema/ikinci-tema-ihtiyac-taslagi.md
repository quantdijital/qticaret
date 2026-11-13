# İkinci tema: ihtiyaç listesi taslağı (2026-11-14)

> Durum: TASLAK, sahip onayı bekliyor. Hedef kitle: bıçak ve kesici alet satan mağazalar
> (balta, çakı, şef ve mutfak bıçağı, av bıçağı, koleksiyon). Tema kodu sektöre özel olmaz
> (CLAUDE.md altın kural): tema "özellik ağırlıklı zanaat ürünleri" temasıdır, bıçağa özgü veri
> `cutlery` sektör paketinden gelir.

## Kapsam (sahip onayı 2026-11-14)

Bu temada: (1) bütün tema ayarlarını uygular, (2) sektöre uygun demo içerik ve hazır ana sayfa
düzeni, `cutlery` paketine bağlı, (3) Atölye'den ortak taban çıkarılır.
Temadan sonra, ayrı iş: panelden tema seçme / önizleme / katalog, derleme anı seçimi, özel kod.

## Araştırma özeti

11 site metin olarak okundu (zoom, 360, hover gibi görsel davranışlar doğrulanamadı).
Okunamayanlar: knifecenter, bladehq, benchmade (403); Wüsthof ve Japanese Knife Imports'ta yalnız ana sayfa.

| Site | Öne çıkan |
|---|---|
| Knivesandtools | En zengin: 20+ teknik filtre (çelik, kilit, açma, ağız formu, sertlik, menşe, sağ/sol el, gravür yapılabilir), kartta tedarik süresi ve Karşılaştır, ürün sayfasında artı/eksi listesi, özet + tam teknik tablo (gruplu), "combi-deal" (kılıf, taş, yağ), yapışkan sepet çubuğu |
| Zwilling | Kartta 4 fotoğraf, "3 Sizes", gravür eklentisi (ücretli, "kargoyu uzatır" notu), 7 foto + 5 video, teknik 3 grupta |
| Wüsthof | Bıçak seçim testi (quiz), kendi setini kur, kişiye göre hediye, kullanıcı fotoğrafları |
| Chef Knives To Go | Çeliğe göre gezinme, kitle karoları (aşçılar / koleksiyoncular), sepet üstünde bakım eklentileri, 14 alanlı teknik liste |
| Opinel | Her kategoride "kullanıma göre" + "ürün tipine göre", gravür (tek satır 20 karakter, iade yok), hediye paketi, "bu ürün şu sette var" |
| Victorinox | Kullanım karoları, boya göre alt kategori, "hangi bıçak" rehberleri, tamir merkezi |
| Japanese Knife Imports | Bileme servisi, ücretsiz ilk bileme, bakım SSS |
| Pirge (en iyi TR) | Mesleğe göre menü, "Kimler için", ürün içi SSS, kullanım kılavuzu ve taksit sekmesi, gravür, 10 yıl garanti, bileme hizmeti, bakım ve seçim rehberi |
| Bıçakçım (TR) | Fiyat alarmı, taksit tablosu, ETBİS, kurban / işe özel kategoriler; teknik alanlar boş ya da çelişkili |
| Pekşen, Tapan (TR) | Zayıf: teknik ve açıklama eksik, gravür WhatsApp ile, çapraz satış yok |

**Türk sitelerinin fazlası:** taksit tablosu, havale, WhatsApp, ETBİS, fiyat alarmı, mevsim ve meslek kategorileri (kurban, kasap, döner), "kılıf dahil" ve kargo süresi notu.
**Türk sitelerinin eksiği:** teknik filtre, tutarlı teknik veri, kartta puan ve özellik, çapraz satış, bakım içeriği, yapılandırılmış gravür. Fırsat burada.

**Yaş ve yasal uyarı:** okunan sitelerin hiçbirinde yaş kapısı görülmedi (ödeme adımları incelenmedi). Tek uyarı Knivesandtools'ta: taşıma ve bulundurma yerel yasaya bağlıdır notu.

## Hukuki not (DOĞRULANMADI, avukat teyidi şart; docs/12'ye eklenecek)

- 6136 sayılı Kanun md. 4: kama, hançer, saldırma, sustalı çakı, pala, kılıç, kasatura, süngü, sivri uçlu ve oluklu bıçakların yapımı yasak; md. 5: satışı, alımı, taşınması, bulundurulması yasak (izinli meslek bıçakları hariç). Ev, tıp, sanayi, tarım, spor ve meslek bıçakları kanun dışında.
- 2521 sayılı Kanun: av bıçakları ("oluksuz, sırtı küt veya testereli") ayrı kurala tabi.
- İnternet satışına ya da alıcı yaşına özel hüküm bulunamadı; yokluğu da teyit edilmedi.
- Etki: kılıç, kama, hançer, sustalı, kelebek kategorileri riskli. Tema bunları özendirecek hazır kategori ya da demo içerik taşımaz; "yasal uyarı" bölümü ve ürün düzeyinde uyarı notu yeteneği sunar.
- Kaynaklar: mevzuat.gov.tr (6136), lexpera.com.tr (91/1779 yönetmelik, 2521), ticimax.com/blog/internette-satisi-yasak-urunler (ikincil).

## İhtiyaç listesi

Z = zorunlu (çoğu sitede var), F = farklılaştırıcı (yalnız en iyilerde), TR = Türkiye'ye özgü.

### Gezinme
- Z: ürün tipine göre menü + ikinci eksen (marka / seri).
- F: kullanıma ve kitleye göre gezinme (mutfak, av-outdoor, meslek, koleksiyon, hediye); özelliğe göre gezinme (ör. çelik) filtre sayfalarıyla.
- TR: mevsim / meslek kategorileri için öne çıkarılabilir menü ögesi.

### Ana sayfa
- Z: güven bandı (kargo eşiği, iade, garanti), hero, kategori karoları, çok satanlar, yeni ürünler, bülten.
- F: kullanım / kitle karoları, seri ya da usta hikâyesi, rehber yazıları, müşteri fotoğrafları, hizmet şeridi (bileme, gravür, kurumsal hediye).
- F (sonraki aşama adayı): seçim testi, set kurucu.

### Liste (kategori) sayfası
- Z: filtreler (fiyat, marka / seri, stok, boy, sap malzemesi), sıralama, sayfalama.
- F: ürün özelliklerinden üretilen derin filtreler (çelik, sertlik, kilit, ağız formu, menşe, sağ/sol el, kişiselleştirilebilir); sayısal aralık filtresi (boy, ağırlık).
- F: kartta 2–3 anahtar özellik, puan, varyant sayısı ("3 boy"), stok ya da tedarik süresi, rozet, Karşılaştır.

### Ürün sayfası
- Z: galeri, fiyat, varyant seçici, stok, kısa özet maddeleri, gruplu teknik tablo, garanti, kargo ve iade bilgisi, yorumlar.
- F: özet teknik + "tüm özellikler", video, artı/eksi ya da "kimler için", ürün içi SSS, bakım ve kullanım sekmesi, soru-cevap.
- F: kişiselleştirme (gravür: metin, karakter sınırı, ek ücret, süre ve iade notu); hediye paketi.
- F: sepet üstünde eklentiler (kılıf, bileme taşı, yağ), "bu ürün şu sette var", birlikte al.
- F: mobilde yapışkan sepete ekle çubuğu; ürün düzeyinde yasal / güvenlik notu.
- TR: taksit tablosu, havale indirimi notu, fiyat ve stok alarmı, WhatsApp ile sor, "kutuda ne var".

### Karşılaştırma
- F: 2–4 ürünü teknik özellikleriyle yan yana gösteren sayfa.

### İçerik ve hizmet
- F: rehber (seçim, bakım, bileme), hizmet sayfaları (bileme, gravür, kurumsal hediye), marka / usta sayfası.

### Güven
- Z: garanti vurgusu, iade, güvenli ödeme. TR: ETBİS, resmi distribütör rozeti.

## Platformda var mı? (kodlamadan önce doğrulanacak)

Ürün özellikleri (`product-attributes`), yorum, soru-cevap, istek listesi, stok bildirimi, taksit, ürün ek seçenekleri (kişiselleştirme), set / eklenti, fiyat geçmişi modülleri mevcut görünüyor; karşılaştırma, seçim testi ve set kurucu yok görünüyor. Her madde için backend karşılığı tek tek doğrulanmadı.

## Açık kararlar (sahip)

1. Hava: açık ve temiz (mutfak) mı, koyu ve sert (outdoor) mu, yoksa temanın iki hazır görünümü mü?
2. Seçim testi ve set kurucu ilk sürümde mi, sonra mı? (Öneri: sonra.)
3. Karşılaştırma ilk sürümde mi? (Öneri: evet; teknik ürünlerde en net farklılaştırıcı.)
4. Riskli kategoriler (kılıç, kama vb.) için tutum: avukat cevabına kadar demo içerikte yer almasın mı?

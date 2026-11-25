# ADR-0085: Yapay zekâ platform kredisi: üst panelde ağ geçidi, kredi defteri, paket hakkı ve yükleme

- **Durum:** Kabul (yön: sahip, 2026-11-25). Ayrıntı kararları aşağıda "Kararlar" tablosunda; para ile ilgili olanlar (satış fiyatı, paketlerin aylık hakkı) kod değil üst panel ayarıdır ve sahibindir. Özellik `ai.platform_credits` bayrağının arkasındadır, varsayılan **kapalı**; gerçek satış "Satış açılmadan önce" başlığındaki iki iş kapanmadan açılmaz.
- **Tarih:** 2026-11-25
- **İlgili:** adr/0071 (yapay zekâ çekirdeği; bu ADR onun §7 (b) ve "açık karar 2"sini karara bağlar ve defterin yerini değiştirir), adr/0061 (üst panel: imzalı istek, sır kasası, abonelik takibi), adr/0012 (bayraklar), docs/22 "Kredi satışı", docs/12 (yeniden satış izni).
- **Dayanak:** sahip (2026-11-25): "Kiracıya kendi yapay zekâ anahtarını kullanma izni vermişsek kullansın; vermemişsek bizim kredimizden yararlansın. Sağlayıcıdan API'yi biz alıp kendimize bağlayacağız, kiracılara bizden gidecek; kullandıkları kadar fatura keseceğiz ya da önden satacağız." Önerilen dört nokta aynı gün onaylandı (aşağıda Y1–Y4).

## Bağlam (kod, 2026-11-25 `dev`)

- Bugün tek ödeme yolu "kendi anahtarım"dır: bütün servisler `funding: "own_key"`, `platform` servisi yok, `AiFlags.platformCredits` hiç doldurulmuyor (`workflows/ai/connections.ts`).
- İşlerin `credits` alanı var ama kullanılmıyor: `post_draft` dışında hepsi 1, aylık sayaç işlem başına 1 sayıyor, `ai_usage.credits` yazılmıyor. Maliyetler ise çok farklı: kısa bir metin işi yaklaşık 0,001 $, bir sahne görseli 0,04–0,10 $.
- Bağlayıcı dört yerde kurulur (metin `steps/call-service.ts`, görsel `steps/edit-image.ts`, yardımcı `steps/assistant-turn.ts`, vitrin araması `steps/search-intent.ts`); hepsi anahtarı `apiKeyOf` ile okuyup `*ConnectorFor(serviceId, apiKey)` çağırır.
- Kiracı örneği üst panelle Ed25519 imzalı isteklerle konuşur (`QT-ED25519-V1`; kiracı, zaman, tek kullanımlık nonce, gövde özeti): `GET /tenant-api/v1/plan`, `POST …/usage`, `GET …/billing`. Kiracı başına dakikada 30 istek, bütün uçlar ortak.
- Üst panelin sır kasası platform düzeyinde sır saklayabilir (`PLATFORM_OWNER`), ama personelin sır yazacağı bir yüzey yok.
- Üst panelde tahsilat elledir: `charge` yalnız aboneliğe bağlıdır, personel "ödendi" diye işaretler; ödeme sağlayıcısı ve e-fatura yok (F16 başlamadı). Tek seferlik satın alma kavramı yok.

## Sahibin onayladığı yön

- **Y1. Önden kredi.** Sonradan fatura yok: pakete aylık ücretsiz hak + ek kredi yükleme. Bakiye biterse durur; tahsil edilemeyen alacak oluşmaz.
- **Y2. Token değil, iş başına kredi.** Kiracı "bu düğme kaç kredi" diye düşünür; kredi karşılıkları maliyete göre yeniden ayarlanır.
- **Y3. Anahtar bizde, üst panelde.** Sağlayıcı anahtarı kiracı kurulumuna inmez; istek bizim ağ geçidimizden geçer, bakiye orada düşer.
- **Y4. Yeniden fiyatlanabilir kredi.** Kur ve sağlayıcı fiyatı değişir; kredi karşılıkları ve satış fiyatı kod dağıtmadan ya da tek yerden değişebilmeli; son kullanma kuralı olmalı.
- "Kendi anahtarım" kalır; hangi pakette açık olduğu paket ayarıdır (`ai.own_keys`).

## Kararlar

| # | Konu | Karar | Neden |
|---|---|---|---|
| K1 | Defterin yeri | **Üst panelde** (`ai_credit_*`), mağaza veritabanında değil. adr/0071 §7'deki "defter mağazada, yükleme imzalı belgeyle" taslağının yerini alır | Bakiye, günlük tavan ve anahtar tek yerde; mağaza sunucusu ele geçse de bakiye yazılamaz |
| K2 | Ağ geçidinin biçimi | **İnce ileten**: istemi, veri bloğunu ve kapıyı bugünkü gibi mağaza kurar; hazır sağlayıcı gövdesini imzalı istekle ağ geçidine verir; ağ geçidi adresi kendi tablosundan seçer, anahtarı ekler, modeli ve çıktı tavanını kendi yazar, yanıtı döndürür | Bağlayıcıları ve kapıları iki uygulamaya bölmeden tek dikiş; kiracının verisi ağ geçidinde saklanmaz |
| K3 | Kredinin birimi | Tam sayı kredi; bir işlem (operasyon) bir kez ücretlenir, o işlemin düzeltme çağrısı ve kapıdan dönen sonucun tek "Yeniden dene"si aynı işleme sayılır (iş başına çağrı tavanı) | adr/0071 §7 kuralı ("Yeniden dene bir kez ücretsiz") ek uç gerektirmeden karşılanır |
| K4 | Kredi tablosu | İş → kredi tablosu **üst panelde** durur, mağaza yalnız iş adını söyler; mağaza paneli maliyeti ağ geçidinin durum yanıtından gösterir | Altın kural 5; tabloyu değiştirmek için mağazalara dağıtım gerekmez |
| K5 | Aylık hak | Yeni limit anahtarı `ai_free_credits_per_month` (paket ve mağazaya özel üzerine yazma, bugünkü limit düzeniyle). Ay başında yenilenir, **devretmez** | Sektörde yaygın; devreden hak maliyeti öngörülemez kılar |
| K6 | Satın alınan kredinin ömrü | **Son yüklemeden 12 ay**; her yükleme bütün satın alınmış bakiyenin süresini uzatır (ön ödemeli hat düzeni). Önce aylık hak, sonra satın alınan harcanır | Parti parti son kullanma takibi gerekmez; kullanan mağazanın kredisi yanmaz; mali müşavirin yanıtına göre süre ayardan değişir |
| K7 | Günlük kredi tavanı | Mağaza başına günde 300 kredi (üst panel ayarı; mağazaya özel değiştirilebilir) | Çalınmış oturum cüzdanı bir günde boşaltamaz |
| K8 | İki yol birlikteyse | Mağazanın kendi anahtarı işi yapabiliyorsa varsayılan odur; "Platform kredisi" seçicide ikinci seçenektir (adr/0071 §4 aynen) | Kendi anahtarı olan mağaza farkında olmadan kredi yakmaz |
| K9 | Aylık işlem sayacı | Krediyle yapılan iş `llm_credits_per_month` sayacına **sayılmaz** (onu kredi sınırlar); günlük grup tavanları ikisinde de geçerlidir | İki ayrı sınır aynı işi iki kez kesmez; `llm_credits_per_month` "kendi anahtarıyla aylık işlem" anlamını korur |
| K10 | Vitrin araması (`search_intent`) | İlk sürümde platform kredisiyle **çalışmaz** (bugünkü gibi yalnız kendi anahtar) | Müşterinin tetiklediği çağrı cüzdanı öngörülemez boşaltır; ayrı karar |
| K11 | Yükleme (ilk sürüm) | Basit yol: personel üst panelden kredi ekler; mağaza panelinde "Kredi yükle" hazır paketleri gösterir ve **talep** açar; personel tahsil edince onaylar (abonelik tahsilatıyla aynı düzen). Paket tanımlı değilse "Kredi yüklemek için bize yazın" | Üst panelde ödeme sağlayıcısı yok; kartla çevrim içi satın alma F16 ile gelir |
| K12 | Satış fiyatı ve kâr payı | Kodda fiyat yok: yükleme paketleri (ad, kredi, TL tutar) üst panel ayarıdır. Ağ geçidi her çağrının tahmini sağlayıcı maliyetini yazar; üst panel "harcanan kredi / tahmini maliyet" oranını gösterir | Fiyat sahibin; kur değişince paket fiyatı ya da kredi tablosu tek yerden değişir |

### Kredi tablosu (başlangıç; `packages/types`, yetkili kopya ağ geçidinde okunur)

Ölçü: 1 kredinin tahmini maliyeti en çok 0,0025 $. Metin işleri arkada en ucuz doğrulanmış servise gider (bugün DeepSeek ya da MiniMax).

| İş grubu | Tahmini maliyet | Kredi |
|---|---|---|
| Kısa metin: SEO başlığı ve açıklaması, odak kelime, ürün adı, kısa açıklama, etiket, kategori, nitelik, liste açıklaması, yorum yanıtı, soru cevabı, kampanya SMS'i | 0,001–0,002 $ | 1 |
| Uzun metin: ürün açıklaması, SSS, yorum özeti, kampanya e-postası | 0,002–0,005 $ | 2 |
| Yazı taslağı (`post_draft`) | 0,005–0,01 $ | 4 (bugünkü) |
| Görsel alt metni | 0,002–0,004 $ | 2 |
| Fotoğraftan ürün kartı | 0,004–0,008 $ | 3 |
| Panel yardımcısı turu (araç döngüsü, birkaç çağrı) | 0,003–0,01 $ | 3 |
| Arka plan temizleme | 0,02 $ | 10 |
| Sahne görseli | 0,04–0,10 $ | 40 |

Kendi anahtarıyla yapılan işte kredi düşmez; `AiTask.credits` alanı kalkmaz ama platform yolunda okunmaz (tek kaynak yukarıdaki tablo; kayıttaki her işin tabloda satırı olduğunu ya da bilerek dışarıda bırakıldığını bir eşitlik testi denetler).

## Tasarım

### 1. Üst panel: cüzdan ve defter (`modules/ai-credits`)

- `ai_credit_wallet` (mağaza başına bir satır): `tenant_id` (benzersiz), `plan_balance`, `plan_period` (`YYYY-AA`, İstanbul takvimi), `purchased_balance`, `purchased_expires_at`, `daily_cap` (boş: genel ayar), `spent_today`, `spent_day`.
- `ai_credit_entry` (yalnız eklenir): `id`, `tenant_id`, `kind` (`grant_purchase` | `grant_plan_monthly` | `spend` | `release` | `expire` | `adjust`), `amount` (harcama eksi), `bucket` (`plan` | `purchased`), `operation_id`, `grant_ref` (benzersiz; aynı yükleme iki kez işlenmez), `note`, `actor` (personel ya da `system`), `created_at`.
- `ai_credit_operation`: `tenant_id` + `operation_id` benzersiz; `task`, `credits`, `calls`, `status` (`open` | `charged` | `released`), `service`, `model`, ölçüler (token, görsel), `estimated_cost_micros`, `created_at`, `closed_at`. İstem ve çıktı metni **tutulmaz**.
- `ai_credit_order` (yükleme talebi): `tenant_id`, `pack` (ad, kredi, tutar: talep anındaki kopya), `status` (`pending` | `paid` | `cancelled`), `method`, `reference`, `requested_by`, `decided_by`, zamanlar.
- **Harcama tek deyimdir:** `UPDATE ai_credit_wallet SET … WHERE tenant_id = ? AND plan_balance + purchased_balance >= ? AND gün tavanı aşılmıyor RETURNING …`; önce `plan_balance`'tan, kalanı `purchased_balance`'tan düşer. Aynı işlemde (transaction) `spend` satırları ve `operation` yazılır. Defter doğrunun kaydıdır; bir denetim işi satır toplamını cüzdanla karşılaştırır ve farkı alarm olarak yazar (kendiliğinden düzeltmez).
- **Ay dönümü tembeldir:** cüzdana dokunan ilk işlem `plan_period` eskiyse kalan hakkı `expire`, yeni hakkı `grant_plan_monthly` satırıyla yazar (hak, mağazanın o anki geçerli `ai_free_credits_per_month` limitidir). Satın alınmış bakiyenin süresi dolmuşsa aynı yerde `expire` yazılır.
- **Geri verme:** sağlayıcı işi kabul etmeden düşerse (bağlantı hatası, 4xx, 5xx; mağaza tarafındaki `notTakenByService` ölçütüyle aynı) ağ geçidi `release` satırıyla aynı kovaya geri verir. 15 dakikadan eski `open` işlemler müşteri lehine `released` kapatılır ve sayılır. Geri verme yalnız tek çağrılı işlemde yapılır: aynı işlemin ikinci çağrısı sayıldıysa kredi düşülmüş kalır (yoksa eşzamanlı ikinci çağrı ilk çağrının iadesiyle bedavaya gelirdi); geri verilmiş işlemin kimliği yeniden kullanılamaz. Bayat açık işlemi denetim işi çağrı sayısına bakmadan kapatır; işlem 10 dakikadan sonra yeni çağrı kabul etmediği için bu güvenlidir. Ay değiştikten sonra gelen iadede aylık hak payı dönmez (K5), satın alınan pay döner.

### 2. Üst panel: sağlayıcı anahtarları ve ağ geçidi (`lib/ai-gateway`)

- Anahtarlar sır kasasında platform sahibiyle durur (`ai/<servis>/api_key`); üst panel arayüzünde Ayarlar › Yapay zekâ sağlayıcıları: yalnız yazılır, geri okunmaz, "Bağlantıyı dene", yetenek başına "bu yetenek için kullan" seçimi (yönlendirme: yetenek → servis + model). Yalnız üst panel sahibi rolü; her değişiklik denetim kaydına.
- Servis hedefleri (adres, yol, kimlik başlığının biçimi) tek kaynaktadır: mağazanın servis kaydındaki hedef bilgisi ortak pakete taşınır, iki uygulama oradan okur. Ağ geçidi istekten adres **almaz**.
- Yeni kiracı uçları (`TENANT_API_ROUTES`):
  - `GET /tenant-api/v1/ai/credits`: bakiye (aylık hak kalanı, satın alınan, bitiş tarihleri), günlük tavan kalanı, kullanılabilir yetenekler ve arkadaki servis kimliği (mağaza hangi gövdeyi kuracağını bilsin; mağaza paneline gitmez), kredi tablosu, yükleme paketleri, bekleyen talep.
  - `POST /tenant-api/v1/ai/calls`: başlıklarda iş adı, yetenek, servis, işlem kimliği (mağazanın ürettiği UUID); gövde sağlayıcıya gidecek ham gövdedir (JSON ya da çok parçalı). Sıra: bayrak ve yönlendirme denetimi → işlem satırı (yeni ise kredi ayır; varsa çağrı tavanına bak) → JSON gövdede modeli ve çıktı tavanını ağ geçidi yazar → `safeFetch` ile sabit adrese → yanıt aynen döner; ücretlenen kredi ve kalan bakiye yanıt başlığında. Ağ geçidinin kendi retleri ayrı bir zarfla ve ayrı durum kodlarıyla döner (bakiye yok, günlük tavan, kapalı, sağlayıcı yok).
  - `POST /tenant-api/v1/ai/orders`: yükleme talebi (paket kimliği; tutar sunucudaki paketten okunur).
- Sınırlar: ayrı hız profili (mağaza başına dakikada 60; ortak 30'luk profile sayılmaz), gövde tavanı 6 MB, sağlayıcı zaman aşımı yeteneğe göre (metin 60 sn, görsel 120 sn), iş başına çağrı tavanı (metin 3, yardımcı 8, görsel 2), işlem ömrü 10 dakika.
- Bayrak kapalı, sağlayıcı anahtarı yok ya da yönlendirme boşsa durum yanıtı "kullanılamaz" der; mağazada "Platform kredisi" hiç görünmez.

### 3. Mağaza sunucusu

- Kayıtta `platform` servisi (`funding: "platform_credit"`; yetenekleri durum yanıtından). "Bağlı" sayılması kimlik bilgisi satırından değil, bayrak + durum yanıtından gelir (60 sn önbellek; her çağrıdan sonra bakiye yanıt başlığından güncellenir).
- Tek dikiş: bağlayıcıların gönderimi bir "taşıyıcı"ya ayrılır. Kendi anahtar yolunda taşıyıcı bugünkü `safeFetch` + anahtar başlığıdır; platform yolunda imzalı istekle ağ geçidine gider (`lib/control-plane/pull.ts` kalıbı: düz `fetch`, `redirect: "error"`, boyut tavanı). Üç çağrı yeri (metin, görsel, yardımcı) aynı fabrikadan geçer; vitrin araması dokunulmaz (K10).
- Kota adımı: platform yolunda günlük grup tavanı alınır, aylık sayaç alınmaz (K9); krediyi ağ geçidi ayırır. `ai_usage`'a `funding: "platform_credit"` ve `credits` yazılır.
- Yeni hata anahtarları: `ai.credits_exhausted` ("Kredi yükle"), `ai.credits_daily_cap`, `ai.platform_unavailable` (kendi anahtarlı servis varsa "Başka servisle dene").
- `GET /admin/ai/credits` (owner, admin): bakiye, bitişler, günlük tavan, kredi tablosu, paketler, bekleyen talep. `POST /admin/ai/credits/orders` (owner): talep açar.

### 4. Mağaza paneli (sade arayüz)

- Ayarlar › Yapay zekâ'da "Platform kredisi" kartı: kalan aylık hak ve yenileneceği gün, satın alınan kredi ve son kullanma günü, "Kredi yükle" (paketler, talep, bekleyen talebin durumu).
- Seçicide "Platform kredisi" adı; hangi servisin çalıştığı söylenmez. Düğmenin yanında kredi yalnız 1'den büyükse küçük notla ("40 kredi"); bakiye bitince öneri kutusunda "Kredi yükle".
- Bayrak kapalıyken hiçbir şey görünmez.

### 5. Üst panel arayüzü

- Mağaza ayrıntısında cüzdan: bakiye, defter, "Kredi ekle / düş" (not zorunlu, `adjust`), günlük tavan.
- Yükleme talepleri listesi: "Ödendi" (yöntem, referans) → `grant_purchase`; "İptal".
- Ayarlar: sağlayıcı anahtarları ve yönlendirme, yükleme paketleri, genel günlük tavan, satın alınan kredinin ömrü.
- Rapor: mağaza ve ay kırılımında harcanan kredi, tahmini maliyet, oran.

## Güvenlik

- Anahtar yalnız kasada ve ağ geçidinin belleğinde; yanıtta, hata iletisinde, günlükte, denetim kaydında yok. Sağlayıcının yanıt başlıkları mağazaya aktarılmaz.
- Ağ geçidi adres, model ve çıktı tavanını istekten almaz; iş adının yeteneği ile istenen yetenek uyuşmazsa reddeder (ucuz işin adıyla pahalı çağrı yapılamaz).
- Mağaza yalnız kendi cüzdanını görür ve harcar: kiracı kimliği imzadan çözülür, gövdeden okunmaz.
- Kredi ekleme ve düşme yalnız üst panel sahibi rolünde, notlu ve denetim kayıtlı; `grant_ref` benzersiz.
- Aylık hak (`ai_free_credits_per_month`) bilerek ayrı tutulur: bir paket limitidir ve bugünkü limit düzeniyle yazılır (paket: sahip ve finans; mağazaya özel üzerine yazma: sahip ve operatör, gerekçeli ve denetim kayıtlı), tavanı 100.000, "sınırsız" olamaz. Tek seferlik kredi ekleme, düşme ve talep onayı yalnız sahip rolündedir.
- Eşzamanlı iki harcama tek krediyi iki kez harcayamaz (tek deyim; yarış testi).
- KVKK: ağ geçidi içerik saklamaz; platform kredisi yolunda sözleşmenin tarafı platformdur (docs/12), sağlayıcılar alt işleyen olarak mağaza sözleşmesinde anılır; `docs/kvkk-envanter.md` satırı ilgili PR'da.
- Her dilimde `security-reviewer` (para, migration, kimlik bilgisi, dış çağrı).

## Kabul testleri (para güvenliği)

1. Bakiye 1, eşzamanlı iki 1 kredilik işlem: biri geçer, diğeri `ai.credits_exhausted`; defter toplamı cüzdana eşit.
2. Sağlayıcı 5xx döner: kredi geri verilir, `release` satırı vardır, bakiye eskisine eşit.
3. Aynı işlem kimliğiyle ikinci çağrı (düzeltme) kredi düşürmez; çağrı tavanı aşılınca reddedilir.
4. Ay dönümü: kalan aylık hak `expire`, yeni hak `grant_plan_monthly`; satın alınan bakiye değişmez.
5. Aynı `grant_ref` iki kez: tek satır.
6. Günlük tavan dolunca çağrı reddedilir, ertesi gün açılır.
7. Mağaza A'nın imzasıyla B'nin cüzdanı okunamaz ve harcanamaz.
8. Farklı yetenekte iş adıyla çağrı reddedilir; istekteki model yok sayılır.
9. Bayrak kapalıyken uçlar kapalıdır ve mağaza panelinde iz yoktur.
10. Hiçbir yanıtta, günlükte ve `workflow_execution` verisinde sağlayıcı anahtarı yoktur.

## Uygulama dilimleri (hepsi bayrak arkasında; ayrıntı docs/22)

| Dilim | Kapsam |
|---|---|
| P1 | Ortak tipler: bayrak `ai.platform_credits`, limit anahtarı `ai_free_credits_per_month` (plan modülü migration'ı, iki panelin limit alanları), kredi tablosu, uç şemaları |
| P2 | Üst panel: cüzdan, defter, işlem, ay dönümü, son kullanma, denetim işi (modül + testler; dış çağrı yok) |
| P3 | Üst panel: sağlayıcı anahtarları, servis hedeflerinin ortak pakete taşınması, ağ geçidi uçları, hız ve gövde sınırları |
| P4 | Mağaza sunucusu: taşıyıcı dikişi, `platform` servisi, kota ve kullanım kaydı, hata anahtarları, `GET /admin/ai/credits` |
| P5 | Mağaza paneli: kredi kartı, seçici adı, maliyet notu, "Kredi yükle" talebi |
| P6 | Üst panel arayüzü: cüzdan, talepler, sağlayıcı ayarları, paketler, maliyet raporu |

Sıra: P1 → (P2 ‖ P4'ün ağ geçidine bağlı olmayan kısmı) → P3 → P4 → (P5 ‖ P6).

## Kapsam dışı

- Kartla çevrim içi kredi satın alma, kredi faturası ve e-fatura (F16).
- Kullandıkça sonradan fatura.
- Vitrin aramasının krediyle çalışması (K10).
- Otomatik yedek servise geçiş (adr/0071 §4 kuralı sürer).
- Kiracının kendi müşterisine kredi satması.

## Satış açılmadan önce (sahibin işi)

1. **Yeniden satış izni:** arkaya konacak her sağlayıcının şartlarında başkası adına kullanım ve yeniden satış izni yazılı olarak doğrulanır (docs/12 satır 64). İzni belirsiz servis yönlendirmeye konmaz.
2. **Mali müşavir:** ön ödemeli kredinin faturası (satışta mı, kullanımda mı), süresi dolan kredinin gelir kaydı, 12 aylık ömrün uygunluğu.
3. **Fiyat:** yükleme paketlerinin TL tutarı ve paketlerin aylık ücretsiz hakkı (üst panel ayarı).
4. Mağaza sözleşmesine alt işleyen sağlayıcıların ve kredi koşullarının (ömür, iade yok) yazılması (hukukçu).

## Alternatifler

| Seçenek | Neden seçilmedi |
|---|---|
| Anahtar mağaza ortamında, defter mağaza veritabanında (adr/0071 §7 taslağı) | Anahtar her kurulumda durur; bakiye mağaza sunucusundan yazılabilir; döndürme her kurulumda ayrı |
| Ağ geçidi işi baştan sona koşar (istem ve kapı da üst panelde) | Bağlayıcılar, kapılar ve olgu okuyucuları üst panele taşınır; mağaza verisi üst panelden geçmekle kalmaz orada işlenir; iş iki katına çıkar |
| Token bazlı bakiye | Mağaza sahibi tahmin edemez; model değişince anlamı değişir |
| Sonradan fatura | Tahsilat riski ve e-fatura altyapısı ister (F16 yok) |
| Parti parti son kullanma (her yüklemenin kendi tarihi) | Kalan miktarı parti başına izlemek gerekir; kazancı küçük |

## Sonuçlar

- Üst panel, platform kredisiyle yapılan işlerde çalışma anında bağımlılık olur (kendi anahtar yolu etkilenmez); kesintide mağaza "kullanılamıyor" görür, kendi anahtarı varsa onunla sürer.
- adr/0071 §7'deki `ai_credit_entry` mağaza tarafında **yapılmaz**; `modules/ai` için kredi migration'ı yoktur (yalnız `ai_usage.credits` yazılmaya başlar, sütun zaten var).
- Üst panel alanı Deniz'in ağırlık merkezidir: plan modülü migration'ı ve `TENANT_API_ROUTES` değişikliği PR'larda ona not düşülür.

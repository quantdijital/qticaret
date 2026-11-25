# ADR-0080: Vitrin pop-up'ları: bilgi, kampanya ve bülten; hedefleme, sıklık, sayaçlar

- **Durum:** Kabul edildi (sahip onayı 2026-11-24: "başla, yolda ayarlarız"; ayrıntılar otonom, sahip görüp revize eder)
- **Tarih:** 2026-11-24
- **İlgili:** adr/0012 (özellik bayrakları), adr/0024 (indirimler), adr/0038 §2 (bülten, çift onay), adr/0040 (personel rolleri), adr/0046 (vitrin), adr/0048 ek 2026-11-03 (vitrin önbelleğini yenileme), adr/0050 (toplu mesaj; tablo adı `bulk_message`), adr/0061 §5.5 (askıdaki mağaza), adr/0066 (yayımlanmış biçim sözleşmedir), docs/04 (hız sınırı), docs/20 (platform eksik analizi: "Pop-up (bülten, ilk alışveriş indirimi)"), docs/21 (vitrin performansı)
- **Dayanak:** sahip (2026-11-24): Pazarlama > Pop-up'lar; her pop-up bir kayıt (oluştur, tarih aralığı, aç/kapat), bayrak arkasında. Türler: bilgi, kampanya (var olan indirime bağlı, kodu kopyalanır, kampanya bitince kendiliğinden kalkar), bülten (var olan bülten kaydı uç noktası). Sayfa, cihaz, ziyaretçi hedeflemesi; N saniye ya da kaydırma yüzdesiyle açılma; oturumda bir / X günde bir / kapatılana kadar sıklığı; sayfa başına en çok bir pop-up; çerez bandından sonra; mobilde tam ekran yok; gösterim, tıklama, kapatma, kayıt sayaçları.

## Bağlam

### Kodda bugün olan (2026-11-24 `dev`, okundu)

- **İndirim** Medusa'nın promotion modülüdür (`/admin/promotions`; adr/0024). Kod, durum (`draft | active | inactive`), kullanım sınırı (`limit`, `used`), otomatik mi (`is_automatic`) ve kampanyanın günleri (`campaign.starts_at/ends_at`) Query ile okunur (`workflows/promotions/code-batch-reads.ts` deseni). Panelin indirim listesi `GET /admin/promotion-board`.
- **Bülten kaydı** `POST /store/newsletter` (adr/0038 §2): e-posta + gösterilen izin metninin sürümü; çift onay, yanıt her adrese aynı (202). Hız sınırı `newsletter` profili + meydan okuma.
- **Bayraklar** `modules/platform-settings/features.ts`; `requireFeature` kapalı bayrakta rotayı "yok" gibi yanıtlar (404, Express'in sayfası). Vitrin açık bayrakları `GET /store/storefront` `features` alanından okur (`catalog.collections` deseni, PR #298).
- **Görsel** yalnız medya kütüphanesinden (`lib/media/library-image.ts`, SVG ret `lib/media/svg-use.ts`); kullanımda olan görsel silinmez (`workflows/media/usage.ts`).
- **Vitrin önbelleği** kayıttan sonra `refreshStorefrontStep(["settings"])` ile tazelenir; yedek bir dakikalık önbellek.
- **Yetki** (adr/0040): `admin` varsayılan açık, `operations` ve `readonly` yazmada varsayılan kapalı (pazarlama yazıları sahip ve yöneticinin).

## Karar

### 1. Saklama: yeni `popups` modülü

`apps/backend/src/modules/popups` (servis `PopupsModuleService`, `medusa-config.ts`'e kayıtlı). Migration `popups/Migration20261124080000` (iki tablo; anlık görüntü `.snapshot-popups.json` yalnız `popup`'ı tutar, sayaç tablosu migration'ın kendisinindir).

**`popup`** (`id` öneki `popup`):

| Alan | Tür | Not |
|---|---|---|
| `name` | text | Panelin adı; vitrine gitmez |
| `type` | `info \| campaign \| newsletter` | |
| `is_active` | bool, varsayılan `false` | Yeni pop-up kapalı doğar |
| `starts_at`, `ends_at` | timestamptz null | Açık uç: sınırsız |
| `priority` | int 0–1000, varsayılan 0 | Büyük önce |
| `title` | text ≤ 80 | Düz metin, tek satır |
| `body` | text ≤ 500, ≤ 8 satır, null | Düz metin; satır sonu `\n` |
| `image_url`, `image_alt` | text null | Kütüphane görseli; alt ≤ 160 |
| `button_label` | text ≤ 40 null | Bilgi/kampanya: bağlantı düğmesi; bülten: gönder düğmesinin yazısı |
| `button_href` | text null | Mağazada yol (`/…`) ya da http(s) adres (`isSafeHref`); bültende yok |
| `promotion_id` | text null | Yalnız kampanya türünde, zorunlu |
| `page_scope` | `all \| selected` | |
| `pages` | jsonb `("home" \| "category" \| "product" \| "content")[]` | `selected` iken en az bir |
| `device` | `all \| desktop \| mobile` | |
| `visitor` | `any \| new \| returning` | |
| `membership` | `any \| member \| guest` | |
| `trigger`, `trigger_value` | `delay` (0–120 sn) \| `scroll` (%1–100) | |
| `frequency`, `frequency_days` | `session \| days (1–365) \| until_closed` | |
| `layout` | `modal \| corner` | Geniş ekranda; telefonda alt çekmece (§6) |

**`popup_metric`**: `popup_id`, `day` (`YYYY-MM-DD`, UTC), `impressions`, `clicks`, `closes`, `signups` (**bigint**); birincil anahtar `(popup_id, day)`. Veri modeli değil, migration'ın elle yazılmış tablosu: Medusa'nın model dilinde bigint yok, satırlar yalnız servisin SQL'iyle artırılır ve toplanır (güvenlik incelemesi D-3: şişirilmiş sayaç int4'ü taşırmasın). Pop-up silinince satırlar kalır. Kişisel veri yok.

- **Alanlar birlikte denetlenir** (`lib/popups/eligibility.ts` `popupProblem`): kampanya ↔ indirim, düğmenin yazı + bağlantısı birlikte, bültende bağlantı yok, seçili sayfa, tetik sınırı, gün sayısı, bitiş > başlangıç. Kullanılmayan alan kayıtta boşaltılır (`normalizePopup`): tür değişince eskiden kalan bir şey görünmez.
- **Metin düz metindir.** HTML yazılmaz, okunmaz. **Tema için kural:** `title`, `body`, `button.label`, `submit_label`, `image.alt` ve `promotion.code` yalnız metin düğümü olarak çizilir (React'te `{metin}`); `dangerouslySetInnerHTML`, `innerHTML` ya da markdown/HTML ayrıştırma yok; `body`'deki `\n` satır sonu CSS (`white-space: pre-line`) ya da satırlara bölmeyle gösterilir. Denetim: kontrol ve biçim (`\p{Cf}`, bidi) karakterleri yok, uzunluk ve satır sınırı (`popups.text_invalid`). Zengin metin bilerek yok: pop-up birkaç cümledir.

### 2. Türler

- **Bilgi:** başlık, metin, isteğe bağlı görsel ve düğme (yazı + bağlantı).
- **Kampanya:** Medusa indirimine bağlı (`promotion_id`; panel `GET /admin/promotion-board` listesinden seçer). Vitrin kodu kopyalama düğmesiyle gösterir; indirim otomatikse kod yerine "sepette kendiliğinden uygulanır" der (`promotion.code: null, automatic: true`). İndirim **canlı** değilse pop-up vitrine hiç gitmez: durumu `active` değil, kampanyası başlamamış ya da bitmiş, kullanım sınırı dolmuş. **Kişiye özel kodlar hiç bağlanamaz** (güvenlik incelemesi O-1): tek kullanımlık kod partisinin kopyası (kampanya kimliği `codes-…`, `workflows/promotions/code-batches.ts`), ödeme bağlantısının kodu (`qt-payment-links` kampanyası, adr/0051) ve kullanım sınırı 1 olan indirim; kayıtta 400 `popups.promotion_not_allowed`, bu kuraldan önce yazılmış ya da elle eklenmiş bir satırda da vitrine gitmez, sayılmaz (panelde `campaign_inactive`). Kampanya bitince pop-up'ın kaydına dokunulmaz (panelde "kampanya bitti" görünür); indirim yeniden açılırsa pop-up kendiliğinden döner. İndirim tutarı her zaman sepette sunucuda hesaplanır; pop-up yalnız kodu gösterir (altın kural 5).
- **Bülten:** e-posta alanı + izin kutusu, var olan `POST /store/newsletter`'a gönderilir (yeni kayıt yolu yok; çift onay, izin metni sürümü, hız sınırı ve meydan okuma aynen). Başarılı yanıttan sonra vitrin `signup` sayacını gönderir.

### 3. Hedefleme

- **Sayfa:** `all` ya da seçilenler (ana sayfa, kategori, ürün, içerik sayfası). `all` diğer sayfaları da (arama, marka, koleksiyon, liste) kapsar. **Sepet, ödeme adımları, ödeme sonucu ve hesap sayfaları hiçbir koşulda** pop-up almaz (`POPUP_BLOCKED_PAGES`); sipariş verenle siparişi arasına girmez. Seçilebilir listede de yoktur (doğrulayıcı reddeder).
- **Cihaz:** masaüstü / mobil / ikisi (vitrinin kırılım noktasıyla).
- **Ziyaretçi:** yeni / dönen / hepsi (vitrinin kendi işlevsel depolamasındaki "daha önce geldi" işareti); üye / misafir / hepsi (oturum açmış müşteri).
- **Tarih aralığı** sunucuda uygulanır; geri kalanı tarayıcıda.

### 4. Açılma, sıklık, öncelik

- **Tetik:** N saniye sonra ya da sayfanın %N'i kaydırılınca. Çıkış niyeti (exit-intent) sonraki adım.
- **Sıklık** (tarayıcının işlevsel depolaması, kişisel veri yok; adr/0038 çerez sınıflaması "işlevsel"):
  - `session`: tarayıcı oturumunda bir kez;
  - `days`: son gösterimden `frequency_days` gün sonra yeniden;
  - `until_closed`: her oturumda bir kez, ziyaretçi kapatana (ya da tıklayana / kaydolana) dek.
  - Hepsinde: aynı oturumda ikinci kez yok.
- **Sayfa görüntüsü başına en çok bir pop-up.** Sunucu canlı olanları öncelik sırasıyla verir (eşitte yeni önce); vitrin sırayla ilk eşleşen ve vakti gelmiş olanı seçer. Başvuru uygulaması: `lib/popups/targeting.ts` (`popupMatches`, `popupDue`, `pickPopup`, birim testli); tema (S3) aynısını uygular.
- **Çerez bandından sonra:** bant açıkken pop-up gösterilmez; bant yanıtlandıktan sonra tetik sayacı başlar.

### 5. Uçlar (sözleşme)

**Bayrak:** `marketing.popups`, sahibi `tenant`, **varsayılan açık** (ekran hazır olsun; pop-up kapalı doğduğu için açık bayrak tek başına vitrinde bir şey göstermez). Kapalıyken bütün pop-up rotaları 404 ("yok"), `/store/storefront` `features.popups: false`, kayıtlar durur.

**Yönetici** (hepsi `requireFeature` → `requireUserActor`; okuma her rol, yazma `owner` ve `admin`; plan koruması `"/admin/popups*"` kapalı alanda):

- `GET /admin/popups?q=&type=&offset=&limit=` → `{ popups: AdminPopup[], count, offset, limit }` (ada göre ara, yeni önce; `limit` ≤ 100, varsayılan 50).
- `POST /admin/popups` → 201 `{ popup: AdminPopupDetail }`. Zorunlu: `name`, `type`, `title`; diğerleri `POPUP_DEFAULTS`'tan (`page_scope: all`, `device: all`, `visitor: any`, `membership: any`, `trigger: delay/5`, `frequency: days/7`, `layout: modal`, `priority: 0`, `is_active: false`).
- `GET /admin/popups/:id` → `{ popup: AdminPopupDetail }`; yoksa 404 `popups.unknown`.
- `POST /admin/popups/:id` → kısmi güncelleme (gönderilmeyen alan korunur, kayıt bütün olarak yeniden denetlenir) → `{ popup }`.
- `POST /admin/popups/:id/status` `{ is_active: boolean }` → `{ popup }` (listedeki anahtar).
- `DELETE /admin/popups/:id` → `{ id, object: "popup", deleted: true }` (yumuşak silme; sayaçlar kalır).

`AdminPopup` = kaydın bütün alanları + `created_at`, `updated_at` + `state: "off" | "scheduled" | "live" | "ended" | "campaign_inactive"` + `promotion: { id, code, state: "live" | "inactive" | "not_started" | "ended" | "used_up" | "missing" } | null` + `counts: { impressions, clicks, closes, signups }` (tüm zamanlar). `AdminPopupDetail` ayrıca `daily: { day, impressions, clicks, closes, signups }[]` (son 30 gün, sayısı olan günler, eskiden yeniye).

Hata anahtarları (400, `message`): `popups.text_invalid`, `popups.link_invalid`, `popups.promotion_required`, `popups.promotion_not_allowed`, `popups.promotion_unknown`, `popups.button_incomplete`, `popups.button_link_not_allowed`, `popups.pages_required`, `popups.trigger_value_invalid`, `popups.frequency_days_required`, `popups.dates_invalid`, `popups.image_unknown`, `media.svg_logo_only`.

**Vitrin:**

- `GET /store/popups` → `{ popups: StorePopup[] }`; yalnız **açık, tarih aralığında ve (kampanyaysa) indirimi canlı** olanlar, öncelik sırasıyla, en çok 20. `Cache-Control: public, max-age=60, stale-while-revalidate=300`, `Vary: x-publishable-api-key`.
- `POST /store/popups/:id/events` `{ type: "impression" | "click" | "close" | "signup" }` → 204 (sayılsın ya da sayılmasın aynı yanıt; bilinmeyen kimlik satır açmaz). Hız sınırı `popup_event` (IP başına dakikada 20). Yalnız açık ve tarih içindeki pop-up sayılır, kampanya pop-up'ı yalnız indirimi canlıyken (`GET /store/popups` ile aynı denetim); `signup` yalnız bülten pop-up'ında.

```ts
interface StorePopup {            // packages/types `@qticaret/types/popups`
  id: string
  type: "info" | "campaign" | "newsletter"
  title: string
  body: string | null             // düz metin, "\n" satır sonu
  image: { url; alt: string | null; width: number | null; height: number | null;
           derivatives: MediaDerivatives | null } | null
  button: { label: string; href: string } | null      // bilgi/kampanya
  submit_label: string | null                          // bülten; null: temanın sözü
  promotion: { code: string | null; automatic: boolean } | null   // kampanya
  targeting: { pages: "all" | ("home"|"category"|"product"|"content")[];
               device: "all"|"desktop"|"mobile"; visitor: "any"|"new"|"returning";
               membership: "any"|"member"|"guest" }
  trigger: { kind: "delay" | "scroll"; value: number }
  frequency: { kind: "session" | "days" | "until_closed"; days: number | null }
  layout: "modal" | "corner"
  priority: number
  ends_at: string | null          // kendi bitişi ile kampanyanınkinin erkeni
}
```

Vitrine **gitmeyenler:** `name`, `is_active`, `starts_at`, `promotion_id`, zaman damgaları, sayaçlar.

**Neden ayrı uç, `/store/storefront` içinde değil:** pop-up sayfanın kritik yolunda değildir; çerçeve yanıtı (her sayfa sunucuda okur, 5 dk önbellek) büyümez, pop-up'lar sayfa yüklendikten sonra ayrı ve daha kısa (60 sn) önbellekle okunur; bayrak kapalıyken vitrin `features.popups` ile isteği hiç atmaz. Tarih sınırları 60 saniyelik önbellek kadar gecikebilir; vitrin ayrıca `ends_at`'i kendisi uygular.

### 6. Sunum (tema, S3)

- Biçimler: ortada pencere (`modal`), köşe kartı (`corner`); telefonda ikisi de **alt çekmece** (ekranın en çok ~%40'ı), **asla tam ekran geçiş reklamı değil** (Google'ın müdahaleci geçiş reklamı cezası).
- Sayfa yüklendikten sonra (boşta) yüklenir, kritik yolda değildir, yerleşim kaymaz (CLS 0: kaplama/sabit konum; görselin boyutu yanıttadır).
- Erişilebilirlik: `role="dialog"`, `aria-modal` (pencerede), odak tuzağı ve Esc ile kapanma, kapatma düğmesi her zaman görünür.
- Tema sözleşmesi `packages/ui`'ya pop-up bileşeni olarak girer; hazır görünümler ve görünüm kilidi testi bu biçimleri kapsar (adr/0066). Yeni görünüş farkı ayar ya da yeni biçim olarak gelir.

### 6a. Tasarım (ek, 2026-11-25)

`layout` pop-up'ın **nerede** durduğunu söyler (pencere / köşe / telefonda çekmece); yeni `design` alanı **içinin nasıl dizildiğini**. İkisi bağımsızdır ve her tasarım her türle (bilgi, kampanya, bülten) seçilebilir. Alan `popup.design` (enum, boş olamaz, varsayılan `classic`; migration `Migration20261125140000` eski kayıtları `classic` yapar), admin doğrulayıcısı listede olmayanı reddeder, `GET /store/popups` yanıtında `design` olarak gider. Vitrin tanımadığı bir değeri (daha yeni backend) `classic` çizer.

| Tasarım | Çizim | Görsel yoksa |
|---|---|---|
| `classic` | Görsel üstte, metin solda (ilk tasarım; çizimi değişmez, adr/0066) | Yalnız metin |
| `split` | Geniş ekran penceresinde görsel solda, metin sağda (pencere 720 px); köşe kartında görsel üstte | `classic` gibi |
| `hero` | Uzun görsel (4:3) üstte, büyük başlık ve metin ortada | Ortada büyük başlık |
| `minimal` | Görsel hiç yok; büyük başlık, metin ortada, geniş iç boşluk | — |
| `coupon` | Ortada; kampanya kodu kesikli kenarlı bilet içinde büyük, kopyala düğmesi biletin içinde | Kod yoksa (bilgi/bülten) başlık biletin içine girer; otomatik indirimde "sepette uygulanır" bilette |

Telefonun alt çekmecesi her tasarımda görselsizdir (§6). Erişilebilirlik (diyalog rolü, başlık/açıklama bağı, kapatma düğmesi, odak) bütün tasarımlarda aynıdır. Panelde yeni pop-up türüne göre öneri tasarımla başlar (kampanya → `coupon`, diğerleri → `classic`); sahibin seçtiği tasarım tür değişince değiştirilmez. Yeni bir tasarım yeni enum değeri olarak gelir; var olanların çizimi yerinde değiştirilmez.

### 7. Ölçüm

- Sunucu sayaçları (§5) yalnız sayıdır; kimlik, IP, e-posta yazılmaz. Günlük satır, tek SQL deyimiyle artırılır (`INSERT … ON CONFLICT DO UPDATE`), eşzamanlı sayımlar kaybolmaz.
- **Sayaçlar yaklaşıktır.** Uç kimliksizdir (kişisel veri tutmamanın bedeli): IP başına sınır bir adresi yavaşlatır, çok adresten gelen sahte olayları ayıramaz; sayılar şişirilebilir. Karar ve faturalama için değil, pop-up'ları birbirine göre kıyaslamak içindir; panel bunu "yaklaşık" diye gösterir. Kesin dönüşüm GA4 ve sipariş tarafındadır (indirim kodunun kullanımı).
- Sayaç uç noktası iş akışı değildir: dışarıda geri alınacak bir şey yok, her pop-up görüntüsünün yolunda tek deyim (altın kural 3'ün bilinçli istisnası, `workflows/popups/metrics.ts`).
- Vitrin ayrıca GA4 olayları gönderir (`popup_view`, `popup_click`, `popup_close`, `popup_signup`; parametre `popup_id`, `popup_type`), yalnız analitik izni verilmişse.

### 8. Yetki, plan, denetim

- Rol: okuma her personel; yazma `owner` ve `admin` (`operations`/`readonly` varsayılan kapalı listede kalır, `permissions.unit.spec.ts` bunu tutar). Panel yeteneği `marketing` (`POST /admin/promotions` sondası) kullanılır.
- Plan: `/admin/popups*` kısıtlı planda kapalı alan; `POST /store/popups/:id/events` askıda açık (satış değil).
- Denetim kaydı: genel yönetici yazma kaydı (gövde alan adları); hassas değil, ayrı kaynak yok.
- Medya: pop-up'ın görseli "kullanımda" sayılır (`MediaUseKind` `popup`), kütüphaneden silinemez.

## Dilimler

- **S1 – backend (bu ADR'nin PR'ı):** modül, migration, iş akışları (oluştur/güncelle/aç-kapat/sil; telafili), yönetici ve vitrin uçları, sayaç, bayrak, hız profili, hata metinleri, medya kullanımı, `packages/types` sözleşmesi, birim ve HTTP testleri.
- **S2 – panel:** Pazarlama > Pop-up'lar listesi (durum, sayaçlar, anahtar), standart düzenleme penceresi (tür, içerik, görsel seçici, indirim seçici `promotion-board`'dan, hedefleme, tetik, sıklık, tarih), bayrak kapısı.
- **S3 – tema:** `packages/ui` pop-up sözleşmesi, Atölye bileşenleri (pencere, köşe kartı, alt çekmece), seçim ve sıklık (`targeting.ts` başvurusu), çerez bandı sırası, bülten formu, GA4, görünüm kilidi.

## Sonuçlar

- Bir mağaza pop-up'ı tek kayıtla, kod yazmadan açar; kampanya bitince kendiliğinden kalkar.
- Pop-up kritik yolda değil; sepet ve ödemeye hiç girmez; telefonda tam ekran yok.
- Sayaçlar kişisel veri tutmaz; KVKK envanterine yeni kalem eklemez.

## Açık konular

- A/B testi, çıkış niyeti, belirli kategori/ürün kimliğine göre hedefleme, segment hedeflemesi: sonraki tur.
- "İlk alışverişe özel" (docs/20): bugün kampanya türü + "yeni ziyaretçi" ile kurulur; müşteriye özel tek kullanımlık kod sonraki tur.

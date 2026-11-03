# 09 — Claude Code Çalışma Düzeni

## Token yönetimi
1. **Kademeli bağlam.** Kök `CLAUDE.md` kısa; detaylar `docs/`'ta. Claude sadece görevle ilgili dokümanı okur.
2. **İç içe CLAUDE.md.** `apps/backend/CLAUDE.md` gibi alt dosyalar sadece o klasörde çalışırken yüklenir.
3. **Tek oturum = tek görev.** Görev bitince `/oturum-kapat` → `/clear`. Uzun oturumlarda `/compact`.
4. **Plan modu önce.** Çok dosyalı işlerde önce plan; onaydan sonra kod. Plan `PROGRESS.md`'ye not edilir.
5. **Alt ajanlarla keşif.** Kod tabanı taraması, doküman araştırması `medusa-researcher` ajanına; ana bağlam temiz kalır.
6. **Durum dosyada.** İlerleme, kararlar, açık sorular `PROGRESS.md` ve `adr/`'de; sohbet geçmişine güvenme.
7. **Gürültüyü engelle.** `node_modules`, `dist`, `.medusa`, lockfile, büyük log'lar okunmaz (settings deny).
8. **Çıktıyı kısalt.** Test/komut çıktılarında sadece hatalar: `pnpm test 2>&1 | tail -50` gibi.
9. **Küçük dosyalar.** 300 satır sınırı Claude'un dosyayı tek seferde doğru okumasını sağlar.

## MCP sunucuları
| MCP | Ne zaman | Kurulum (örnek) |
|---|---|---|
| Context7 | **Her zaman açık.** Medusa/kütüphane API doğrulama | `.mcp.json` içinde |
| GitHub | PR/issue işlerinde | `claude mcp add --transport http github https://api.githubcopilot.com/mcp/` |
| Playwright | Admin UI test/gezinti | `.mcp.json` içinde |
| PostgreSQL (dev, salt-okunur) | Şema/veri inceleme | Salt-okunur kullanıcıyla, **sadece local DB** |
| Sentry | F15 sonrası hata analizi | Gerektiğinde ekle |

> MCP paket adları ve kurulum komutları değişebilir; kurmadan önce resmi kaynaktan doğrula.
> Kural: aynı anda en fazla 3-4 MCP aktif. Her MCP araç tanımlarıyla bağlam tüketir.
> Production DB'ye, prod secret'lara MCP erişimi **yok**.

## Özel komutlar (`.claude/commands/`)
| Komut | Amaç |
|---|---|
| `/oturum-baslat` | PROGRESS'i oku, sıradaki görevi öner, ilgili dokümanları listele |
| `/faz-baslat <F#>` | Fazın görevlerini ve KK'larını çıkar, plan üret |
| `/yeni-modul <ad>` | Medusa özel modül iskeleti (models, service, index, migration, test) |
| `/entegrasyon-provider <tür> <ad>` | Payment/fulfillment/notification provider iskeleti + mock + contract test |
| `/test-yaz <yol>` | Hedef dosya için test senaryoları + testler |
| `/guvenlik-review` | Değişen dosyaları güvenlik kontrol listesine göre incele |
| `/oturum-kapat` | PROGRESS güncelle, KK'ları işaretle, sonraki görevi yaz |

## Alt ajanlar (`.claude/agents/`)
| Ajan | Rol |
|---|---|
| `medusa-researcher` | Salt-okunur. Context7 + kod tabanında araştırma, kısa özet döner |
| `security-reviewer` | Salt-okunur. Güvenlik kontrol listesi, bulgu raporu |
| `test-writer` | Test senaryosu çıkarır, test yazar, çalıştırır |
| `code-reviewer` | Standartlara uyum, sadeleştirme önerileri |

## Yerel SEO skill'leri (`claude-seo` eklentisi)
Kullanıcının makinesinde `/seo-*` skill'leri kuruludur. Kod değil, referans ve denetim aracıdır:
| Skill | Kullanım yeri |
|---|---|
| `seo-ecommerce`, `seo-schema` | F3.12–F3.13 kural ve şema tasarımında referans; F18'de ürün sayfası doğrulama |
| `seo-technical`, `seo-sitemap` | F3.6/F3.15 kural tasarımı; F14 geçiş öncesi eski site envanteri; F18 teknik denetim |
| `seo-programmatic`, `seo-geo`, `seo-content` | F3.16 içerik/landing kalite kapıları ve editör kuralları |
| `seo-audit`, `seo-page` | F18 demo mağaza tam denetimi; canlı tenant'larda dönemsel kontrol |
Kural: skill çıktısı dokümana "kaynak: claude-seo, <tarih>" notuyla girer; Google kuralı değiştiğinde doc 13/14 güncellenir.

## Hook'lar
`.claude/settings.json` içinde: dosya düzenlemesinden sonra prettier (jq gerektirir).
Ağır işler (tam test, build) hook'a konmaz; token ve süre israfı.

## Önerilen oturum akışı
```
/oturum-baslat
→ (plan modu) görev planı → onay
→ kod + test
→ /test-yaz (gerekirse) → pnpm test
→ /guvenlik-review (ödeme/kargo/fatura/auth değiştiyse)
→ commit (conventional)
→ /oturum-kapat → /clear
```

## Yerel demo verisi
- Panelin ve vitrinin yerel e2e testleri demo veriye dayanır: önce `pnpm --filter @qticaret/backend seed:demo` (katalog, kargo seçenekleri, "Demo storefront" anahtarı), panoyu dolduran siparişler için `seed:demo-orders`. Testler kendi yönetici hesaplarını açıp kapatır (`remove-e2e-admin.ts`).
- Mağaza sahibi yerel paneli kendi verisiyle deniyorsa demo kayıtları kafa karıştırır: `pnpm --filter @qticaret/backend demo:remove` demo siparişleri (faturalarıyla), demo ürünleri, boş kalan demo kategorileri, mağazanın başka kargo seçeneği varsa demo kargo seçeneklerini, depodaki uydurma adresi, yarıda kalmış e2e yönetici hesaplarını ve onların ürün tablosu kontrol işlerini kaldırır; tekrar çalıştırılabilir, özeti loga yazar. Vitrin için "Demo storefront" anahtarı kalır. Geliştirme/test dışında `allow-non-local` olmadan çalışmaz.
- Bir müşterinin siparişi stoğunu ayırdığı için kalan demo ürünler (ilk çalıştırmada `pamuklu-tisort`, `keten-masa-ortusu`, `yun-bere`, `keten-gomlek`) için: `pnpm --filter @qticaret/backend demo:remove products-with-orders`. Yalnızca development/test'te çalışır (dışarıda `allow-non-local confirm` ile bile reddedilir). Ürünleri düz çalıştırmayla aynı kuralla seçer: demo tutamacı ve seed işareti (`metadata.demo`), ya da işaretten önce (2026-11-03) doldurulmuş bir veritabanında hiç metadata olmaması ve seed'in adının değişmemiş olması; tutamaç tek başına yetmez. Önce stok ayırmalarını bırakır, sonra ürünü Medusa'nın iş akışıyla yumuşak siler ve boş kalan demo kategorilerini kaldırır. Ne yaptığını loga yazar (`demo.ordered_products_removed`). Siparişler satırlarını yazıldığı gibi korur. Müşterilere dokunulmaz (`test@example.com` dahil).
- `demo:remove` sonrası e2e çalıştırmak için `seed:demo` (ve gerekiyorsa `seed:demo-orders`) yeniden çalıştırılır.
- Vitrini elle denemek için doğrulanmış müşteri: `NODE_ENV=development pnpm --filter @qticaret/backend customer:test <e-posta> <şifre>`. E-posta girişi ve müşteri hesabı açılır, adres doğrulanmış sayılır (vitrinin doğrulama akışıyla aynı kayıt); yeniden çalıştırılırsa yalnız şifre değişir. Şifre politikasına uymalı (en az 10 karakter); şifre yazdırılmaz. Yalnız development/test veritabanında çalışır.
- Yerelde backend CLI komutları (`medusa user`, `medusa exec ...`) `NODE_ENV=development` ile çalıştırılır: yerel `.env`'deki sahte sağlayıcı adresleri (`*_BASE_URL`), `MAILPIT_URL` ve `CONTENT_DRAFT_PROVIDER=fake` yalnızca development/test'te kabul edilir; `NODE_ENV` boşsa ortam canlı sayılır ve yapılandırma yüklenmez ("is allowed on development and test only"). Örnek: `NODE_ENV=development pnpm --filter @qticaret/backend medusa exec ./src/scripts/remove-e2e-admin.ts <e-posta>`. `seed:demo`, `seed:demo-orders`, `demo:remove` ve `shop:profile` betikleri bunu kendisi ayarlar; panel e2e yardımcısı (`apps/panel/e2e/support/admin.ts`) da CLI'yi bu değerle başlatır.

## Sahte sağlayıcılar
**Kural (mağaza sahibi, 2026-11-03):** Geliştirmede görülen her şey canlı mağazanın göreceğinin aynısıdır. Belgede, iletide ve ekranda "deneme", "demo" ya da "sahte" işareti olmaz. Sahte sunucular canlı API'nin yollarını, yanıt biçimlerini ve hata kodlarını taklit eder. Canlıda olmayan bir davranış eklenmez. Tek ek, kargo sahtelerinin kendi takip sayfasıdır (`<adres>/takip/<no>`); canlıda taşıyıcının herkese açık takip sayfasının yerini tutar.

Hangi ekran için hangisi başlatılır (her biri ayrı terminalde, backend'den önce ya da sonra):

| Ekran / akış | Komut | Backend `.env` satırı |
|---|---|---|
| Ayarlar > Ödeme > PayTR; vitrin kart ödemesi (`localhost:8000/odeme`); siparişte iade | `pnpm dev:paytr` | `PAYTR_BASE_URL=http://127.0.0.1:9102` |
| Ayarlar > Kargo > Geliver; "Kargoya ver", etiket, takip | `pnpm dev:geliver` | `GELIVER_BASE_URL=http://127.0.0.1:9103/api/v1` |
| Ayarlar > Kargo > Aras Kargo; kargoya verme, etiket, takip bağlantısı | `pnpm dev:aras` | `ARAS_BASE_URL=http://127.0.0.1:9104` |
| Ayarlar > Kargo > Yurtiçi Kargo; kargoya verme, etiket, takip bağlantısı | `pnpm dev:yurtici` | `YURTICI_BASE_URL=http://127.0.0.1:9105` |
| Ayarlar > SMS > Netgsm; sipariş ve kargo SMS'leri, toplu SMS | `pnpm dev:netgsm` | `NETGSM_BASE_URL=http://127.0.0.1:9106` |
| Ayarlar > E-Fatura > Paraşüt; siparişteki fatura kartı | `pnpm dev:parasut` | `PARASUT_BASE_URL=http://127.0.0.1:9108`, `PARASUT_CLIENT_ID`, `PARASUT_CLIENT_SECRET` |
| Ayarlar > Entegrasyonlar > Shopify; taşıma | `pnpm dev:shopify` | `SHOPIFY_BASE_URL=http://127.0.0.1:9107` |
| Bütün e-postalar (`http://localhost:58025`) | `pnpm db:up` (Mailpit) | `EMAIL_TRANSPORT=mailpit`, `MAILPIT_URL=http://127.0.0.1:58025`, `EMAIL_FROM` |

- Her sahte sunucu başlarken panelde gireceğiniz hesap bilgilerini yazar. Bu değerler sabittir; panel bağlantıyı çalıştırmalar arasında korur. Ayrıntılar `apps/backend/env.example`'da.
- **Paraşüt portu 9108'dir.** Önceden 9106'ydı ve Netgsm'le çakışıyordu. `.env`'de eski `PARASUT_BASE_URL=http://127.0.0.1:9106` satırı varsa 9108 yapın.
- **Panelde "Test modu" kapalı kalır.** Sahte adres tanımlıyken istekler zaten sahteye gider. Test modu yalnızca canlı mağazanın görmeyeceği işaretler ekler: rozet, test siparişi, kargo engeli. Paneldeki "Kapatınca gönderiler gerçek hesaba açılır" notu bu makinede geçerli değildir. Backend açılışta her sahte sağlayıcı için bir uyarı yazar (`provider.fake_address`, sağlayıcı ve değişken adıyla; adres yazılmaz). Testlerde bu uyarı susturulur.
- iyzico'nun sahtesi yalnızca testlerde kullanılır (`IYZICO_BASE_URL`). Yerelde iyzico sandbox hesabı panelden bağlanır.
- Sahte adresler (`*_BASE_URL`) yalnızca `NODE_ENV=development` ya da `test` ile kabul edilir. Staging ve canlıda env doğrulaması başlatmayı durdurur.
- **Bağlantılar:** `seo.canonical_host` boşken geliştirmede (`NODE_ENV=development`) e-posta bağlantıları, şifre yenileme, e-posta doğrulama, sepet hatırlatma, taşıma davetleri ve sözleşmelerdeki alan adı yerel vitrine gider (`STOREFRONT_ORIGIN`, yoksa `http://localhost:8000`). Böylece Mailpit'teki e-postalardaki bağlantılar açılır. Yerel dosya deposundan http ile gelen logo da e-postada görünür. Canlıda kural değişmez: alan adı girilene kadar bağlantı yoktur. Testler de canlı kuralıyla çalışır.
- **Kargo takip bağlantısı:** Aras ya da Yurtiçi sahtesi tanımlıyken gönderinin takip bağlantısı sahtenin kendi sayfasına gider (`http://127.0.0.1:9104/takip/<no>`, `http://127.0.0.1:9105/takip/<no>`). Canlıda taşıyıcının kendi sayfasına gider. Geliver'in bağlantısı Geliver'in yanıtından gelir.
- **İleti önizlemesi:** Panelin ileti önizlemesi ve `messaging:samples` mağazanın doldurduğu bilgileri kullanır: vitrin adresi, unvan ve MERSİS, banka hesabı, SMS ret satırı. Uydurma değer yalnızca boş bırakılan alanda kalır.
- **Ödeme denetiminin hız sınırı:** Geliştirmede (`NODE_ENV=development`) bu makinenin kendi adresinden (127.0.0.1, ::1) başlayan ödemeler sayılmaz. Vitrin e2e takımı her ödemede yeni bir e-postayla aynı adresten geldiği için bir günde sert sınıra (saatte 30 başlatma, günde 30 farklı e-posta) takılıyordu. Başka her adres sayılır. Testlerde ve canlıda loopback da her adres gibi sayılır.

## Claude'a verilmeyecek yetkiler
- `git push --force`, `rm -rf`, prod deploy komutları
- `.env*` okuma, secret dosyaları
- Paket yayımlama (`npm publish`)

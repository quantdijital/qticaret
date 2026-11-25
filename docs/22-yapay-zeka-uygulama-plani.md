# Yapay zekâ çekirdeği: uygulama planı

> Karar: `adr/0071-yapay-zeka-cekirdegi.md`. Bu belge o kararın PR'lara bölünmüş planıdır: dokunulacak dosyalar, testler, kabul ölçütleri ve güvenlik incelemesi gereken PR'lar. Bir PR birleşince durumu `progress/<kişi>.md`'ye yazılır; plan değişirse bu belge aynı PR'da güncellenir.
> Yollar `apps/backend/src/` (backend) ve `apps/panel/src/` (panel) köküne göredir.

## Her PR için geçerli kurallar

- Gerçek servise çıkan test yok: çekirdek testleri `fake` servisle, bağlayıcı testleri `fetch` taklidi ve kayıtlı yanıtla koşar.
- Bir servisin yeteneği kayda **resmi belgeden doğrulanarak** girer; kayıt dosyasına doğrulama tarihi ve kaynak adresi yorum olarak yazılır. Doğrulanamayan yetenek eklenmez, PR'da "doğrulanamadı" diye yazılır.
- Anahtar hiçbir adımın girdisine, çıktısına, hata iletisine, günlüğe ya da test verisine girmez (test anahtarları açıkça sahte: `test-key-…`).
- İstem ve hata metinleri sektör nötr; sektöre özgü bilgi yalnız ürünün nitelik şablonundan gelir.
- Arayüz metni `locales/tr.json` + `en.json`; sunucu hata anahtarı `lib/errors/messages/{tr,en}.ts`.
- Dosya ~300 satır; route ince (doğrula → akış → dön).
- **Güvenlik incelemesi** işaretli PR: `security-reviewer` koşulur, bulgular ve kapanışları PR'a yazılır, ana oturum birleştirir.

## Aşama 0b: backend çekirdek

### PR 0b-1: kayıtlar, seçim, bağlayıcı, kapı (saf kütüphane)

- **Dosyalar (yeni):** `lib/ai/registry/capabilities.ts`, `tasks.ts`, `services.ts`; `lib/ai/select.ts`; `lib/ai/connectors/types.ts`, `openai-compatible.ts`, `fake.ts`; `lib/ai/prompt.ts` (sistem iletisi + veri bloğu); `lib/ai/gate.ts` (bugünkü `draftProblems`'ı çağırır, taşımaz); `lib/ai/errors.ts` (servis yanıtı → `ai.*` anahtarı); `lib/ai/cost.ts`; `lib/ai/limits.ts`; `lib/errors/messages/{tr,en}.ts` (`ai.*`).
- **Dokunulmaz:** `lib/content-drafts/**`, `workflows/content/drafts.ts`.
- **Testler (birim):** seçim tablosu (boş, tek, çok, istenen servis listede yok, tercih, bayrak kapalı); bağlayıcı: istek biçimi, anahtar yalnız başlıkta, zaman aşımı, 401/429/5xx eşlemesi, tek yeniden deneme yalnız 429/5xx'te, hata nesnesinde gövde ve başlık yok; istem: veri bloğu ayrı ileti, ayıklama uygulanmış, enjeksiyon dizgisi veri olarak kalıyor; maliyet tahmini; kayıt bütünlüğü (her işin yeteneği var, her servisin adresi `https` ve sabit).
- **Kabul:** `fake` dışında hiçbir servis doğrulanmamış yetenekle kayıtlı değil; `pnpm --filter backend test:unit` yeşil.
- **Güvenlik incelemesi:** evet (dış çağrı, anahtar taşıma).

### PR 0b-2: servis hesapları ve bayrak

- **Dosyalar:** `modules/integration-credentials/providers.ts` (yapay zekâ kayıtları `providers-ai.ts`'e bölünür; `deepseek`, `minimax`, `gemini`), `lib/integrations/account-check.ts` (+ `lib/ai/account-check.ts`: servis başına üretimsiz doğrulama çağrısı), `packages/types/src/control-plane/platform-flags.ts` + `modules/platform-settings/features.ts` (`ai.own_keys`, aynı değişiklikte), bayrak i18n anahtarları, `workflows/integration-credentials/**` (bayrak kapalıyken yapay zekâ servisi bağlama reddi: `ai.own_keys_not_in_plan`).
- **Testler:** `integration-credentials.spec.ts` deseninde http: bağla, dene, anahtar yanıtta yok, `admin` bağlayamaz, bayrak kapalıyken 403 ve satır korunur; platform bayrağı eşitlik testi (var olan) yeşil; `permissions.unit.spec.ts`.
- **Kabul:** yeni servis satırı zarf şifrelemeyle yazılır; migration yok.
- **Güvenlik incelemesi:** evet (kimlik bilgisi, yetki). Deniz'e not: `platform-flags.ts` ortak dosya.

### PR 0b-3: modül, akış adımları, uçlar

- **Dosyalar (yeni):** `modules/ai/{index.ts,service.ts,models/ai-usage.ts,models/ai-preference.ts,migrations/*}`; `medusa-config.ts` (modül kaydı); `workflows/ai/steps/{select-service,claim-quota,call-service,record-usage}.ts`; `workflows/ai/suggest-text.ts`; `api/admin/ai/{services,suggestions,usage}/**` + `validators.ts`; `api/http/ai-routes.ts`; `lib/security/rate-limit/profiles.ts` (`ai_text`, `ai_media`); `lib/staff/permission-rules.ts`; `lib/plan-guard/rules.ts`; `lib/env.ts` + `.env.example` (günlük tavanlar); `docs/kvkk-envanter.md` §4 satırı; `api/admin/openapi.json` (üretiliyorsa yeniden).
- **Testler:** modül (`service.spec.ts`: tercih yazma okuma, kullanım toplamı); http `ai.spec.ts`: servis yokken `ai.no_service`; tek servis; iki servis ve tercih; kota dolu; günlük tavan; rol tablosu; çağrı düşünce kota geri verilir ve `ai_usage` `failed` yazar; yanıtlarda ve `workflow_execution` verisinde anahtar yok; hız sınırı.
- **Kabul:** `GET /admin/ai/services` sahte servisle doğru yetenekleri döner; `POST /admin/ai/suggestions` Aşama 1 işleri olmadan da `fake` işle uçtan uca çalışır; migration adı benzersiz.
- **Güvenlik incelemesi:** evet (migration, yetki, dış çağrı).

## Aşama 0c: panel

### PR 0c-1: Ayarlar › Yapay zekâ

- **Dosyalar:** `features/settings/sections.ts`, `features/settings/pages/ai-page.tsx`, `features/settings/components/ai-service-card.tsx`, `ai-usage-card.tsx`, `features/ai/api/ai.ts` (sorgular), rota dosyası, `locales/{tr,en}.json` (`ai.*`), `features/settings/integrations.ts` (Entegrasyonlar sayfasında bağlantı).
- **Testler:** kart durumları (bağlı değil, bağlı, reddedildi, okunamıyor, paket kapalı), anahtar alanı geri doldurulmaz, `owner` olmayan bağlama düğmesi görmez, veri notu görünür.
- **Kabul:** Chromium + WebKit, 1440/768/390'da görsel denetim; var olan `credential-dialogs.tsx` yeniden kullanılır.

### PR 0c-2: ortak bileşenler

- **Dosyalar (yeni):** `features/ai/components/{ai-button,ai-service-picker,ai-suggestion-box,ai-connect-hint}.tsx` + testleri; `features/ai/use-ai-suggestion.ts` (istek, yeniden dene, başka servisle dene durum makinesi).
- **Testler:** tek serviste seçici yok; çok serviste var ve seçim istekle gider; hata → "Başka servisle dene" yalnız `alternatives` doluyken; "Kullan" yalnız `onUse` çağırır, kayıt isteği atmaz; ipucu kapatılınca hatırlanır; klavye ve ekran okuyucu adları.
- **Kabul:** bileşenler hiçbir sayfaya bağlanmadan (hikâye ya da test sayfası) çalışır; docs/18'e bileşen notu.

## Aşama 1: SEO başlık ve meta önerisi

### PR 1-1: backend işleri

- **Dosyalar:** `lib/ai/registry/tasks.ts` (`seo_title`, `seo_description`), `lib/ai/facts/{product,category,page}.ts` (bugünkü `productFacts` süzgeçleriyle: yalnız herkese açık nitelikler), `workflows/ai/suggest-text.ts`, kapı: `lib/seo/advisor` alan kuralları.
- **Testler:** üç varlık türü için gerçekler (özel nitelik gitmez, kişisel veri ayıklanır); kapıdan geçmeyen öneri `refused`; `accept` alanı yazmaz; fiyat hiçbir istemde yok.
- **Kabul:** sahte servisle üç varlıkta öneri; gerçek servisle elle duman testi (kayıt PR'a yazılır, CI'da koşmaz).

### PR 1-2: panel bağlama

- **Dosyalar:** `features/seo/components/seo-card.tsx` (başlık ve açıklama alanlarının yanına `AiButton`), kategori ve sayfa formlarındaki aynı kart.
- **Testler:** `seo-card.spec.tsx`: öneri forma düşer, kaydetmeden çıkınca kaybolur, piksel genişliği göstergesi öneriyle güncellenir.
- **Kabul:** tarayıcı denetimi; servis yokken ipucu.

## Kredi satışı: platform kredisi (adr/0085)

Karar: `adr/0085-yapay-zeka-platform-kredisi.md` (sahip yönü 2026-11-25'te onayladı: önden kredi, iş başına kredi, anahtar üst panelde, yeniden fiyatlanabilir). Defter ve anahtarlar **üst panelde**dir; mağaza sunucusu çağrıyı imzalı istekle ağ geçidinden geçirir. Hepsi `ai.platform_credits` bayrağının arkasında, varsayılan kapalı. Her dilimde **güvenlik incelemesi** (para, migration, kimlik bilgisi, dış çağrı). Yollar: üst panel `apps/control-plane/src/`, üst panel arayüzü `apps/control-plane-panel/src/`.

### PR P1: ortak tipler, bayrak, limit anahtarı

- **Dosyalar:** `packages/types/src/control-plane/platform-flags.ts` + `apps/backend/src/modules/platform-settings/features.ts` (`ai.platform_credits`, varsayılan kapalı; aynı değişiklikte), bayrak i18n; `packages/types/src/control-plane/registry.ts` (`ai_free_credits_per_month`: sayı, aylık, `block`), üst panel `modules/plans` (limit anahtarı enum migration'ı, `models/{package-limit,tenant-override}.ts`, `service.ts`, `lib/plans/limits.ts`, doğrulayıcılar), iki panelin limit alanları ve çevirileri, mağaza `lib/plan-limits/{summary,check,usage}.ts`; yeni `packages/types/src/control-plane/ai-credits.ts` (kredi tablosu `AI_TASK_CREDITS`, iş başına çağrı tavanı, uç şemaları: durum, çağrı başlıkları, talep; hata kodları).
- **Testler:** bayrak eşitlik testleri (var olanlar), şema ve vektör testleri, limit özetinde yeni anahtar; mağazada eşitlik testi: kayıttaki her işin kredi tablosunda satırı var ya da bilerek dışarıda (`search_intent`, `test_text`).
- **Kabul:** bayrak kapalıyken hiçbir davranış değişmez; migration adı benzersiz; Deniz'e not (plan modülü migration'ı, `platform-flags.ts`).
- **Yapıldı (2026-11-25):** bayrak iki listede, iki panelin çevirilerinde ve mağaza panelinin özellik grubunda; onu okuyan davranış kodu yok (P4). Limit anahtarı sayılan bir kota değil **hak**tır: `LIMIT_REGISTRY`'de yeni tür `enforcement: "grant"` (yukarıdaki `block` yerine); mağazanın sayan ve engelleyen kodu yalnız `CountedLimitKey` alır, hak oraya tip düzeyinde giremez; özet ekranında `kind: "grant"` satırı. Hak "Sınırsız" olamaz (`cp.limit_grant_unlimited`), tanımsızsa 0; 0 ise plan belgesine yazılmaz (eski belgeler ve güncellenmemiş mağazalar etkilenmez). Plan modülü servisi eksik limit satırını oluşturur (anahtardan önce kurulmuş paketler). Migration `Migration20261125004004` (plan modülü; geri alma önce bu anahtarın satırlarını siler). `packages/types/src/control-plane/ai-credits.ts`: `AI_TASK_CREDITS`, `AI_TASKS_WITHOUT_CREDITS` (`search_intent`, `test_text`), `AI_TASK_CAPABILITIES` (ağ geçidinin iş ile yetenek denetimi için), `AI_CALLS_PER_OPERATION`, işlem ömrü, uç şemaları; mağazada eşitlik testi `lib/ai/__tests__/credit-table.unit.spec.ts`. Mağaza panelinde hak, kullanım kutusu değil paket kartında etikettir ve yalnız bayrak açıkken görünür. Yan etki: yeni bayrak plan belgesine `false` olarak girdiği için `cp-plan-reconcile` her mağazanın belgesini bir kez yeniden yayımlar.

### PR P2: üst panel cüzdanı ve defteri (dış çağrı yok)

- **Dosyalar (yeni):** `modules/ai-credits/{index.ts,service.ts,models/*,migrations/*}` (`ai_credit_wallet`, `ai_credit_entry`, `ai_credit_operation`, `ai_credit_order`); `lib/ai-credits/{spend,grant,rollover,expire,reconcile}.ts`; `jobs/ai-credit-reconcile.ts` (defter toplamı ile cüzdan karşılaştırması, 15 dakikadan eski açık işlemlerin kapatılması).
- **Testler:** adr/0085 kabul testleri 1–6 (eşzamanlı harcama yarışı gerçek veritabanında; geri verme; işlem kimliğiyle ikinci çağrı ve çağrı tavanı; ay dönümü; `grant_ref` tekrarı; günlük tavan), son kullanma ve yüklemeyle uzama, denetim işinin farkı yazması.
- **Kabul:** harcama tek deyim; defter yalnız eklenir; modül tek başına (uç olmadan) testlerle çalışır.

### PR P3: sağlayıcı anahtarları ve ağ geçidi uçları

- **Dosyalar:** servis hedeflerinin (adres, yol, kimlik başlığı biçimi, model) ortak pakete taşınması (mağaza kaydı oradan okur; davranış değişmez); `lib/ai-gateway/{routing,forward,limits,errors}.ts`; `api/tenant-api/v1/ai/{credits,calls,orders}/route.ts`; `lib/fleet/tenant-api-routes.ts`; `lib/rate-limit-profiles.ts` (`tenant_api_ai`); `api/middlewares.ts` (gövde tavanı 6 MB, ham gövde); kasada `ai/<servis>/api_key`; `api/admin/cp/ai/{providers,routing}/**` (yalnız sahip rolü, denetim kaydı).
- **Testler:** kabul testleri 7–10; sahte sağlayıcıyla uçtan uca (kredi ayrılır, sağlayıcı yanıtı aynen döner, başlıklarda kredi ve bakiye); 5xx'te geri verme; model ve çıktı tavanının ağ geçidince yazılması; yetenek uyuşmazlığı reddi; hız ve gövde sınırı; anahtarın hiçbir yanıtta ve günlükte olmaması; bayrak kapalı ya da yönlendirme boşken "kullanılamaz".
- **Kabul:** ağ geçidi istekten adres almaz; içerik saklanmaz; `docs/kvkk-envanter.md` satırı.

### PR P4: mağaza sunucusu

- **Dosyalar:** `lib/ai/transport/{types,own-key,platform}.ts` (bağlayıcıların gönderimi taşıyıcıya ayrılır), `lib/ai/connector-of.ts`, `image-connector-of.ts`, `steps/{call-service,edit-image,assistant-turn}.ts` (tek fabrika); `lib/ai/registry/services.ts` (`platform`), `lib/control-plane/ai-credits.ts` (durum okuma, 60 sn önbellek, imzalı çağrı), `workflows/ai/connections.ts` (`platformCredits`, platformun "bağlı" sayılması), `steps/claim-quota.ts` (platform yolunda aylık sayaç alınmaz), `steps/record-usage.ts` + `assistant-record.ts` (`funding`, `credits`), `lib/ai/errors.ts` + iletiler (`ai.credits_exhausted`, `ai.credits_daily_cap`, `ai.platform_unavailable`), `api/admin/ai/credits/**`, `workflows/ai/services-view.ts`.
- **Testler:** sahte ağ geçidiyle http: yalnız platform; platform + kendi anahtar (varsayılan kendi anahtar); bakiye yok; günlük tavan; ağ geçidi kapalı; `ai_usage` satırı; vitrin araması platformu görmez; kendi anahtar yolunun var olan testleri değişmeden yeşil.
- **Kabul:** bayrak kapalıyken `GET /admin/ai/services` yanıtı bugünküyle aynı.

### PR P5: mağaza paneli

- **Dosyalar:** `features/settings/components/ai-credits-card.tsx`, `ai-credit-topup-dialog.tsx`, `features/ai/api/credits.ts`, `features/ai/services.ts` (`platform` adı), `ai-button.tsx` (1'den büyük kredi notu), `ai-suggestion-box.tsx` ("Kredi yükle"), `locales/{tr,en}.json`.
- **Testler:** kart durumları (hak var, bitti, satın alınan var, talep bekliyor, paket yok → "bize yazın"), `owner` olmayan talep düğmesi görmez, Vazgeç kırmızı, bayrak kapalıyken iz yok.

### PR P6: üst panel arayüzü

- **Dosyalar:** mağaza ayrıntısında cüzdan ve defter, "Kredi ekle / düş", talepler listesi ("Ödendi", "İptal"), Ayarlar › Yapay zekâ sağlayıcıları (anahtar, yönlendirme), yükleme paketleri, genel günlük tavan ve kredi ömrü, maliyet raporu; ilgili `api/admin/cp/ai/**` uçları.
- **Testler:** rol tablosu, notsuz düzeltme reddi, talep onayında tek `grant_purchase`, anahtar alanı geri doldurulmaz.

**Satış açılmadan önce (sahip):** yeniden satış izni (docs/12), mali müşavir (ön ödemeli kredi faturası, süresi dolan kredi), paket fiyatları ve aylık haklar, sözleşme metni. Kartla çevrim içi satın alma F16 ile.

## Aşama 2: ürün açıklaması taslağı

- **PR 2-1 (backend):** `product_description` işi (yalnız ürün; hazır seçenek `short` / `detailed`, başka değer 400; kapı: düz metin, `MIN_PRODUCT_WORDS`, 5.000 karakter tavanı); `lib/content-drafts/{redact,gate}` → `lib/ai/{redact,field-rules}`; ürün gerçekleri tek okuyucuda (`lib/ai/facts/product.ts`), eski istem çekirdeğin süzgecini kullanır. Ara dönemde panel kırılmasın diye eski uçlar `/admin/content-drafts*` aynen çalışır, yalnız iç kaynakları çekirdeğe bağlanır; `content-drafts.spec.ts` değişmeden yeşil kalır. Yeni testler: `ai-product-description.spec.ts` (çekirdeğin `/admin/ai/**` uçlarıyla).
- **PR 2-2 (panel + temizlik):** `content-drafts-card.tsx` yerine açıklama düzenleyicisinde `AiButton`; hazır seçenek: kısa / ayrıntılı. Aynı PR'da kalkar: `/admin/content-drafts*`, `workflows/content/drafts.ts`, `lib/content-drafts`, `content_draft` hız profili, `CONTENT_DRAFT_PROVIDER`, `content.ai_drafts` (`features/listed.ts`, `platform-settings/features.ts`, `plan-guard/rules.ts` dahil), `content-drafts.spec.ts`. `content-drafts` modülü kalır (çekirdek önerileri orada saklar); tablo düşürülmez, migration yok. Yapıldı: `CONTENT_DRAFT_MONTHLY_QUOTA` ve `content_drafts.*` hata anahtarları da kalktı; kaldırılan bayrağın kayıtlı değeri (ayar satırı ya da plan belgesi anahtarı) okunurken bilinmeyen anahtar sayılıp atlanır (`RETIRED_FEATURES`, birim + modül testi). Önerinin paragrafları düzenleyiciye düz paragraf olarak girer; kayıt kartın kendi Kaydet'idir.
- **Kabul:** adr/0005 kabul ölçütleri (onaysız yayımlanmaz, kişisel veri gitmez) yeni testlerde aynen duruyor. **Güvenlik incelemesi:** evet (kaldırılan bayrak ve uçlar).

## Aşama 3: advisor bulgusunda "Yapay zekâyla düzelt"

- `lib/seo/advisor` kurallarında `fix.kind: "suggest"` olan bulgulara iş adı eşlemesi (`lib/ai/registry/advisor-fixes.ts`); panel `features/seo/advisor` bulgu satırına `AiButton`. Kural motorunun kendisi değişmez. Test: eşlenen her kural için iş var; öneri uygulandıktan sonra bulgu kapanıyor.

## Aşama 4: arka plan temizleme + beyaz zemin

- **PR 4-1 (güvenlik incelemesi, migration):** `media_asset.ai_source`, `derived_from_id`; `lib/ai/connectors/{gemini-image,photoroom}.ts`; `photoroom` kimlik bilgisi kaydı; sonuç indirme (`safeFetch`, izinli alan adı, boyut tavanı) ve yükleme hattı doğrulaması; IPTC yazımı (`lib/media`), türevlerde korunması; `async-job` türü `ai-image-edit` (toplu). Deniz'e not: `modules/media` adr/0069 dilimleriyle aynı modül, migration sırası konuşulur.
- **PR 4-2 (panel):** ortam kütüphanesi ve ürün görsel kartında düğme; önce/sonra karşılaştırmalı öneri kutusu; "Kullan" yeni görseli ürüne ekler, asıl kalır.
- **Kabul:** asıl dosya baytı değişmez; sonuçta `DigitalSourceType` okunur; servis listede olmayan adres döndürürse reddedilir; depolama kotasına sayılır.

## Aşama 5: görsel alt metni

- `image_alt_text` (`vision`), tekli (`sync`) ve toplu (`async-job` `ai-alt-text`; yalnız alt metni boş olanlar, istekte en çok N). Kapı: uzunluk, "resmi", "görseli" gibi dolgu, kişisel veri. Toplu sonuç önerilerdir, liste ekranında tek tek ya da topluca onaylanır.
- **PR 5-1 (yapıldı):** `vision` üç serviste resmi belgeden doğrulandı (DeepSeek `deepseek-flash`, MiniMax `MiniMax-M3.1-Flash`, Gemini `gemini-4-hydrogen`; tarih ve adresler `lib/ai/registry/services.ts`). Görsel servise yalnız base64 `data:` adresiyle gider; sunucu dosyayı kendi deposundan okur, bayttan türünü tanır (JPEG, PNG, WebP, AVIF; SVG asla), 1024 px JPEG'e çevirir (üst veri yok, en çok 4 MB). Varlık türü `media` (ortam kaydı kimliği); giden veri: görsel + ürünü gösteriyorsa ürün adı ve görünen kategorisi (dosya adı, yükleyen, adres gitmez). Kapı: en çok 125 karakter, tek satır, dolgu sözcükleri (`lib/ai/alt-gate.ts`), bağlantı, kişisel veri, işaretleme. Toplu iş `ai.alt_text` (`input`: `media_ids` 1–50, isteğe bağlı `service`): alt metni boş ve bekleyen önerisi olmayan görseller, her biri ayrı öneri, kota ve kullanım satırı; aylık/günlük tavan ya da servis yokluğunda durur. Panel: ürün görsel kartının alt metin alanında ve ortam kütüphanesi ayrıntısında `AiButton` ("Kullan" alanı doldurur, alanın kendi kaydı yazar).
- **PR 5-2 (yapıldı):** ortam kütüphanesinde "Alt metin önerileri" penceresi (yalnız görevin rolleri: owner, admin). Üstte servis seçici (birden çok servis varsa) ve "Alt metni boş görseller için öner": panel kütüphanenin en yeni, alt metni boş, depolu raster görsellerinden bekleyen önerisi olmayan en çok 50'sini toplu işe verir; ilerleme ve sonuç pencerede (kapatılırsa iş sürer, Ayarlar › İşler'de görünür). Altta bekleyen öneriler: küçük resim, dosya adı, düzenlenebilir metin, tek tek Kullan/Vazgeç ve Tümünü kullan. Kullan bu ekranda onaydır: önce görselin alt metnini ortam kaydı ucuyla (`POST /admin/media/:id`) kaydeder, sonra öneriyi kabul edilmiş işaretler (`…/accept`); kayıt düşerse öneri açık kalır. Liste için tek yeni uç: `GET /admin/ai/suggestions?task=image_alt_text` (yalnız okur; görsel başına en yeni açık öneri, görsel hâlâ varsa; görevin rolleri). Seçili görsellerle başlatma yok: kütüphanede seçim kipi yok, ekran kalabalığı yerine "boş olanlar" tek düğme. Advisor P-IMG-02 eşlemesi yok: kuralın konusu ürünün birden çok görseli, iş tek görsel üzerinde; bulgunun "düzelt" bağlantısı zaten alt metni boş ilk görselin alanını (ve yanındaki düğmeyi) açar.

## Aşama 6: fotoğraftan ürün kartı

- `product_from_photo` (`vision`, yapılandırılmış çıktı): ad, kısa açıklama, önerilen kategori (var olanlardan), nitelik değerleri (şablondaki tanımlardan). Zod şemasında fiyat, stok, durum yok. Sonuç yeni ürün formunu doldurur; hiçbir şey kaydedilmez. **Güvenlik incelemesi:** evet (görseldeki yazı enjeksiyonu, şema).
- **Yapıldı:** istek `POST /admin/ai/suggestions` `{ task: "product_from_photo", entity_type: "media", entity_id, template_id? }` (başka alan kabul edilmez). Giden veri: fotoğraf (5-1 hattı) + mağazanın görünen kategorilerinin adları kısa kodlarla (`k1`…, en çok 150; iç ve kapalı kategoriler ve ata zincirinin herhangi bir yerinde iç ya da kapalı kategori olanlar gitmez; kimlik gitmez) + seçili şablonun ürün düzeyi nitelikleri (anahtar, ad, tür, birim, seçenekler). Ortam kaydının dosya adı, alt metni, yükleyeni gitmez. Yanıt tek JSON nesnesi: servisin JSON kipi kayıtta doğrulanmışsa istenir, yoksa metindeki ilk `{` ile son `}` arası ayıklanır; kapalı şema (`lib/ai/product-card.ts`): `title`, `short_description`, `category` (kod ya da tam ad), `attributes`. Başka her anahtar (fiyat, stok, durum, SKU, barkod, yayın) okunmadan atılır; listede olmayan kategori, şablonda olmayan nitelik, seçenek dışı değer düşer. Metinler ortak kapıdan geçer (uzunluk, işaretleme, bağlantı, kişisel veri, bağırma); ad ya da kısa açıklama kapıdan geçemezse ya da JSON yoksa öneri `refused`. Sistem isteminde fotoğraftaki yazının talimat değil veri olduğu açıkça yazar. Yanıtta `card` (kategori gerçek kimliğiyle) döner. Panel: yeni ürün sihirbazının ilk adımında "Fotoğraftan doldur" penceresi (fotoğraf seç → yüklenir → öneri → alan alan önizleme → Kullan formu doldurur, fotoğraf ilk görsel olur; kayıt yalnız formla). Sihirbaza "Özellikler" bölümü eklendi (şablon + ürün düzeyi alanlar; şablonun zorunlu alanları ürün oluşturulmadan formda denetlenir, hata alanın altında; ürün önce taslak oluşturulur, özellikler `POST /admin/products/:id/attributes` ile yazılır, "Yayınla" denmişse en son yayımlanır; özellik yazımı düşerse ürün taslak kalır, uyarı ve "Ürüne git" bağlantısı çıkar). Sayı niteliği en çok 12 anlamlı basamak ve sonlu olmalı, üslü yazım düşer. Fotoğraf kütüphanesiz yüklenir: vazgeçilen ya da değiştirilen fotoğrafı ürün almazsa gece süpürmesi bir gün sonra siler.

## Aşama 7: sahne görseli

- `image_scene` (`image_edit` / `image_generate`): en çok iki hazır sahne seçeneği, sektör paketinden gelir (koda sektör girmez). `ai_source: generated` ya da `edited`, IPTC buna göre.
- **Kendi sahneleri (2026-11-19; adr/0071 Ek 2026-11-19):** diyalogdaki çipler sırasıyla mağazanın kayıtlı sahneleri (en çok 12), paket sahneleri (Ayarlar › Yapay zekâ › Sahneler'de "Hazır sahneleri göster" ile gizlenebilir) ve "Özel". "Özel" tek seferlik bir arka plan tarifi alır (en çok 200 karakter, sayaçlı); "Sahnelerime kaydet" işaretliyse ad (en çok 40, boşsa tarifin ilk sözcükleri) ile listeye eklenir. Saklama: `platform_settings` bölümü `ai_scenes` (`show_pack_scenes`, `scenes[{id, name, prompt}]`); migration yok, yazma owner/admin. Güvenlik: metin sunucuda üç kez (doğrulayıcı, workflow, servis çağrısından önce) `cleanSceneText`'ten geçer (NFC, boşluk, uzunluk, bağlantı ve işaretleme karakteri reddi, kişisel veri ayıklama); istemde sunucunun sabit metni önde (kişi, el, marka, logo, yazı yok), Gemini talimatında koruma kuralları önce, sahne en sonda; iş özeti metni değil `scene: "custom"` taşır; kayıtlı sahne kimliği yalnız bu mağazanın listesinden çözülür. Sınır: liste bütün yazılır, eşzamanlı iki düzenlemede son kaydeden kazanır. Testler: `lib/ai/__tests__/own-scenes.unit.spec.ts`, `integration-tests/http/ai-scenes.spec.ts`, panelde `ai-scene-custom.spec.tsx`, `ai-scenes-card.spec.tsx`.

## Aşama 8: fotoğraftan kısa video

- `video_from_photo` (`video`): uzak iş başlat + sorgula, `async-job` `ai-video`; sonuç adr/0069 yükleme ve dönüştürme hattına girer (50 MB, 30 sn, kota). `catalog.product_videos` kapalıysa iş yok. Deniz'e not: adr/0069 dilimleri.

## Aşama 9: yorum özeti + soru cevap taslağı

- Ayrı kiracı bayrağı, varsayılan kapalı; yazar adı ve iletişim ayıklama; `operations` rolüne yalnız bu işler açılır; yanıt taslağı gönderilmez, forma düşer. **Güvenlik incelemesi:** evet (kişilerin yazdığı metin; KVKK envanteri güncellenir).

## Ürün ekranı genişletme 1 (yapıldı)

- **`focus_keyword`** (`text`; varlık: ürün, kategori, içerik sayfası, yani SEO kartında yapay zekâ olan kayıtlar): kaydın herkese açık bilgilerinden bir ana odak anahtar kelime ve 2–3 alternatif, satır başına bir tane. Yanıt şekillendirilir (liste imi, "Ana anahtar kelime:" gibi etiket, tırnak, nokta atılır; küçük harf; tekrarlar ve dördüncüden sonrası düşer; virgülle yazılmışlar ayrı sayılır), sonra kapı: her satır en çok 60 karakter ve 6 sözcük, yalnız harf, rakam, boşluk, kısa çizgi, kesme; bağlantı, kişisel veri, gizlenmiş ad yok. Panel: SEO kartındaki "Odak anahtar kelime" alanının yanında düğme; her satırın kendi "Kullan"ı alanı doldurur, kayıt kartın Kaydet'i. Koleksiyon, marka, yazı ve açılış sayfalarında olgu okuyucusu olmadığından (SEO başlığı/açıklaması gibi) düğme yok.
- **`product_title`** (`text`; yalnız ürün; ürünün açıklamasından 1.000 karakter okunur): marka + tür/model + ayırt edici özellik düzeninde daha açık ad; hedef 30–80, üst sınır 120 karakter. Kapı: tek satır, bağırma ya da üç kez geçen sözcük yok, bağlantı ve kişisel veri yok, ve **uydurma yok**: adın her sözcüğü servise gönderilen veri bloğunda bulunmalı (rakamlı sözcük birebir; üç harf ve üstü sözcük ilk beş harfiyle, Türkçe ekler için; "ve", "ile", "için" gibi bağlaçlar serbest), yoksa `ungrounded` ile reddedilir. Panel: genel karttaki "Ürün adı" alanının yanında düğme.
- Ortak: roller owner/admin, 1 kredi, `ai_text` hız profili, kullanım satırı öneriden önce yazılır; giden veri SEO işleriyle aynı okuyucudan (fiyat, stok, iç kategori, kişisel veri gitmez). Testler: `lib/ai/__tests__/catalog-tasks.unit.spec.ts`, `integration-tests/http/ai-catalog-tasks.spec.ts`, panelde `ai-button-choices.spec.tsx`, `seo-card.spec.tsx`, `general-card.spec.tsx`.

## Aşama 10a: vitrin arama niyeti (adr/0077)

Müşterinin vitrinde yazdığı cümleyi ("ağustosta iki kişi Kapadokya") arama süzgecine çeviren `search_intent` işi. Kiracı bayrağı `ai.storefront_search`, varsayılan kapalı; yalnız mağazanın kendi anahtarıyla. Çıktı katı Zod, yalnız süzgeç (kategori ve nitelik değeri mağazanın kapalı listesinden, tarih/ay, kişi); sonuçları normal arama üretir, etiketler sunucunun doğrulanmış süzgecinden kurulur. Metin `redactPersonalData`'dan geçer, saklanmaz, `ai_usage`'a yazılmaz (isteyen `"vitrin"`). Sınır: IP başına dakikada 5 / günde 30, mağaza başına günde 500, 24 saat önbellek; servis düşerse `q` aramasına döner. Bu, adr/0071 §10'daki "müşteri verisi gitmez" kuralının tek istisnasıdır (adr/0077 §7). PR'lar: backend (uç `api/store/search/interpret`, `security-reviewer` zorunlu) ve arayüz ("Kendi cümlenle ara", panelde anahtar).

## Panel yardımcısı (adr/0079)

Panelin sağında açılan doğal dil yardımcısı: kapalı araç listesi, kullanıcının kendi rolü, yazan her işlem önizleme + "Uygula". Bayrak `ai.assistant` (kiracı, varsayılan kapalı). PR tablosu, dosyalar ve testler adr/0079 "Uygulama sırası"nda; özet:

- **Y1-0:** panel haritası (`packages/types/src/panel-map`) + komut menüsünde anahtar kelimeyle arama (yapay zekâsız; bayrak kapalıyken de).
- **Y1-1 (güvenlik incelemesi):** bağlayıcıya araçlı çağrı (`converse`), servis kaydında `toolCalls` belgeden doğrulanır; döngü, Redis'te geçici konuşma (istem metni saklanmaz), `find_screen` / `explain_screen`, uç `POST /admin/ai/assistant/turns`, günlük grup `assistant`, KVKK envanter satırları. **Y1-2:** panel yan paneli. **Y1-3:** eval seti (CI'da sahte modelle; gerçek modelle elle `ai:eval`).
- **Y2-1 (güvenlik incelemesi):** okuma araçları (satış özeti, stoğu azalan, sipariş bul, SEO bulguları, düşük dönüşüm); sonuç `model` (maskeli) ve `ui` (yalnız panel) yüzleri. **Y2-2:** kartlar.
- **Y3-1, Y3-2 (güvenlik incelemesi, migration `ai_assistant_action`):** onaylı yazma (indirim, ürün gizle/göster, stok, toplu fiyat kuralı, taslak yazı, taslak düzene bölüm). **Y3-3:** eylem kartı.
- **Y4-1 (güvenlik incelemesi):** plan kartı ve geri alma.

## Aşama 10–13

Akıllı arama (`embedding`; adr/0056 ile), görünüm asistanı, toplu komut, 3D ve ajan ticareti: her biri kendi ADR'siyle. Toplu komutun panel kısmı panel yardımcısıdır (adr/0079, yukarıda). Bu çekirdek onlara yalnız servis kaydı, seçim, kota ve kullanım kaydını verir.

## Doğrulanacak servis bilgileri (ilgili PR'ın ilk işi)

| Servis | Ne | Hangi PR |
|---|---|---|
| DeepSeek | OpenAI uyumlu uç, taban adres, model adları, JSON kipi, veri işleme şartları | 0b-1 |
| MiniMax | OpenAI uyumlu metin ucu, bölgesel adresler, görsel okuma var mı | 0b-1 |
| Gemini | OpenAI uyumluluk ucunun kapsamı, anahtarın başlıkla gönderimi, ücretsiz katman veri şartı | 0b-1 |
| Gemini | görsel düzenleme ve üretim uçları, filigran | 4-1, 7 |
| Photoroom | uçlar, alan adları, başlık, deneme kipi, beyaz zemin parametreleri | 4-1 |
| MiniMax | görsel üretim, fotoğraftan video, sonuç indirme alan adları | 7, 8 |
| Gemini | video üretimi: erişim ve ücret katmanı | 8 |
| Tümü | yeniden satış izni (platform kredisi için) | kredi aşaması, docs/12 |

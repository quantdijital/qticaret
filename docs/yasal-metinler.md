# Yasal metin taslakları: dayanılan mevzuat, yıllık rakamlar, açık sorular

> F13.7 (adr/0041 §1). Platform her mağazaya yedi yasal metnin ayrıntılı taslağını verir. Taslaklar **3 Kasım 2026'da yürürlükteki mevzuata** göre yazıldı (kullanıcı isteği, 2026-11-03: "taslak olarak kalsınlar").
> Her taslak bir not kutusuyla açılır: "TASLAK: Bu metin bir başlangıç iskeletidir…". Avukata sorulacaklar bu kutuda numaralıdır. Kutu metinde durduğu sürece yayım reddedilir (`legal.draft_note_present`, `hasStarterNote`). Kutunun dışındaki metin olduğu gibi yayımlanır, bu yüzden orada taslak işareti yoktur.
> Projede avukat yok (docs/12, `project-no-company-no-advisers`). Metinlerin hukuki doğruluğu mağazanın ve avukatının sorumluluğudur.
> Kod: `apps/backend/src/lib/legal/starters/` (metin başına bir dosya; ortak maddeler `clauses.ts` ve `shared.ts`). Testler: `lib/legal/__tests__/starters.unit.spec.ts`, `withdrawal.unit.spec.ts`; HTTP `integration-tests/http/legal-documents.spec.ts`.

## Metinler

| Metin | Tür (`kind`) | Vitrin adresi | Dayandığı mevzuat | Dosya |
|---|---|---|---|---|
| Ön Bilgilendirme Formu | `pre_information` | `/yasal/on-bilgilendirme-formu`, ödeme adımı, siparişin kopyası | 6502 sayılı TKHK md. 4, 8–12, 48, 55–56, 68, 73, 73/A; Mesafeli Sözleşmeler Yönetmeliği (MSY) md. 5–9, 11–20; 6563 sayılı ETK md. 3–4 | `pre-information.ts` |
| Mesafeli Satış Sözleşmesi | `distance_sales` | `/yasal/mesafeli-satis-sozlesmesi`, ödeme adımı, siparişin kopyası | Yukarıdakiler; TBK md. 117, 136; 3095 sayılı Kanun; HMK md. 199; ETK md. 6, 8; KVKK | `distance-sales.ts` |
| KVKK Aydınlatma Metni | `privacy_notice` | `/yasal/kvkk-aydinlatma-metni` | 6698 sayılı KVKK md. 4–5, 7–14 (md. 9: 7499 sayılı Kanunla değişik); Aydınlatma Yükümlülüğü Tebliği md. 5; Veri Sorumlusuna Başvuru Tebliği md. 5; Kurul İlke Kararı 2026/347; TTK md. 82; VUK md. 253; MSY md. 20; Ticari İletişim Yönetmeliği md. 13 | `privacy-notice.ts` |
| Çerez Politikası | `cookie_policy` | `/yasal/cerez-politikasi`, çerez bandı, `/cerez-tercihleri` | KVKK md. 5, 11; KVKK Kurumu Çerez Uygulamaları Hakkında Rehber (2022) | `cookie-policy.ts` |
| Üyelik Sözleşmesi | `membership` | `/yasal/uyelik-sozlesmesi`, kayıt formu | TKHK md. 5; ETK md. 6, 8; FSEK (5846); SMK (6769); KVKK | `membership.ts` |
| İade ve Değişim Politikası | `return_policy` | `/yasal/iade-politikasi` | TKHK md. 11–12; MSY md. 9–15 | `return-policy.ts` |
| Teslimat ve Kargo Politikası | `shipping_policy` | `/yasal/kargo-politikasi` | TKHK md. 48/3; MSY md. 5/3, 16, 17, 19 | `shipping-policy.ts` |

Ön bilgilendirme formu ve mesafeli satış sözleşmesi aynı cayma, ayıp ve uyuşmazlık maddelerini paylaşır (`clauses.ts`, `shared.ts`). Cayma maddesinin başlığı metindeki "cayma" geçen **ilk** başlıktır: sunucu, siparişte kişiye özel ürün ya da hediye kartı varsa kendi cümlesini bu bölümün sonuna, istisnalar listesinin ardına koyar (`withdrawal.ts`, `withPersonalLines`).

## Doğrulanan mevzuat (2026-11-03)

| Konu | Kullanılan bilgi | Kaynak |
|---|---|---|
| MSY değişiklikleri | Yönetmelik RG 27.11.2014/29188. Değişiklikler: RG 23.8.2022/31932 (1.10.2022), RG 14.9.2022/31953, RG 4.11.2023/32359 (Geçici md. 1), RG 10.8.2024/32628 (erteleme 1.1.2026'ya), **RG 24.5.2025/32909 (1.1.2026'dan beri yürürlükte)** | mevzuat.gov.tr, MevzuatNo 20237 |
| Ön bilgilendirme | md. 5/1 a–k: satıcı kimliği, MERSİS/VKN, iletişim, şikâyet iletişimi, vergiler dahil fiyat, teslim masrafı, ödeme ve teslim, cayma şartları ve **iade için öngörülen taşıyıcı (5/1-g, 2025 değişikliği)**, cayma bildirimi adresi, istisnalar, depozito, dijital içerik, **hakem heyeti, tüketici mahkemesi ve dava öncesi arabuluculuk (5/1-k, 2025 değişikliği)**. md. 6 en az 12 punto, md. 7 teyit, md. 8 ödeme yükümlülüğü bildirimi | mevzuat.gov.tr |
| Cayma süresi | 14 gün, mal tesliminden; ayrı teslimde son ürün, parçalı teslimde son parça; teslimden önce de kullanılabilir (md. 9) | mevzuat.gov.tr |
| Alıcının iade süresi | Cayma bildiriminden itibaren **14 gün** (md. 13/1; "dört" ibaresi 1.1.2026'da yürürlüğe girdi, önce 10 gündü) | mevzuat.gov.tr |
| Satıcının para iadesi | Teslimden sonra cayıldıysa malın **satıcının iade için belirttiği taşıyıcıya teslim edildiği** tarihten, başka taşıyıcıyla gönderildiyse malın satıcıya ulaştığı tarihten; teslimden önce cayıldıysa bildirimin ulaştığı tarihten itibaren 14 gün; teslim masrafları dahil, aynı ödeme aracına, tek seferde (md. 12) | mevzuat.gov.tr |
| İade masrafı | Satıcının belirttiği taşıyıcıyla gönderilen iadede alıcıdan masraf istenemez; taşıyıcı belirtilmemişse de istenemez; taşıyıcının şubesi yoksa satıcı ek masrafsız aldırır (md. 12) | mevzuat.gov.tr, hukukihaber.net (RG 32909 metni) |
| Cayma istisnaları | md. 15/1 **a–h**. 2022'de eklenen (ı), (j), (k) Danıştay 10. Dairesinin 6.5.2026 tarihli E.2022/5534, K.2026/2753 kararıyla iptal edildi; (i) RG 32909 ile yürürlüğe girmeden kaldırıldı. **Kişiye özel ürün 15/1-b'dir** (15/1-ç hijyendir) | mevzuat.gov.tr (iptal şerhi), dha.com.tr |
| Teslim süresi | En çok 30 gün, kişiye özel ürün hariç; fesihte 14 gün içinde kanuni faiziyle iade; imkânsızlıkta 3 gün içinde bildirim, 14 günde iade; stok yokluğu imkânsızlık sayılmaz (md. 16) | mevzuat.gov.tr |
| Hasar ve kayıp | Alıcıya ya da belirlediği (taşıyıcı dışındaki) kişiye teslime kadar satıcıda (md. 17) | mevzuat.gov.tr |
| Kayıt saklama | Satıcı 3 yıl (md. 20) | mevzuat.gov.tr |
| Ayıplı mal | TKHK md. 8 tanım, md. 9 satıcının sorumluluğu, md. 10 altı ay karinesi, md. 11 dört seçimlik hak ve onarım/değiştirmede en çok 30 iş günü, md. 12 iki yıl zamanaşımı, md. 56 garanti en az iki yıl | mevzuat.gov.tr (6502) |
| Uyuşmazlık | TKHK md. 68 hakem heyeti (tüketicinin yerleşim yeri ya da işlemin yapıldığı yer), md. 73 tüketici mahkemesi (tüketicinin yerleşim yerinde de), md. 73/A dava şartı arabuluculuk | mevzuat.gov.tr (6502) |
| KVKK | md. 5/1 açık rıza, 5/2 a–f; md. 9 (7499 sayılı Kanunla, 1.6.2024'ten beri): yeterlilik kararı, uygun güvenceler (standart sözleşme 5 iş günü içinde Kuruma bildirilir), arızi aktarım; md. 10 a–d; md. 11 a–ğ; md. 13 30 gün; md. 14 30/60 gün | mevzuat.gov.tr (6698) |
| Başvuru yolu | Yazılı, KEP, güvenli elektronik imza, mobil imza, sistemde kayıtlı e-posta ya da başvuru yazılımı (Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ md. 5, RG 10.3.2018/30356) | arama sonuçlarındaki Tebliğ kopyaları |
| Aydınlatma ve açık rıza | Ayrı metin, ayrı beyan; aydınlatma için "okudum, kabul ediyorum" onayı alınmaz; açık rıza yalnız gerçekten ona dayanan işlemede (Kurul İlke Kararı 18.2.2026, 2026/347, RG 24.3.2026/33203) | alomaliye.com |
| Ticari ileti | ETK md. 6 onay (tacir/esnafa istisna), md. 8 ret ve 3 iş günü; Ticari İletişim Yönetmeliği md. 13 onay kaydı onayın sona ermesinden itibaren 3 yıl | mevzuat.gov.tr (6563), alomaliye.com |
| Çerezler | Kategoriler (zorunlu, işlevsel, performans-analitik, reklam-pazarlama), zorunlu çerezde rıza aranmaz, gezinmeye devam rıza değildir, kabul ve ret seçenekleri eşit, geri alma kolay (Çerez Uygulamaları Hakkında Rehber, Haziran 2022) | kvkk.gov.tr duyurusu, hukukihaber.net özeti |
| Çerez süreleri | `_ga` ve `_ga_<kimlik>` 2 yıl (Google Analytics yardım sayfası 11397207); `_fbc` 90 gün (Meta geliştirici belgesi), `_fbp` 90 gün (ikincil kaynaklar); kendi çerezlerimiz vitrin kodundan | support.google.com, developers.facebook.com |

## Her yıl güncellenen rakam

| Rakam | 2026 değeri | Kaynak | Nerede |
|---|---|---|---|
| Tüketici hakem heyeti parasal sınırı | **186.000 TL** (altındaki uyuşmazlıklar il/ilçe hakem heyetine) | RG 23.12.2025/33116, yürürlük 1.1.2026 | `ARBITRATION_LIMIT` (`lib/legal/starters/shared.ts`); ön bilgilendirme 7.2, sözleşme 14.2, üyelik 12.2 |

Yeni yılın sınırı her aralık ayında Resmî Gazete'de yayımlanır; o zaman `ARBITRATION_LIMIT` güncellenir (yeni taslaklar için). Yayımlanmış metinler mağazanındır: mağaza kendi metnindeki tutarı değiştirir. Metin tutarı yılıyla birlikte yazdığı için eski kalsa da yanıltmaz.

## Belirteçler

Metinler yalnız kayıttaki belirteçleri kullanır (`lib/legal/tokens.ts`; test: her belirteç kayıtta, politikalarda sipariş belirteci yok).

- **Yeni (2026-11-03):** `{hazırlama_süresi}` ve `{kargo_süresi}`. Ayarlar > Kargo ve teslimat > Teslim süresi'ndeki gün aralıklarından dolar ("1–2 iş günü", `workingDaysText`). Panel etiketleri `legal.tokens.names`.
- **Belirteç eklenmedi, not kutusuna yazıldı:** iade için öngörülen taşıyıcının adı ve anlaşmalı kargo firmalarının adları (ayarlarda bu bilgi yok). İade kargo ücretini kimin ödediği için belirteç bilerek eklenmedi: cayma iadesinde kural yasanındır (MSY md. 12) ve ayardan bağımsız yazıldı. Ücretsiz kargo eşiği (`ücretsiz_kargo_eşiği`) de eklenmedi: eşiği olmayan mağazada cümle "—" ile okunurdu; metin "ödeme adımında gösterilir" der.

## Avukata sorulacaklar

Her metnin not kutusunda kendi listesi var. Özetle:

1. İade için öngörülen taşıyıcının adının yazılması (MSY md. 5/1-g).
2. Kısmi iadede gidiş kargo ücretinin iadesi; değer kaybı kesintisi (md. 12/1, 13/2).
3. Hediye kartında cayma kuralının (kartlardan harcama yapılmadıkça cayma var) md. 15/1-ğ karşısında yeterliliği.
4. Kapıda ödeme ve havale iadelerinde IBAN istenmesi ve hesabın alıcı adına olması şartı.
5. Teslim edilemeyen ya da teslim alınmayan gönderinin yeniden gönderim ücreti; kapıda ödemeli gönderinin reddinin cayma sayılması.
6. Tacir alıcılar için ayrı hükümler; delil maddesinin kapsamı.
7. Yurt dışı aktarımın dayanağı (CDN/güvenlik, e-posta gönderimi, Google, Meta, sosyal giriş); sağlayıcıların adlarının metinde sayılması.
8. Ticari iletinin hukuki sebebi (ETK md. 6 onayı ve KVKK md. 5/1 açık rıza) ve 2026/347 İlke Kararına göre ayrı açık rıza metni.
9. Saklama süreleri (docs/kvkk-envanter.md önerileri), VERBİS, 5651 trafik kayıtları.
10. `__Host-qt_landing` çerezinin onaysız kalıp kalamayacağı; çerez bandının düğme belirginliği.
11. Üyelikte yaş şartı, askıya alma/sona erdirme, kullanıcı içeriği izni, sözleşme değişikliği yöntemi.
12. Sektöre özel satış kısıtları (yaş sınırı vb.) için ek madde.

Platformun kullandığı yurt dışı sağlayıcılar (aydınlatma metni kategoriyle yazar): CDN/WAF Cloudflare (adr/0003), e-posta gönderimi Resend (adr/0036), izinle ölçüm Google Analytics 4 ve Meta (adr/0038), sosyal giriş Google ve Apple (adr/0037). Veritabanı, dosya deposu, yedekler ve hata izleme Türkiye'de (adr/0003, adr/0045).

## Metinlerle çelişen platform davranışları (kod işi, bu görevin kapsamı dışında)

Taslaklar yasaya göre yazıldı; aşağıdakiler metinle uyumlu olsun diye ayrıca düzeltilmeli:

1. **Kargo ücretinin iadesi:** iade akışı kargo ücretini varsayılan olarak iade etmiyor (adr/0032 §5). Cayma iadesinde teslim masrafları dahil iade edilir (MSY md. 12/1).
2. **"İade kargosunu ödeyen: Müşteri" ayarı** (Ayarlar > Kargo ve teslimat > İade): satıcının belirttiği taşıyıcıyla yapılan cayma iadesinde alıcıdan masraf istenemez (md. 12). Seçenek ya kaldırılmalı ya da yalnız yasal zorunluluk dışındaki iadeler için yeniden adlandırılmalı; `hasMerchantReturnPolicy` buna göre gözden geçirilmeli.
3. **Ürün düzeyindeki "Cayma hakkı dışında" işareti** vitrinde ürün sayfasında gösterilmiyor (yalnız kişiye özel ek seçenekte uyarı var); md. 5/1-h ve md. 6/2 bunu siparişten önce ister. İşaret ürünü ambalajı açılmamış olsa da iade dışı tutuyor; hijyen istisnası (15/1-ç) yalnız koruyucu ambalajı açılmış üründe geçerli. Paneldeki ipucu ("…yalnızca kusurlu çıkarsa geri alınır") da buna göre düzeltilmeli.
4. **"MSY md. 15/1-ç" atfı yanlış:** kişiye özel ürün 15/1-b'dir. `lib/legal/withdrawal.ts` düzeltildi; hâlâ "15/1-ç" diyenler: panel `locales/tr.json` ve `en.json` (`nonWithdrawableHint`), `features/orders/components/non-withdrawable-badge.tsx` yorumu, backend `lib/catalog/addons/schema.ts` yorumu, adr/0052, PROGRESS.
5. **Para iadesinin zamanı:** yasal süre malın iade taşıyıcısına teslimiyle başlar; platform parayı depoya varışta iade ediyor. Taşıma ve kontrol 14 günü aşmamalı.
6. **İade talebi formu** cayma süresi dolunca kapanıyor; ayıplı ürün başvuruları sonrasında e-posta ve telefonla alınıyor (metinler böyle yazıldı). Vitrinde ayrı bir "ayıplı ürün başvurusu" yolu düşünülebilir.
7. **IBAN:** kapıda ödeme ve havale iadesinde müşterinin banka hesabı platformda tutulmuyor; personel e-postayla alıyor (docs/kvkk-envanter.md "Açık konular").
8. **Gövde sınırı:** yasal metin taslak ve önizleme uçları Medusa'nın varsayılan 100 kB JSON sınırıyla çalışıyor (içerik uçları 1 MB). Taslaklar 10–29 kB; mağazanın uzun eklemeleri için `legal-routes.ts`'e `bodyParser.sizeLimit` eklenmesi önerilir.

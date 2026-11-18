# 12 — Kod Dışı Gereksinimler

> Yazılımın canlıya çıkıp satılabilmesi için gereken hukuki, ticari ve operasyonel işler.
> Kod yazılmaz ama ilgili fazların kabulünü bloklayabilir. Son sütun hangi fazı etkilediğini gösterir.
> Bu dokümandaki yasal başlıklar tasarım rehberidir; kesin yükümlülük ilgili uzmanla doğrulanır.

## Hukuk ve uyum
| Kalem | Sorumlu / danışılacak | Etkilediği faz |
|---|---|---|
| SaaS hizmet sözleşmesi + SLA (platform ↔ tenant) | Avukat | F17 |
| KVKK veri işleyen sözleşmesi (platform = veri işleyen, tenant = veri sorumlusu) | KVKK danışmanı | F16, F17 |
| Platformun kendi KVKK aydınlatma metni, VERBİS değerlendirmesi | KVKK danışmanı | F17 |
| Yurt dışı veri aktarımı değerlendirmesi (hosting, e-posta, Sentry, CDN) | KVKK danışmanı | ADR-0003 |
| Tenant'lar için yasal metin şablonları (mesafeli satış, ön bilgilendirme, KVKK, çerez, iade) | Avukat | F13.7 |
| Yasal metin taslaklarının avukat kontrolü (2026-11-03'te yürürlükteki mevzuata göre ayrıntılı taslak; yedi metin): dayanılan maddeler, her yıl güncellenen hakem heyeti sınırı, avukata sorulacaklar ve metinle çelişen platform davranışları `docs/yasal-metinler.md`'de. Not kutusu silinmeden metin yayımlanmaz | Avukat + KVKK danışmanı | F13.7 |
| MSY 2026 uyumu (RG 24.5.2025/32909, 1.1.2026'dan beri; adr/0032 Ek ve adr/0052 Ek, 2026-11-03). **Yapılanlar:** cayma iadesi gidiş kargo ücretini ilk iadeyle bir kez geri verir, kısmi iadede de (md. 12/1); "İade kargosunu müşteri öder" seçeneği kaldırıldı, kayıtlı değer mağazaya taşındı (md. 12/5, 13/3 mülga); iade kargosunun teslim tarihi takipten kaydediliyor, 10. günde para iade edilmemişse personel uyarılıyor (md. 12/1); fiziksel üründeki "cayma dışı" işareti hijyen uyarısı oldu, ambalajı açılmış ürün teslim almada reddediliyor (md. 15/1-ç); kişiye özel ürün atfı 15/1-b. **Açık (avukata):** kısmi iadede kargo ücretinin iadesi (varsayılan: iade edilir; avukat aksini derse mağaza ayarı olur); kapıda ödeme ücretinin "tahsil edilen tüm ödemeler"e girmesi; reddedilen ürünün geri gönderim ücreti; değer kaybı kesintisi (md. 13/2); iade taşıyıcısının adının ön bilgilendirmede yazılması (md. 5/1-g). `docs/yasal-metinler.md` "Metinlerle çelişen platform davranışları" listesinde backend tarafı kapananlar: 1, 2, 3 (işaret talebi engellemiyor; ürün sayfasında gösterim vitrin işi), 4, 5 ve 8 (yasal metin uçlarında 1 MB gövde) | Avukat | F13, adr/0032 |
| İndirimli fiyat gösterimi kuralı teyidi: mal satışında indirimden önceki 10 günün en düşük fiyatı (Fiyat Etiketi Yön. md. 11/1, RG 11.10.2025/33044; Ticari Reklam Yön. md. 14/3, RG 1.7.2026/33297); kademeli derinleşen indirimde "indirimden önceki fiyat"ın ilk adımdan önceye mi son adımdan önceye mi bakacağı; herkese uygulanan otomatik kampanyanın fiyat olarak gösterilmesi ve koşullu kampanyada (md. 14/7) "Sepette %N indirim" ifadesi (ADR-0023, Ek 2026-11-05) | Avukat | F4.3 |
| Sektöre özel satış kısıtları (ilk müşteri: bıçak — 6136 sayılı kanun kapsamı, yaş sınırı) | Avukat | F13.3, F13.4 |
| Ticari ileti / İYS süreçleri | Avukat | F9.5, F10.7 |
| Ödeme modeli teyidi: platform tenant adına para toplamaz (lisans gerektirmez) | Avukat | F5, F6, F17.3 |
| Veri ihlali bildirimi: 72 saat Kurul bildirimi, ilgili kişi bildirimi, platform/tenant sorumluluk paylaşımı (veri işleyen sözleşmesinde) | KVKK danışmanı | F13.10 |
| LLM/AI sağlayıcısıyla veri işleme sözleşmesi ve yerleşim (yalnızca ürün verisi gönderilse de). adr/0071: servislerin tamamı yurt dışında (DeepSeek, MiniMax, Gemini, Photoroom); "Kendi anahtarım" yolunda sözleşmenin tarafı mağaza, platform kredisi yolunda platform. Teyit edilecekler: kişisel veri içermeyen ürün içeriği ve ürün görselinin (görselde kişi olabilir) yurt dışındaki servise gönderilmesi; yorum ve soru metinlerinin ad ayıklanarak işlenmesi (Aşama 9); `ai_usage` kaydının saklama süresi (öneri 24 ay) | KVKK danışmanı | F10.13, ADR-0005, ADR-0071 |
| Ters ibraz (chargeback) süreçleri ve belge gereksinimleri | Ödeme sağlayıcı + avukat | F6.7 |
| Adres referans verisi (il/ilçe/mahalle/posta kodu) kaynağı ve kullanım lisansı: PTT/TÜİK verisinin ticari kullanımı ve tenant'lara dağıtımı. 2026-11-04'ten beri kaynak TürkiyeAPI (MIT; şartlar adres formlarında kullanımı sayıyor, docs/entegrasyonlar/turkiye-api.md); TÜİK/PTT kaynaklı verinin ticari kullanımı yine avukata | Avukat | F1.3, F16 (ADR-0008) |
| Denetim kaydı ve erişim bilgisi (IP, user agent, okuma kayıtları) saklama süresi; öneri 2 yıl | KVKK danışmanı | F2.5, F13 (ADR-0011) |
| Tüm kişisel veri saklama sürelerinin onayı (sipariş 10 yıl, sözleşme kopyası 3 yıl, İYS kanıtı 3 yıl, terk edilmiş sepet 30 gün, çerez yanıtı 2 yıl...); liste `docs/kvkk-envanter.md` | KVKK danışmanı + mali müşavir | F13.5 |

## Mali ve vergi
| Kalem | Sorumlu / danışılacak | Etkilediği faz |
|---|---|---|
| E-fatura/e-arşiv kuralları: bireysel alıcıda TCKN yoksa uygulama, iade faturası | Mali müşavir | F8 |
| **Canlıdan sonra** (karar 2026-11-17): başvuru şirket alan adı hazır olunca yapılır; birinci plan BirFatura, Paraşüt ikinci plan. Paraşüt platform API istemcisi (`destek@parasut.com`; e-posta taslağı 2026-10-31'de kullanıcıya verildi): istemci kimliği ve sırrı; yetki kodu akışının (kodu panele yapıştırma, `urn:ietf:wg:oauth:2.0:oob`) platform istemcisine açılması; GİB'e belge göndermeden deneme yapılabilecek test (staging) ortamı ve test firması; istek sınırları; tekrar önleyici anahtar; e-belge serisinin API'den seçilip seçilemeyeceği (web satışları ayrı seriyle) | Quant Dijital | F8 (ADR-0034), canlıdan sonra |
| Mali müşavir soru listesinin cevapları (`docs/mali-musavir-sorulari.md`) | Mali müşavir | F8 |
| KDV oran grupları (%20/%10/%1) ve kargo bedelinin KDV oranı; tenant ürün gruplarının hangi orana düştüğü | Mali müşavir | F1.2 (ADR-0007) |
| Kuruş yuvarlama kuralı (yarım yukarı) ve sepet indiriminin kalemlere dağıtımının faturadaki karşılığı | Mali müşavir | F2.7, F4.7, F8 (ADR-0010) |
| İndirim ve kargo bedelinin faturada gösterimi | Mali müşavir | F4.7, F8 |
| Hediye kartı ve mağaza kredisinin vergisi: satışta mı kullanımda mı KDV, e-fatura/e-arşiv karşılığı, kullanılmayan bakiyenin muhasebesi | Mali müşavir | F4.8, F8 (ADR-0025) |
| Kapıda ödeme tahsilat mutabakatı ve muhasebeleştirme | Mali müşavir | F6.6, F11.3 |
| Platformun kendi abonelik faturası ve e-fatura mükellefiyeti | Mali müşavir | F17.3 |
| Muhasebe programı aktarım formatları (Paraşüt/Logo/Mikro) | Mali müşavir + tenant | F11.5 |

## Sağlayıcı anlaşmaları
| Kalem | Muhatap | Etkilediği faz |
|---|---|---|
| iyzico / PayTR: tenant hesap açılış süreci, platform referans/iş ortaklığı modeli | Sağlayıcı satış ekibi | F5, F6 |
| PayTR testi (karar 2026-11-17): PayTR'ye e-posta ve ayrı test mağazası yok. Test, gerçek bir mağazanın PayTR hesabında (My L'arte'ninki ya da yeni açılan mağazanınki) test modunda yapılır, sonra aynı hesap canlıya geçer. Bildirim adresi hesap başına tek; dev için herkese açık bildirim adresi (tünel). Taksit oranları API'sine erişim (alt satır) o hesapta denenene kadar doğrulanmamış sayılır | Kullanıcı | F5 (adr/0026) |
| PayTR: yalnızca iFrame kullanan hesabın taksit oranları API'sine erişimi | PayTR | F5.8 |
| iyzico webhook V3 imzasının açtırılması (entegrasyon@iyzico.com); sandbox hesabı | Kullanıcı + iyzico | F5.11 |
| Geliver: tenant hesabı, kapıda ödeme desteği, iade kodu süreçleri | Geliver | F6.6, F7 |
| E-fatura entegratörü seçimi ve fiyatlandırma | Entegratörler | F8 |
| BirFatura canlıya çıkmadan önce: mağaza ile BirFatura arasında veri işleme (veri işleyen) sözleşmesi; alıcı verisinin (ad, adres, telefon, e-posta, TCKN/VKN) yalnız Türkiye'de işlenip saklandığının yazılı teyidi (KVKK md. 9; `docs/kvkk-envanter.md` BirFatura satırında "yurt içi" doğrulanmadı) | Mağaza + BirFatura (+ KVKK danışmanı) | F16 (ADR-0072) |
| SMS sağlayıcısı (başlık onayı, İYS entegrasyonu) | SMS sağlayıcısı | F9 |
| E-posta gönderim servisi: tenant başına ayrı Resend hesabı/takımı (adr/0036 ek), alan adı doğrulama, hacim | Resend | F9.6, F16 |
| Hosting, CDN/WAF sağlayıcıları | Sağlayıcılar | ADR-0003, F15.7, F16 |
| Doğrudan kargo firması API erişimi (ilk müşterinin anlaşmalı firması) | Kargo firması | F7.14 |
| Google Search Console, Merchant Center, CrUX API erişimi (tenant mülkü, OAuth uygulaması; platform için Google Cloud projesi) | Google | F10.11, F10.8 |
| Google Business Profile API erişimi: platform projesi için "Basic API Access" başvurusu (proje numarası; doğrulanmış, 60+ gündür etkin, web siteli bir profilin sahibi/yöneticisi e-postasıyla), onay = kota 300 QPM (0 QPM onaysız); üç API'nin açılması; onay ekranında `business.manage` hassas kapsamının doğrulanması. Adımlar `docs/entegrasyonlar/google-business-profile.md` | Platform + Google | adr/0058 |
| Sosyal giriş: mağaza başına Google OAuth istemcisi (onay ekranında mağaza adı) ve Apple Developer hesabı + Services ID (adr/0037) | Google, Apple | F10.2, F16 |
| İYS marka kodu ve Netgsm İYS API erişimi (izinlerin iletimi, adr/0038) | İYS, Netgsm | F10 |
| Akakçe ve Cimri satıcı hesapları; feed adresinin satıcı paneline girilmesi (biçimler önceki siteden alındı, adr/0038 M12 eki) | Karşılaştırma siteleri | F10.8 |
| Meta (piksel + Conversions API anahtarı) ve GA4 (ölçüm kimliği + API sırrı) hesapları | Meta, Google | F10.9 |
| IndexNow anahtarı (tenant başına) | — | F3.15 |
| LLM sağlayıcı seçimi ve fiyatlandırma (opsiyonel özellik). adr/0071: ilk servisler DeepSeek, MiniMax, Gemini, Photoroom; mağaza kendi anahtarını bağlar | Sağlayıcı | F10.13, ADR-0071 |
| Yapay zekâ servislerinde **yeniden satış izni** (platform kredisi, adr/0071 §7): platformun kendi hesabının anahtarıyla kiracılar adına çağrı yapıp bunu kredi olarak satması her servisin kullanım şartlarında ayrı ayrı okunur (yeniden satış, alt lisans, çok kiracılı kullanım, hız ve hacim sınırları, üretilen içeriğin ticari kullanımı ve işaretleme yükümlülüğü, verinin eğitimde kullanımı). İzin vermeyen ya da belirsiz kalan servis platform hesabının arkasına konmaz. Kredi satışı başlamadan kapanır | Sağlayıcılar + avukat | ADR-0071 kredi aşaması, F16 |
| Yapay zekâ servis kayıtlarının resmi belgeden doğrulanması (uçlar, yetenekler, veri işleme yeri): adr/0071 yazılırken belgelere erişilemedi; her servis ilgili aşamanın ilk işi olarak doğrulanır (`docs/22-yapay-zeka-uygulama-plani.md` "Doğrulanacak servis bilgileri") | Geliştirici | ADR-0071 0b, 4, 7, 8 |

## Operasyon ve destek
| Kalem | Not | Etkilediği faz |
|---|---|---|
| Tenant yardım merkezi ve kurulum rehberi | Ekran görüntülü, sektörsüz | F17 |
| Destek kanalı ve SLA'lı yanıt süreleri | E-posta/WhatsApp/ticket | F16.10 |
| Olay yönetimi: nöbet listesi, olay sonrası rapor şablonu | | F16.9 |
| Geçiş (migration) hizmeti fiyatlandırması ve süreci | | F14 |
| Paketler ve fiyatlandırma (plan/limit tasarımı) | | F17.2 |
| ETBİS kaydı rehberi (tenant yükümlülüğü) | Tenant'a hatırlatma | F13.9 |
| Olay müdahale (güvenlik ihlali) masa başı tatbikatı, yılda 1 | | F13.10, F15 |
| Rakip analizi güncellemesi (6 ayda bir) | | docs/15 |
| Tenant SEO başlangıç rehberi: GSC/Merchant bağlama, künye, politikalar, ilk 10 ürün için advisor turu | Ekran görüntülü | F12.10, F17 |

## Görsel kaynakları ve atıf

Depoya yalnız sahibin sağladığı ya da lisansı kayıtlı görsel girer. Hazır görünümlerin kendi görselleri `preset.json` `credits`'inde kayıtlıdır (dosya, kaynak, lisans). Bu bölüm o alana yazılamayan görselleri kaydeder.

**Hazır görünüm küçük resimleri** (`packages/sector-packs/packs/*/presets/*/preview.webp`, 800×500 WebP; adr/0063 §7, adr/0064 Ek 2026-11-17 "Küçük resimler"). Panelin Görünümler galerisinde görünürler. Yerel geliştirme mağazasının taslak önizlemesinin ekran görüntüsüdürler: `NODE_ENV=development pnpm preset:previews -- --yes`. İçlerinde iki kaynaktan gelen fotoğraflar küçültülmüş olarak görünür:

- demo kataloğun Wikimedia Commons fotoğrafları (depo dışındaki veri dosyası, `apps/backend/src/scripts/load-demo-catalog.ts`; kaynak listesi veri dosyasının yanında);
- Tezgâh görünümlerinin kendi görselleri (`preset.json` `credits`).

Demo fotoğraflarının küçük resimde kullanımı sahip kararıdır (2026-11-17). `credits.file` yalnız `images/` altını kabul ettiği için atıf `preset.json`'a değil buraya yazılır. Lisanslar CC BY 2.0, CC BY 4.0, CC BY-SA 3.0, CC BY-SA 4.0 ve kamu malıdır. CC BY-SA içerik bulunduğu için **küçük resimler de CC BY-SA 4.0 ile paylaşılır**: kaynak ve yazar aşağıdadır, fotoğraflar küçültülüp ekran görüntüsünün parçası olarak değiştirilmiştir.

Küçük resimler yeniden üretildiğinde `--pictures <dosya>` her küçük resimde görünen fotoğrafların dosya adlarını yazar; bu tablo onunla güncellenir. Grafit hazır görünümü kaldırıldı (sahip, 2026-11-17); küçük resmi silindi, tablodan çıkarıldı.

| Eser (Wikimedia Commons) | Yazar | Lisans | Göründüğü küçük resim |
|---|---|---|---|
| <https://commons.wikimedia.org/wiki/File:A_classic_bowie_knife_-_7thdragon_knifeworks.jpg> | Bowiemaker | CC BY-SA 4.0 | katalog, tezgah (üç renk) |
| <https://commons.wikimedia.org/wiki/File:Axe_in_a_Nomad_Camp.jpg> | Heribertus2 | CC BY-SA 4.0 | katalog |
| <https://commons.wikimedia.org/wiki/File:Chefs_knifes_on_a_wooden_cutting_board.jpg> | T. Bjornstad | CC BY-SA 4.0 | katalog, tezgah (üç renk) |
| <https://commons.wikimedia.org/wiki/File:Chopping_Board.jpg> | Donovan Govan | CC BY-SA 3.0 | katalog |
| <https://commons.wikimedia.org/wiki/File:Foster_Cleaver.jpg> | GCNorton | CC BY-SA 4.0 | katalog, tezgah (üç renk) |
| <https://commons.wikimedia.org/wiki/File:Hitohira_Kikuchiyo_Ren_Silver_No._3_Gyuto_210mm_Ebony_Handle_(2026)-104A9181.jpg> | Frank Schulenburg | CC BY-SA 4.0 | tezgah (üç renk) |
| <https://commons.wikimedia.org/wiki/File:Hone_Stone.JPG> | Rosser1954 (Roger Griffith) | Kamu malı | katalog |
| <https://commons.wikimedia.org/wiki/File:Hunting_and_outdoor_knife_Boker_Integral_Hunter_Thuya.jpg> | Frank Schulenburg | CC BY-SA 4.0 | tezgah (üç renk) |
| <https://commons.wikimedia.org/wiki/File:Katana,_sword_(AM_1934.316-2).jpg> | Sada, Kane | CC BY 4.0 | katalog, tezgah (üç renk) |
| <https://commons.wikimedia.org/wiki/File:Leather_knife_case_and_a_set_of_knives_by_Les_Cuirs_d%27Agathe_and_La_Forge_du_Lion_du_Nord_(DSC07517).jpg> | Trougnouf (Benoit Brummer); Les cuirs d'Agathe | CC BY 4.0 | katalog |
| <https://commons.wikimedia.org/wiki/File:Making_a_hatchet_sheath_11.jpg> | Jomegat | CC BY-SA 3.0 | katalog |
| <https://commons.wikimedia.org/wiki/File:Making_a_knife_sheath_06.jpg> | Jomegat | CC BY-SA 3.0 | katalog |
| <https://commons.wikimedia.org/wiki/File:Mora_knife_01.jpg> | Wabajack | Kamu malı | katalog, tezgah (üç renk) |
| <https://commons.wikimedia.org/wiki/File:Pocket_knive_(penknife)_from_German_bicycle_retailer_Polo.jpg> | Pittigrilli | CC BY 4.0 | katalog, tezgah (üç renk) |
| <https://commons.wikimedia.org/wiki/File:Victorinox_Swiss_Army_Knife_Rescue_Tool_-_black_nylon_pouch_(15367901549).jpg> | Andrew Toskin | CC BY 2.0 | katalog |
| <https://commons.wikimedia.org/wiki/File:Whetstone_and_knife_Sharpening_tools.jpeg> | Didriks (Cambridge, MA, USA) | CC BY 2.0 | katalog, tezgah (üç renk) |

## Takip
Tamamlanan kalemler bu tabloda işaretlenmez; `PROGRESS.md` → "Açık sorular / bloklayıcılar" altında izlenir.

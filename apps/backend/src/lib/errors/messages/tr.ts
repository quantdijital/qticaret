/**
 * Turkish texts of the API's error keys (docs/10). The admin shows them on
 * its own screens, and the error handler answers the dashboard with them
 * (adr/0021). Imported by the admin bundle too: no server code here.
 */
export const SERVER_ERROR_MESSAGES_TR: Readonly<Record<string, string>> = {
  "async_job.already_running": "Bu işten biri zaten sırada ya da çalışıyor.",
  "async_job.input_invalid": "İş için verilen seçenekler geçerli değil.",
  "async_job.not_queued": "İş zaten başlamış.",
  "async_job.result_unavailable": "Bu işin indirilebilir bir sonucu yok ya da süresi doldu.",
  "async_job.type_unknown": "Böyle bir iş tipi yok.",
  "audit_log.kind_invalid": "Kayıt türü geçerli değil.",
  "billing_profile.tax_id_invalid": "Vergi ya da TC kimlik numarası geçerli değil.",
  "billing_profile.tax_office_required": "Vergi dairesini girin.",
  "bank_transfer.not_configured":
    "Mağaza havale/EFT ile ödemeyi açmadı ya da hesap bilgilerini girmedi.",
  "bank_transfer.iban_invalid":
    "IBAN geçerli değil. TR ile başlayan 26 karakterlik IBAN'ı kontrol edin.",
  "bank_transfer.incomplete": "Havale/EFT'yi açmak için hesap sahibi, banka adı ve IBAN gerekli.",
  "payments.return_urls_required": "Kartla ödeme için dönüş adresleri gerekli.",
  "bank_transfer.not_this_order": "Bu siparişin ödemesi havale/EFT ile değil.",
  "bank_transfer.order_canceled": "İptal edilmiş siparişin havalesi onaylanamaz.",
  "orders.payment_awaited":
    "Siparişin ödemesi henüz gelmedi; havale onaylanınca kargoya verilebilir.",
  "cash_on_delivery.disabled": "Mağaza kapıda ödemeyi sunmuyor.",
  "cash_on_delivery.over_limit": "Bu tutardaki sipariş kapıda ödenemiyor.",
  "cash_on_delivery.shipping_unsupported":
    "Seçilen kargo kapıda tahsilat yapmıyor; kapıda ödeme için başka bir kargo seçin.",
  "cash_on_delivery.fee_line_locked":
    "Kapıda ödeme ücreti sepetten değiştirilemez; başka bir ödeme yöntemi seçin.",
  "cash_on_delivery.fee_mismatch": "Kapıda ödeme ücreti değişti; ödemeyi yeniden başlatın.",
  "cash_on_delivery.fee_invalid": "Oran en çok %100 olabilir.",
  "brands.description_invalid": "Açıklama çok uzun ya da kullanılamayan karakterler içeriyor.",
  "brands.logo_unknown": "Logo mağazanın yüklenen görsellerinden biri olmalı.",
  "brands.name_invalid": "Marka adını girin (en fazla 120 karakter).",
  "brands.name_taken": "Bu adla bir marka zaten var.",
  "brands.unknown": "Marka bulunamadı.",
  "bulk_edit.alt_not_filled": "Bazı görsellerin alt metni yazılamadı; ürün sayfasından ekleyin.",
  "bulk_edit.category_unknown": "Seçilen kategori bulunamadı.",
  "bulk_edit.no_location": "Stok için varsayılan bir depo seçilmemiş.",
  "bulk_edit.no_price": "Varyantlarının TL fiyatı yok; önce fiyat girin.",
  "bulk_edit.price_out_of_range": "Yeni fiyat sıfırın altına iner ya da üst sınırı aşar.",
  "bulk_edit.product_missing": "Ürün bulunamadı; silinmiş olabilir.",
  "bulk_edit.stock_negative": "Yeni stok sıfırın altına iner.",
  "bulk_edit.stock_out_of_range": "Yeni stok üst sınırı aşar.",
  "bulk_edit.stock_untracked": "Bu ürünün stoğu takip edilmiyor.",
  "cart.address_required": "Siparişi tamamlamak için teslimat adresi gerekir.",
  "cart.shipping_changed":
    "Kargo ücreti sepetinize göre değişti; kargo seçiminizi yenileyip tekrar deneyin.",
  "cart.shipping_not_needed": "Sepette kargo gerektiren ürün yok; kargo seçimini kaldırın.",
  "catalog_import.attribute_invalid":
    "Özellik değeri bu özellik için geçerli değil (seçeneklerden biri, sayı ya da Evet/Hayır olmalı).",
  "catalog_import.attribute_required": "Şablonun zorunlu özelliklerinden biri boş.",
  "catalog_import.attribute_unknown": "Bu özellik ürünün şablonunda yok.",
  "catalog_import.brand_unknown": "Bu tanıtıcıyla bir marka yok.",
  "catalog_import.category_unknown": "Kategorilerden biri bu tanıtıcıyla yok.",
  "catalog_import.collection_unknown": "Bu tanıtıcıyla bir koleksiyon yok.",
  "catalog_import.column_repeated": "Bu sütun dosyada iki kez var; ikincisi okunmadı.",
  "catalog_import.columns_missing":
    'Dosyada "Tanıtıcı" ya da "Ürün adı" sütunu yok; şablonu kullanın.',
  "catalog_import.dimension_invalid":
    "Ölçü sıfır ya da pozitif bir sayı olmalı (en fazla 3 ondalık).",
  "catalog_import.handle_exists":
    'Başlıktan üretilen tanıtıcıyla bir ürün zaten var; o ürünü güncellemek için "Tanıtıcı" sütununu doldurun.',
  "catalog_import.handle_invalid":
    "Tanıtıcı yalnızca küçük harf, rakam ve tire içerebilir (ör. seramik-kupa).",
  "catalog_import.handle_or_title_required": "Satırda tanıtıcı da ürün adı da yok.",
  "catalog_import.handle_repeated":
    "Tanıtıcısız iki satır aynı ürün adını taşıyor; ayırmak için tanıtıcı girin.",
  "catalog_import.no_location":
    "Mağazanın varsayılan deposu yok; stok yazılamaz. Ayarlar > Depolar'dan bir depo ekleyin.",
  "catalog_import.option_incomplete": "Seçeneğin adı ve değeri birlikte girilmeli.",
  "catalog_import.option_unknown": "Ürünün bu adla bir seçeneği yok.",
  "catalog_import.option_value_unknown": "Yeni seçenek değeri; önce panelden ürüne ekleyin.",
  "catalog_import.options_differ": "Bir ürünün satırları aynı seçenek adlarını taşımalı.",
  "catalog_import.price_invalid":
    "Fiyat sıfır ya da pozitif bir tutar olmalı (en fazla 2 ondalık, ör. 1.250,50).",
  "catalog_import.product_field_conflict":
    "Aynı ürünün başka bir satırı bu alana farklı bir değer veriyor.",
  "catalog_import.sku_repeated": "Bu SKU dosyada daha önce kullanıldı.",
  "catalog_import.sku_taken": "Bu SKU başka bir ürünün varyantında kullanılıyor.",
  "catalog_import.status_invalid": 'Durum "Taslak" ya da "Yayında" olmalı.',
  "catalog_import.stock_invalid": "Stok sıfır ya da pozitif bir tam sayı olmalı.",
  "catalog_import.template_change": "Ürünün özellik şablonu farklı; şablonu panelden değiştirin.",
  "catalog_import.template_required": "Özellik girmek için bir özellik şablonu seçin.",
  "catalog_import.template_unknown": "Bu tanıtıcıyla bir özellik şablonu yok.",
  "catalog_import.text_invalid": "Metin görünmeyen kontrol karakterleri içeremez.",
  "catalog_import.text_too_long": "Metin bu alan için çok uzun.",
  "catalog_import.title_required": "Yeni ürün için ürün adı gerekli.",
  "catalog_import.variant_repeated": "Aynı seçenek değerleriyle iki satır var.",
  "catalog_import.variant_unmatched":
    "Satır ürünün bir varyantıyla eşleşmedi; SKU ya da ürünün tüm seçeneklerini girin.",
  "catalog_import.write_failed": "Ürün kaydedilemedi.",
  "catalog.dimensions_required":
    "Fiziksel bir ürünü yayınlamak için her varyantın ağırlığı ve ölçüleri girilmeli.",
  "catalog.handle_invalid":
    "Adres (handle) yalnızca küçük harf, rakam ve tire içerebilir; Türkçe karakter kullanmayın.",
  "catalog.handle_required": "Başlıktan bir adres üretilemedi; adresi (handle) kendiniz girin.",
  "catalog.kind_disabled":
    "Dijital ve hizmet ürünleri için önce Ayarlar > Özellikler'den bu özelliği açın.",
  "catalog.mpn_invalid": "MPN geçersiz karakter içeriyor.",
  "catalog.primary_category_not_assigned":
    "Birincil kategori, ürünün eklendiği kategorilerden biri olmalı.",
  "catalog.product_unknown": "Ürün bulunamadı.",
  "catalog.successor_loop": "Bu seçim bir yönlendirme döngüsü oluşturur.",
  "catalog.successor_self": "Ürün kendi yerine geçemez.",
  "catalog.successor_unknown": "Seçilen ürün bulunamadı.",
  "catalog.variant_unknown": "Varyant bu ürüne ait değil.",
  "catalog.variants_too_many": "Tek seferde en çok 500 varyant kaydedilebilir.",
  "content.author_invalid":
    "Yazar adı en fazla 120 karakter olmalı ve kullanılamayan karakter içermemeli.",
  "content.body_invalid":
    "İçerikte izin verilmeyen bir öğe ya da biçim var; sayfayı yenileyip yeniden deneyin.",
  "content.card_unknown":
    "İçerikteki ürün ya da kategori kartlarından biri artık yok; kartı kaldırın.",
  "content.excerpt_invalid":
    "Özet en fazla 500 karakter olmalı ve kullanılamayan karakter içermemeli.",
  "content.image_alt_invalid": "Kapak görselinin alt metni en fazla 300 karakter olmalı.",
  "content.image_unknown":
    "Görseller mağazanın medya kütüphanesinden olmalı; görseli yükleyerek ekleyin.",
  "content.landing_category_unknown": "Kategori bulunamadı.",
  "content.landing_category_unlisted":
    "Kategorinin henüz bir adresi yok; önce kategoriyi kaydedin.",
  "content.landing_exists": "Bu kategori ve filtre için zaten bir sayfa var.",
  "content.landing_facet_unknown":
    "Filtre bulunamadı: marka ya da filtrelenebilir bir seçenekli özellik seçin.",
  "content.landing_not_original":
    "Metin yeterince özgün değil (%30'un altında); başka filtre sayfalarına çok benziyor. Yayına almadan önce metni bu sayfaya özgü hâle getirin.",
  "content.landing_unknown": "Filtre sayfası bulunamadı.",
  "content.title_invalid":
    "Başlık gerekli; en fazla 200 karakter olmalı ve kullanılamayan karakter içermemeli.",
  "content.too_large":
    "İçerik çok uzun ya da iç içe; bir sayfa en fazla 200.000 karakter ve birkaç seviye iç içe liste olabilir.",
  "content.unknown": "İçerik bulunamadı.",
  "errors.busy": "Kayıt şu an başka bir işlemle güncelleniyor; birkaç saniye sonra tekrar deneyin.",
  "errors.conflict": "Kayıt bu arada değişti; sayfayı yenileyip tekrar deneyin.",
  "errors.csrf_rejected": "İstek güvenlik kontrolünden geçemedi; sayfayı yenileyip tekrar deneyin.",
  "errors.duplicate": "Bu değer başka bir kayıtta kullanılıyor.",
  "errors.invalid_data": "Girilen bilgiler geçerli değil; alanları kontrol edin.",
  "errors.invalid_limit": "Sayfa boyutu düz bir sayı olmalı.",
  "errors.invalid_reference": "Seçilen kayıt bulunamadı.",
  "errors.invalid_request": "İstek anlaşılamadı.",
  "errors.length_required": "İsteğin boyutu belirtilmeli.",
  "errors.limit_too_large": "Tek seferde bu kadar çok kayıt istenemez.",
  "errors.provider_unavailable": "Bağlı hizmete şu an ulaşılamıyor; biraz sonra tekrar deneyin.",
  "errors.request_too_large": "Gönderilen dosya ya da veri çok büyük.",
  "errors.temporarily_unavailable":
    "Hizmet geçici olarak kullanılamıyor; biraz sonra tekrar deneyin.",
  "errors.too_many_requests": "Çok fazla deneme yapıldı. Biraz bekleyip tekrar deneyin.",
  "errors.users_only": "Bu işlemi yalnızca oturum açmış yöneticiler yapabilir.",
  "features.disabled": "Bu özellik kapalı.",
  "features.platform_owned": "Bu özellik platform tarafından yönetilir.",
  "features.unknown": "Böyle bir özellik yok.",
  "gift_cards.code_prefix":
    "Kart kodunun öneki en çok 20 harf, rakam ya da tire olabilir; kodun geri kalanı rastgele üretilir.",
  "gift_cards.guest_account":
    "Mağaza kredisi yalnızca üye müşterilere verilebilir; misafir müşteri krediyi kullanamaz.",
  "integration_credentials.check_failed":
    "Sağlayıcı beklenmedik bir yanıt verdi; bilgiler kaydedilmedi. Biraz sonra tekrar deneyin.",
  "integration_credentials.invalid": "Girilen değer geçerli değil.",
  "integration_credentials.key_missing":
    "Sunucuda ödeme bilgilerini saklamak için gereken şifreleme anahtarı tanımlı değil; platform ekibine bildirin.",
  "integration_credentials.provider_unreachable":
    "Sağlayıcıya şu an ulaşılamıyor. Çalışan bağlantınız korunuyor; yeni bilgileri biraz sonra kaydedin.",
  "integration_credentials.secret_invalid":
    "Değer 8–128 karakter olmalı ve boşluk içermemeli; sağlayıcının panelinden kopyalayıp yapıştırın.",
  "integration_credentials.secrets_required":
    "Gizli alanların hepsini girin; hesap numarası değişince ya da kayıtlı bilgiler okunamayınca hepsi yeniden istenir.",
  "integration_credentials.unknown_provider": "Böyle bir ödeme ya da entegrasyon sağlayıcısı yok.",
  "iyzico.not_configured": "Mağaza iyzico hesabını henüz bağlamadı.",
  "iyzico.basket_total_mismatch":
    "Sepet tutarı iyzico'ya tutarlı gönderilemedi; ödemeyi yeniden başlatın.",
  "iyzico.signature_mismatch": "iyzico'nun yanıtı doğrulanamadı; ödeme kabul edilmedi.",
  "iyzico.test_mode_mismatch":
    "Bu ödeme iyzico'nun diğer ortamında (sandbox/canlı) alındı; bağlı hesapla iade edilemez.",
  "iyzico.refund_outcome_unknown":
    "iyzico'dan bir iadenin sonucu alınamadı; bu ödemede yeni iade yapılamaz. iyzico panelinde ödemenin iadelerini kontrol edip platform ekibine bildirin.",
  "iyzico.refund_exceeds_line": "iyzico bu tutarı kabul etmedi: ödemenin kalan tutarını aşıyor.",
  "iyzico.refund_not_supported":
    "Bu kartın bankası iade kabul etmiyor; müşteriye başka yolla ödeme yapın.",
  "iyzico.refund_same_day":
    "iyzico ödemenin alındığı gün kısmi iade yapmıyor; yarın tekrar deneyin ya da tamamını iade edin.",
  "iyzico.merchant_invalid":
    "iyzico bu API anahtarını tanımadı. Anahtarın seçili ortama ait olduğundan emin olun: sandbox anahtarı yalnızca sandbox açıkken, canlı anahtar yalnızca kapalıyken çalışır.",
  "iyzico.secret_invalid":
    "iyzico gizli anahtarı kabul etmedi. Gizli anahtarı API anahtarıyla aynı sayfadan yeniden kopyalayın.",
  "media.alt_invalid": "Alt metinde kullanılamayan karakterler var.",
  "media.file_id_invalid": "Dosya adı geçerli değil.",
  "media.file_unknown": "Dosya bulunamadı.",
  "media.not_an_image": "Bu dosya bir görsel değil.",
  "media.unknown": "Görsel bulunamadı.",
  "orders.nothing_to_ship": "Bu siparişte kargoya verilecek ürün kalmadı.",
  "orders.unknown": "Sipariş bulunamadı.",
  "paytr.merchant_id_invalid":
    "Mağaza no yalnızca rakamlardan oluşur; PayTR panelinde Destek & Kurulum > Entegrasyon Bilgileri sayfasından kopyalayın.",
  "paytr.merchant_invalid":
    "PayTR bu mağaza numarasını tanımadı ya da mağaza aktif değil. Numarayı Entegrasyon Bilgileri sayfasından kontrol edin.",
  "paytr.secret_invalid":
    "PayTR mağaza parolasını ya da gizli anahtarı kabul etmedi. İkisini de Entegrasyon Bilgileri sayfasından yeniden kopyalayın.",
  "products.unknown": "Ürün bulunamadı.",
  "price_lists.unknown": "Fiyat listesi bulunamadı.",
  "price_lists.no_currency": "Mağazanın para birimi tanımlı değil.",
  "price_lists.rate": "Oran yüzde 0 ile 100 arasında olmalı.",
  "platform_settings.color_invalid": "Renk #rrggbb biçiminde olmalı, ör. #2f6feb.",
  "platform_settings.email_invalid": "Geçerli bir e-posta adresi girin.",
  "platform_settings.feature_unknown": "Böyle bir özellik yok.",
  "platform_settings.host_invalid": "Alan adını https:// ve yol olmadan yazın, ör. magaza.com.tr.",
  "platform_settings.invalid": "Girilen değer geçerli değil.",
  "platform_settings.phone_invalid": "Geçerli bir Türkiye telefon numarası girin.",
  "platform_settings.robots_invalid":
    "robots.txt yalnızca User-agent, Allow, Disallow, Sitemap, Crawl-delay satırları ve yorum içerebilir.",
  "platform_settings.section_invalid": "Ayar bölümündeki değerler geçerli değil.",
  "platform_settings.text_invalid": "Metin, görünmeyen kontrol karakterleri içeremez.",
  "platform_settings.timezone_invalid": "Geçerli bir saat dilimi seçin.",
  "platform_settings.unknown_section": "Böyle bir ayar bölümü yok.",
  "platform_settings.url_invalid": "Adres https:// ile ya da / ile başlamalı.",
  "product_attributes.definition_locked":
    "Ürünlerde değeri olan bir özelliğin anahtarı ve birimi değiştirilemez.",
  "product_attributes.definition_unknown": "Özellik bu şablona ait değil.",
  "product_attributes.handle_invalid": "Tanıtıcı yalnızca küçük harf, rakam ve tire içerebilir.",
  "product_attributes.handle_taken": "Bu tanıtıcı başka bir şablonda kullanılıyor.",
  "product_attributes.key_invalid":
    "Anahtar küçük harfle başlamalı; yalnızca küçük harf, rakam ve alt çizgi içerebilir.",
  "product_attributes.key_reserved":
    "Filtrelenebilir özelliğin anahtarı adreslerde başka bir parametrenin adı (marka, fiyat, sirala, sayfa, variant, q, utm_…); başka bir anahtar seçin.",
  "product_attributes.key_taken": "Bu şablonda aynı anahtar iki kez kullanılamaz.",
  "product_attributes.option_in_use": "Ürünlerde kullanılan bir seçenek kaldırılamaz.",
  "product_attributes.option_title_required": "Varyant özelliği için ürün seçeneğinin adını girin.",
  "product_attributes.option_unknown": "Seçilen değer bu özelliğin seçenekleri arasında yok.",
  "product_attributes.option_value_invalid":
    "Seçenek değeri yalnızca küçük harf, rakam, tire ve alt çizgi içerebilir (ör. paslanmaz_celik).",
  "product_attributes.options_duplicate": "Seçenek değerleri tekrarlanamaz.",
  "product_attributes.options_not_allowed": "Bu özellik tipi seçenek almaz.",
  "product_attributes.options_required": "Seçimli özellik için en az bir seçenek ekleyin.",
  "product_attributes.product_unknown": "Ürün bulunamadı.",
  "product_attributes.template_change_unconfirmed":
    "Şablon değişikliği ürünün mevcut değerlerini siler; onaylayarak tekrar deneyin.",
  "product_attributes.template_in_use":
    "Bu şablonu kullanan ürünler var; önce ürünlerden kaldırın.",
  "product_attributes.text_invalid": "Metin, görünmeyen kontrol karakterleri içeremez.",
  "product_attributes.type_locked":
    "Ürünlerde değeri olan bir özelliğin tipi ya da kapsamı değiştirilemez.",
  "product_attributes.value_invalid": "Girilen değer bu özellik için geçerli değil.",
  "product_attributes.values_exist": "Kaldırılan özelliklerin ürünlerde değerleri var.",
  "product_attributes.variant_only":
    "variesBy ve seçenek adı yalnızca varyant özelliklerinde kullanılır.",
  "promotions.code_invalid":
    "Kod 3 ile 40 karakter arasında olmalı; harf, rakam, tire ve alt çizgi kullanılabilir.",
  "promotions.too_many_codes": "Bir istekte en çok 5 kod gönderilebilir.",
  "promotions.unknown": "Kampanya bulunamadı.",
  "promotions.codes_template":
    "Tek kullanımlık kodlar yalnızca kodlu, standart bir kampanyadan üretilebilir.",
  "promotions.one_code":
    "Sepette tek bir indirim kodu kullanılabilir; önce eklediğiniz kodu çıkarın.",
  "seo.canonical_invalid": "Canonical adres bu sitede bir yol olmalı, örn. /urun/keten-gomlek.",
  "seo.entity_id_invalid": "Kayıt kimliği geçerli değil.",
  "seo.entity_type_invalid": "Kayıt türü geçerli değil.",
  "seo.entity_type_unknown": "Bu sayfa türü için SEO alanları yok.",
  "seo.entity_unknown": "Sayfa bulunamadı.",
  "seo.fix_not_applicable": "Bu düzeltme bu sayfaya uygulanamıyor.",
  "seo.locale_invalid": "Dil kodu geçerli değil.",
  "seo.not_found_unknown": "Bu kayıt 404 günlüğünde yok.",
  "seo.og_image_unknown": "Paylaşım görseli mağazanın yüklenen dosyalarından biri olmalı.",
  "seo.path_active":
    "Bu adres bir kayıt tarafından kullanılıyor; yalnızca eski adresler serbest bırakılabilir.",
  "seo.path_invalid": "Adres yalnızca küçük harf, rakam ve tireden oluşan bölümler içerebilir.",
  "seo.path_not_owned": "Bu adres başka bir kayda ait.",
  "seo.path_reserved": "Bu adres mağazanın kendi sayfalarına ayrılmış.",
  "seo.path_taken": "Bu adres başka bir kayıt tarafından kullanılıyor.",
  "seo.path_unknown": "Bu adres kayıtlı değil.",
  "seo.publish_gate_blocked":
    "Ürün SEO açısından yayına hazır değil: kritik bir eksik var ya da puanı 50'nin altında. SEO danışmanındaki önerileri tamamlayın.",
  "seo.redirect_csv_header": 'Dosyanın ilk satırında en az "source" sütunu olmalı.',
  "seo.redirect_duplicate_row": "Aynı kaynak dosyada birden fazla kez geçiyor.",
  "seo.redirect_exists": "Bu kaynak için zaten bir yönlendirme var; onu düzenleyin.",
  "seo.redirect_loop": "Bu yönlendirme bir döngü oluşturur: hedef sonunda yine bu adrese döner.",
  "seo.redirect_match_invalid": "Eşleşme türü exact, prefix ya da pattern olmalı.",
  "seo.redirect_pattern_invalid":
    "Desen geçersiz: :ad yer tutucuları ve sonda * kullanın, en az bir sabit bölüm olsun.",
  "seo.redirect_pattern_limit":
    "Desen kuralı sınırına ulaşıldı; bazılarını tam eşleşen kurallara çevirin.",
  "seo.redirect_query_invalid": "Korunacak parametre adları geçerli değil.",
  "seo.redirect_self": "Hedef, kuralın kendi kaynağına düşüyor.",
  "seo.redirect_source_invalid": "Kaynak adres geçerli değil.",
  "seo.redirect_source_live":
    "Bu adres yayındaki bir sayfaya ait; önce o sayfanın adresini değiştirin.",
  "seo.redirect_source_query":
    "Kaynak adres soru işaretli parametre içeremez; yalnızca yolu girin.",
  "seo.redirect_source_reserved": "Bu adres mağazanın kendi sayfalarına ya da sisteme ayrılmış.",
  "seo.redirect_source_root": "Ana sayfa yönlendirilemez.",
  "seo.redirect_source_wildcard":
    'Kaynakta * ya da :ad var; desen kuralı için eşleşme türünü "desen" seçin.',
  "seo.redirect_status_invalid": "Durum kodu 301, 302, 307 ya da 410 olmalı.",
  "seo.redirect_target_gone": "Hedef sayfa kaldırılmış (410); başka bir hedef seçin.",
  "seo.redirect_target_invalid": "Hedef bu sitede bir yol olmalı, örn. /urun/keten-gomlek.",
  "seo.redirect_target_placeholder": "Hedefteki yer tutucular kaynakta da olmalı.",
  "seo.redirect_target_required": "Hedef adresi girin.",
  "seo.redirect_unknown": "Yönlendirme bulunamadı.",
  "seo.sitemap_unknown": "Site haritası dosyası bulunamadı.",
  "seo.template_invalid":
    "Şablonda bu alan için tanımlı olmayan bir etiket ya da hatalı süslü parantez var.",
  "seo.text_invalid": "Metinde kullanılamayan karakterler var.",
  "seo.text_too_long": "Metin çok uzun.",
  "seo.url_style_conflicts":
    "Adres biçimi değiştirilemedi: bazı sayfalar aynı adrese düşüyor ya da adres başka bir kayda ait. Kontrolü yeniden çalıştırın.",
  "seo.url_style_job_required":
    'Adres biçimi tüm sayfaların adresini değiştirir; SEO ayarlarındaki "Adres biçimini değiştir" adımıyla yapın.',
  "stock.item_unknown": "Stok kalemi bulunamadı.",
  "stock.location_has_returns":
    "Bu depoya gelmesi beklenen iadeler var; önce iadeleri teslim alın ya da iptal edin.",
  "stock.location_has_stock":
    "Bu depoda stok, rezervasyon ya da gelecek stok var; önce stoğu başka bir depoya taşıyın ya da sıfırlayın.",
  "stock.location_is_default": "Varsayılan depo silinemez; önce başka bir depoyu varsayılan yapın.",
  "stock.location_unknown": "Depo bulunamadı.",
  "stock.preorder_disabled": "Stoksuz satış için önce Ayarlar > Özellikler'den bu özelliği açın.",
  "stock.text_invalid": "Metinde kullanılamayan karakterler var.",
  "tr_address.district_id_invalid": "İlçe seçimi geçerli değil.",
  "tr_address.district_not_in_province": "Seçilen ilçe bu ile ait değil.",
  "tr_address.district_requires_province": "İlçe için önce il seçin.",
  "tr_address.invalid":
    "Adres Türkiye adres kayıtlarıyla uyuşmuyor; il, ilçe, mahalle ve posta kodunu kontrol edin.",
  "tr_address.neighborhood_not_in_district": "Mahalle bu ilçede bulunamadı.",
  "tr_address.neighborhood_requires_district": "Mahalle için önce ilçe seçin.",
  "tr_address.phone_invalid": "Telefon numarası geçerli değil.",
  "tr_address.postal_code_invalid": "Posta kodu geçerli değil.",
  "tr_address.postal_code_neighborhood_mismatch": "Posta kodu seçilen mahalleye ait değil.",
  "tr_address.postal_code_province_mismatch": "Posta kodu seçilen ile ait değil.",
  "tr_address.province_code_invalid": "İl seçimi geçerli değil.",
  "tr_address.province_not_found": "İl bulunamadı.",
  "upload.file_too_large": "Dosya çok büyük; en fazla 10 MB yükleyin.",
  "upload.sheet_empty": "Dosyada başlık satırı yok.",
  "upload.sheet_invalid": "Dosya okunamadı; Excel (xlsx) ya da CSV olarak kaydedin.",
  "upload.sheet_too_large": "Dosyanın içeriği çok büyük ya da bozuk.",
  "upload.sheet_too_many_rows": "Dosyada çok fazla satır var; en fazla 5000 satır yükleyin.",
  "upload.sheet_too_wide": "Dosyada çok fazla sütun var.",
  "upload.csv_empty": "Dosya boş.",
  "upload.csv_invalid": "Dosya okunamadı: kapanmamış bir tırnak var.",
  "upload.csv_too_many_rows": "Dosyada çok fazla satır var; en fazla 1000 satır yükleyin.",
  "upload.csv_too_wide": "Dosyada çok fazla sütun var.",
  "upload.dimensions_too_large":
    "Görselin piksel boyutu çok büyük; daha küçük bir görsel yükleyin.",
  "upload.too_large": "Dosya çok büyük.",
  "upload.too_many_files": "Tek seferde çok fazla dosya yüklendi.",
  "upload.unreadable_image": "Görsel okunamadı; dosya bozuk olabilir.",
  "upload.unsupported_type":
    "Bu dosya türü desteklenmiyor; JPEG, PNG, WebP ya da AVIF görsel yükleyin.",
  "cart.completed": "Bu sepetle sipariş zaten verildi.",
  "cart.email_required": "Siparişi tamamlamak için e-posta adresi gerekir.",
  "cart.empty": "Sepet boş.",
  "cart.phone_required": "Ödeme için teslimat adresinde telefon numarası gerekir.",
  "cart.shipping_method_required": "Bir kargo seçeneği seçin.",
  "cart.unknown": "Sepet bulunamadı.",
  "payments.cart_changed": "Sepet değişti; ödemeyi yeniden başlatın.",
  "payments.checkout_invalid": "Ödeme bilgileri eksik ya da geçersiz.",
  "payments.restart_checkout": "Tutar değişti; ödemeyi yeniden başlatın.",
  "payments.return_url_invalid": "Dönüş adresi bu mağazanın adreslerinden biri değil.",
  "payments.session_invalid": "Ödeme oturumu tanınmadı.",
  "payments.use_checkout_route": "Bu ödeme yöntemi mağazanın ödeme adımından başlatılır.",
  "paytr.not_configured": "Mağaza PayTR hesabını henüz bağlamadı.",
  "orders.test_payment_not_shippable":
    "Bu sipariş test modunda ödendi; gerçek para alınmadığı için kargoya verilemez.",
  "paytr.refund_locked":
    "PayTR şu an bu ödemenin iadesini kabul etmiyor (hesap kesimi sürüyor); biraz sonra tekrar deneyin.",
  "paytr.refund_exceeds_payment": "İade tutarı ödemeden kalanı aşıyor.",
  "paytr.payment_not_notified": "PayTR bu ödemenin bildirimini onaylanmış görmüyor; iade edilemez.",
  "paytr.refund_not_supported": "PayTR bu ödeme için iade kabul etmiyor.",
  "paytr.balance_insufficient": "PayTR bakiyeniz bu iade için yetersiz.",
  "paytr.payment_too_old": "Ödemenin iade süresi geçmiş.",
  "paytr.payment_not_found": "PayTR bu ödemeyi bulamadı.",
  "paytr.test_mode_mismatch":
    "Ödemenin test modu hesabınızınkiyle uyuşmuyor; test anahtarıyla gerçek ödeme iade edilmez.",
  "payments.refund_reference_missing": "İade referansı eksik; iadeyi yeniden başlatın.",
  "orders.refund_line_unknown": "Bu kalem siparişte yok.",
  "orders.refund_units_exceeded": "Bu kalemden iade edilebilecek adetten fazlası seçildi.",
  "orders.refund_exceeds_paid": "İade tutarı siparişten iade edilebilecek tutarı aşıyor.",
  "orders.refund_empty": "İade edilecek bir tutar yok.",
  "orders.refund_reference_taken":
    "Bu iade anahtarı başka bir siparişte kullanılmış; iadeyi yeniden başlatın.",
  "orders.refund_mode": "Ya kalem ve kargo seçin ya da bir tutar girin.",
  "orders.refund_amount_kurus": "Tutar en çok iki ondalık basamak içerebilir.",
  "orders.refund_reference_invalid": "İade anahtarı geçersiz; iadeyi yeniden başlatın.",
  "payments.use_order_refund": "Bu ödemenin iadesi siparişin iade adımından yapılır.",
  "payments.max_installment_invalid":
    "En çok taksit 2 ile 12 arasında olmalı (0: PayTR'nin izin verdiği en çok).",
  "payments.installments_unknown": "Taksit tablosu için ürün ya da sepet bulunamadı.",
  "payments.installments_target": "Taksit için ya sepet ya da ürün ve bölge verin.",
}

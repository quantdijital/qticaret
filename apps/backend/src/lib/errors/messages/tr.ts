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
  "catalog.dimensions_required":
    "Fiziksel bir ürünü yayınlamak için her varyantın ağırlığı ve ölçüleri girilmeli.",
  "catalog.handle_invalid":
    "Adres (handle) yalnızca küçük harf, rakam ve tire içerebilir; Türkçe karakter kullanmayın.",
  "catalog.handle_required": "Başlıktan bir adres üretilemedi; adresi (handle) kendiniz girin.",
  "catalog.mpn_invalid": "MPN geçersiz karakter içeriyor.",
  "catalog.primary_category_not_assigned":
    "Birincil kategori, ürünün eklendiği kategorilerden biri olmalı.",
  "catalog.product_unknown": "Ürün bulunamadı.",
  "catalog.successor_loop": "Bu seçim bir yönlendirme döngüsü oluşturur.",
  "catalog.successor_self": "Ürün kendi yerine geçemez.",
  "catalog.successor_unknown": "Seçilen ürün bulunamadı.",
  "catalog.variant_unknown": "Varyant bu ürüne ait değil.",
  "catalog.variants_too_many": "Tek seferde en çok 500 varyant kaydedilebilir.",
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
  "seo.entity_id_invalid": "Kayıt kimliği geçerli değil.",
  "seo.entity_type_invalid": "Kayıt türü geçerli değil.",
  "seo.locale_invalid": "Dil kodu geçerli değil.",
  "seo.path_invalid": "Adres yalnızca küçük harf, rakam ve tireden oluşan bölümler içerebilir.",
  "seo.path_not_owned": "Bu adres başka bir kayda ait.",
  "seo.path_reserved": "Bu adres mağazanın kendi sayfalarına ayrılmış.",
  "seo.path_taken": "Bu adres başka bir kayıt tarafından kullanılıyor.",
  "seo.template_invalid":
    "Şablonda bu alan için tanımlı olmayan bir etiket ya da hatalı süslü parantez var.",
  "tr_address.district_id_invalid": "İlçe seçimi geçerli değil.",
  "tr_address.district_not_in_province": "Seçilen ilçe bu ile ait değil.",
  "tr_address.province_code_invalid": "İl seçimi geçerli değil.",
  "upload.dimensions_too_large":
    "Görselin piksel boyutu çok büyük; daha küçük bir görsel yükleyin.",
  "upload.too_large": "Dosya çok büyük.",
  "upload.too_many_files": "Tek seferde çok fazla dosya yüklendi.",
  "upload.unsupported_type":
    "Bu dosya türü desteklenmiyor; JPEG, PNG, WebP ya da AVIF görsel yükleyin.",
}

/**
 * Turkish texts of the API's error keys (docs/10). The admin shows them on
 * its own screens, and the error handler answers the dashboard with them
 * (adr/0021). Imported by the admin bundle too: no server code here.
 */
export const SERVER_ERROR_MESSAGES_TR: Readonly<Record<string, string>> = {
  "async_job.already_running": "Bu işten biri zaten sırada ya da çalışıyor.",
  "async_job.input_invalid": "İş için verilen seçenekler geçerli değil.",
  "async_job.cancelled": "İş iptal edildi.",
  "async_job.not_open": "İş zaten bitmiş; iptal edilemez.",
  "async_job.not_queued": "İş zaten başlamış.",
  "async_job.not_yours": "Bu işi yalnızca başlatan kişi ya da mağaza sahibi iptal edebilir.",
  "async_job.result_unavailable": "Bu işin indirilebilir bir sonucu yok ya da süresi doldu.",
  "async_job.unknown": "İş bulunamadı.",
  "async_job.type_unknown": "Böyle bir iş tipi yok.",
  "audit_log.kind_invalid": "Kayıt türü geçerli değil.",
  "billing_profile.unknown": "Bu müşterinin fatura bilgisi yok.",
  "billing_profile.tax_id_invalid": "Vergi ya da TC kimlik numarası geçerli değil.",
  "billing_profile.tax_office_required": "Vergi dairesini girin.",
  "bank_transfer.not_configured":
    "Mağaza havale/EFT ile ödemeyi açmadı ya da hesap bilgilerini girmedi.",
  "bank_transfer.iban_invalid":
    "IBAN geçerli değil. TR ile başlayan 26 karakterlik IBAN'ı kontrol edin.",
  "bank_transfer.incomplete": "Havale/EFT'yi açmak için hesap sahibi, banka adı ve IBAN gerekli.",
  "payments.return_urls_required": "Kartla ödeme için dönüş adresleri gerekli.",
  "payments.return_urls_unexpected": "Bu ödeme yöntemi dönüş adresi almaz.",
  "cart.metadata_reserved": "Bu satır bilgisi yalnızca mağaza tarafından yazılır.",
  "bank_transfer.not_this_order": "Bu siparişin ödemesi havale/EFT ile değil.",
  "bank_transfer.order_canceled": "İptal edilmiş siparişin havalesi onaylanamaz.",
  "orders.cancel_after_packing":
    "Paketlenmiş ya da kargoya verilmiş sipariş iptal edilemez; ürün elinize ulaşınca iade talebi oluşturun.",
  "orders.cancel_contact_shop":
    "Havale/EFT ile ödenmiş sipariş buradan iptal edilemez; iptal ve ücret iadesi için mağazayla iletişime geçin.",
  "orders.gift_card_used":
    "Hediye kartı kullanıldığı için sipariş iptal edilemez; iade için mağazayla iletişime geçin.",
  "orders.ship_canceled_refund":
    "Bu siparişin iptali için ücret iadesi yapılmış; kargoya verilemez. Siparişi iptal edin.",
  "orders.edit_nothing": "Düzenlenecek bir şey seçilmedi.",
  "orders.edit_items_invalid":
    "Düzenlenen kalemler bu siparişe ait değil ya da birden fazla kez seçildi.",
  "orders.edit_after_packing":
    "Paketlenmiş, kargoya verilmiş ya da iptal edilmiş sipariş düzenlenemez.",
  "orders.edit_invoiced":
    "Bu siparişin faturası kesildi ya da kesiliyor; sipariş artık düzenlenemez.",
  "orders.edit_payment_unsupported":
    "Bu siparişin kalemleri düzenlenemez: yalnızca kartla ödenmiş siparişler düzenlenir. Kapıda ödeme ve havalede siparişi iptal edip yenisini oluşturun.",
  "orders.edit_difference_changed":
    "Düzenlemenin fiyat farkı değişti; önizlemeyi yenileyip tekrar deneyin.",
  "orders.edit_difference_due":
    "Müşteri fark ödeyecek; kaydetmeden önce farkı tahsil edip işaretleyin.",
  "orders.edit_price_kurus": "Fiyat en çok iki ondalık basamak olabilir.",
  "orders.use_order_edit":
    "Sipariş düzenleme yalnızca sipariş sayfasındaki düzenleme penceresinden yapılır.",
  "orders.ship_items_invalid":
    "Seçilen kalemler gönderilecek olanlarla uyuşmuyor: her kalemden en çok kalan adet kadar gönderilebilir.",
  "orders.tracking_invalid":
    "Takip bilgisi geçersiz: firma adı, 4–40 harf/rakamlık takip numarası ve https ile başlayan bağlantı olmalı.",
  "orders.nothing_to_deliver": "Teslim edilecek, mağazanın kendi teslimatında bir koli yok.",
  "orders.deliver_failed":
    "Sipariş teslim edildi olarak işaretlenemedi; sipariş sayfasından tekrar deneyin.",
  "orders.note_unknown": "Not bulunamadı; silinmiş olabilir.",
  "orders.note_not_yours": "Bu notu yalnızca yazan kişi ya da mağaza sahibi silebilir.",
  "orders.note_empty": "Not boş olamaz.",
  "orders.note_too_long": "Not en çok 2000 karakter olabilir.",
  "orders.ship_failed": "Sipariş kargoya verilemedi; sipariş sayfasından tekrar deneyin.",
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
  "chargebacks.order_unpaid":
    "Bu siparişin kartla tahsil edilmiş bir ödemesi yok; ters ibraz kaydı açılamaz.",
  "chargebacks.changed": "Kayıt bu sırada değişti; sayfayı yenileyip tekrar deneyin.",
  "chargebacks.amount_exceeds_paid": "İtiraz edilen tutar ödenen tutarı geçemez.",
  "chargebacks.amount_invalid": "Tutarı en çok iki ondalıkla girin.",
  "chargebacks.already_open": "Bu ödeme için açık bir ters ibraz kaydı zaten var.",
  "chargebacks.transition_invalid": "Kayıt bu duruma geçemez; kapanmış kayıt yeniden açılmaz.",
  "chargebacks.unknown": "Ters ibraz kaydı bulunamadı.",
  "brands.description_invalid": "Açıklama çok uzun ya da kullanılamayan karakterler içeriyor.",
  "brands.logo_unknown": "Logo mağazanın yüklenen görsellerinden biri olmalı.",
  "brands.name_invalid": "Marka adını girin (en fazla 120 karakter).",
  "brands.name_taken": "Bu adla bir marka zaten var.",
  "brands.unknown": "Marka bulunamadı.",
  "bulk_edit.alt_not_filled": "Bazı görsellerin alt metni yazılamadı; ürün sayfasından ekleyin.",
  "bulk_edit.category_unknown": "Seçilen kategori bulunamadı.",
  "bulk_edit.cost_out_of_range": "Yeni maliyet üst sınırı aşar.",
  "bulk_edit.no_cost": "Varyantlarının maliyeti yok; yüzdeyle değiştirmeden önce maliyet girin.",
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
  "catalog_import.vat_unknown":
    "Bu adla ya da oranla bir KDV oranı yok; KDV oranları ekranındaki adı (ör. KDV %10) ya da oranı (ör. 10) yazın.",
  "catalog_import.vat_ambiguous":
    "Bu oranda birden çok KDV oranı var; oranın adını KDV oranları ekranındaki gibi yazın.",
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
  "catalog_import.no_measures": "Ölçü yok; kargo varsayılan paketle hesaplanır.",
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
  "content.token_unknown":
    "Metinde tanınmayan bilgi var: {{tokens}}. Kullanılabilenler: {mağaza_adı}, {telefon}, {e_posta}, {adres}, {whatsapp}, {ücretsiz_kargo_eşiği}.",
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
  "content.landing_unknown": "Filtre sayfası bulunamadı.",
  "content.tags_too_many": "Bir yazıya en fazla 50 etiket eklenebilir.",
  "content.term_description_invalid":
    "Açıklama en fazla 1000 karakter olmalı ve kullanılamayan karakter içermemeli.",
  "content.term_handle_taken":
    "Bu adres başka bir kategoride ya da etikette kullanılıyor; farklı bir ad ya da adres yazın.",
  "content.term_name_invalid":
    "Ad gerekli; en fazla 120 karakter olmalı ve kullanılamayan karakter içermemeli.",
  "content.term_unknown":
    "Seçilen kategori ya da etiket bulunamadı; listeyi yenileyip yeniden seçin.",
  "content.terms_post_only": "Kategori ve etiket yalnızca blog yazılarına eklenebilir.",
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
  // The admin API's provider failure; the dashboard names the service (messages/provider.ts)
  "provider.failed": "Bağlı hizmet işlemi tamamlamadı; biraz sonra tekrar deneyin.",
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
  "gift_cards.no_expiry": "Hediye kartları süresizdir; son kullanma günü verilemez.",
  "gift_card.sale_disabled":
    "Mağaza şu anda hediye kartı satmıyor; hediye kartını sepetten çıkarın.",
  "gift_card.recipient_required":
    "Sepetteki her hediye kartı için alıcının e-posta adresini girin.",
  "gift_card.not_payable_with_credit":
    "Hediye kartı, hediye kartı ya da mağaza kredisiyle alınamaz; kartı veya krediyi sepetten çıkarın.",
  "gift_card.not_gift_line": "Bu satır bir hediye kartı değil.",
  "gift_card.recipient_email_invalid": "Alıcının e-posta adresi geçerli değil.",
  "gift_card.text_too_long": "Ad en çok 60, mesaj en çok 300 karakter olabilir.",
  "gift_card.text_invalid": "Metinde kullanılamayan bir karakter var.",
  "gift_card.text_link": "Ad ve mesajda bağlantı, web adresi ya da e-posta adresi olamaz.",
  "gift_card.unknown": "Bu koda ait hediye kartı bulunamadı.",
  "catalog.gift_card_disabled":
    "Hediye kartı satmak için önce Ayarlar > Özellikler'den hediye kartlarını açın.",
  "catalog.gift_card_kind": "Hediye kartı dijital üründür; türü değiştirilemez.",
  "catalog.core_gift_card":
    "Ürünü hediye kartı yapmak için ürün sayfasındaki 'Hediye kartı' seçeneğini kullanın.",
  "cart.line_unknown": "Bu satır sepette yok.",
  "cart.prices_changed":
    "Sepetteki bazı ürünlerin fiyatı değişti. Yeni tutarı kontrol edip ödemeyi yeniden başlatın.",
  "catalog.description_blocks":
    "Ürün açıklamasında görsel ve ürün ya da kategori kartı kullanılamaz; görselleri ürünün görsellerine ekleyin.",
  "catalog.summary_blocks":
    "Kısa açıklamada paragraf, küçük başlık (H3, H4), liste, kalın, italik ve bağlantı kullanılabilir; büyük başlık, alıntı, tablo ve görsel kullanılamaz.",
  "catalog.summary_too_long": "Kısa açıklama en çok 1.500 karakter olabilir.",
  "catalog.summary_link":
    "Kısa açıklamadaki bağlantılar mağazanın kendi sayfalarına ya da https:// ile başlayan adreslere gidebilir.",
  "catalog.addons_disabled":
    "Ek seçenekler kapalı. Açmak için Ayarlar > Özellikler'e gidin; sepette ek seçenekli ürün varsa çıkarın.",
  "addons.id_invalid": "Ek seçeneğin kimliği geçerli değil.",
  "addons.id_duplicate": "Aynı kimlik iki kez kullanılmış.",
  "addons.label_invalid": "Ad 1-60 karakter olmalı ve görünmez karakter içermemeli.",
  "addons.help_invalid": "Açıklama en çok 160 karakter olabilir.",
  "addons.price_invalid": "Fiyat 0 ile 10.000 TL arasında, en çok iki ondalıkla girilmeli.",
  "addons.max_quantity_invalid": "Satır başına adet sınırı 1 ile 99 arasında olmalı.",
  "addons.text_rules_invalid": "Yazı uzunluğu 1 ile 200 karakter arasında olmalı.",
  "addons.choices_invalid": "Seçim türündeki ek seçenekte 2-10 seçenek olmalı.",
  "addons.too_many": "Bir üründe en çok 5 ek seçenek olabilir.",
  "addons.required_must_be_free": "Ücretli ek seçenek zorunlu yapılamaz.",
  "addons.not_addon_line": "Bu ürünün ek seçeneği yok.",
  "addons.unknown": "Bu ek seçenek ya da seçim üründe yok.",
  "addons.duplicate": "Aynı ek seçenek iki kez seçilmiş.",
  "addons.text_required": "Bu ek seçenek için yazı girin.",
  "addons.text_too_long": "Yazı bu ek seçenek için izin verilenden uzun.",
  "addons.charset": "Yazıda yalnızca harf, rakam ve boşluk kullanılabilir.",
  "addons.text_link": "Yazıda bağlantı, web adresi ya da e-posta adresi olamaz.",
  "addons.required": "Bu ürün için zorunlu ek seçeneği seçin.",
  "addons.max_quantity": "Bu ek seçenekle bir satırda bu kadar adet alınamaz.",
  "addons.line_locked":
    "Ek seçenekli satırın bilgisi değiştirilemez; seçimleri ürünün ek seçenek alanından değiştirin.",
  "addons.unavailable":
    "Sepetteki bir ürünün ek seçeneği artık satılmıyor. Seçimi değiştirin ya da kaldırın.",
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
  "shipping.additional_data_reserved": "Bu istek platformun kendi alanlarını taşıyamaz.",
  "shipping.cod_single_parcel":
    "Kapıda ödemeli sipariş kargo firmasıyla tek koli olarak gönderilir: kurye tutarın tamamını bir kolide tahsil eder.",
  "shipping.no_rate":
    "Bu koli mağazanın kargo ücret tablosunun dışında kalıyor; kargo ücreti hesaplanamıyor.",
  "shipping.days_order": "En az gün, en çok günden büyük olamaz.",
  "shipping.rate_table_order":
    "Ücret tablosunun desi sınırları artan sırada ve en fazla bir ondalıkla olmalı.",
  "shipping.setup_incomplete":
    "Mağazanın birden çok deposu var ve hiçbiri varsayılan değil (ya da hiç depo yok); Ayarlar > Depolar'dan varsayılan depoyu seçin.",
  "shipping.manual_flat_only":
    "Mağazanın kendi gönderdiği seçenek yalnızca sabit ücretle fiyatlanabilir.",
  "shipping.amount_invalid": "Tutarı en çok iki ondalıkla girin.",
  "returns.unknown": "İade talebi bulunamadı.",
  "returns.status_invalid": "İade talebi bu işlem için uygun durumda değil.",
  "returns.items_invalid":
    "Seçilen ürünler iade edilebilecek olanlarla uyuşmuyor: her üründen en çok gönderilen ve henüz iade edilmemiş adet kadar.",
  "returns.withdrawal_excluded":
    "Bu üründe cayma hakkı yok (kişiye özel hazırlanan ürün, teslim edilen dijital içerik ya da ifa edilen hizmet); yalnızca hasarlı, yanlış ya da açıklamasına uymayan ürün olarak iade edilebilir.",
  "returns.refusal_not_sealed":
    "Yalnızca koruyucu ambalajı açıldığında iadesi sağlık ve hijyen açısından uygun olmayan ürünler, ambalajı açılmış geldiği için reddedilebilir.",
  "returns.window_closed":
    "Bu sipariş için iade süresi doldu ya da sipariş henüz kargoya verilmedi.",
  "returns.gift_card_used":
    "Bu hediye kartı kaleminin kartlarından harcama yapıldığı için cayma hakkı kullanılamaz.",
  "returns.gift_card_separate":
    "Hediye kartı kalemleri ayrı bir talepte ve yalnızca para iadesi olarak istenebilir.",
  "returns.already_open": "Bu sipariş için açık bir iade talebi zaten var.",
  "returns.exchange_variant_invalid":
    "Değişim için aynı ürünün satıştaki başka bir seçeneği seçilmeli.",
  "returns.exchange_same_variant":
    "Değişimde aynı seçenek seçilemez; başka beden ya da renk seçin.",
  "returns.exchange_out_of_stock": "İstenen seçenek stokta yok.",
  "returns.exchange_price_changed":
    "Değişimin fiyat farkı değişti; yeni farkı görüp tekrar onaylayın.",
  "returns.exchange_difference_due":
    "Müşteri fark ödeyecek; onaydan önce farkı tahsil edip işaretleyin.",
  "returns.exchange_no_shipping":
    "Siparişin kargo seçeneği bulunamadı; değişim gönderisi açılamıyor.",
  "returns.exchange_awaiting_return":
    "Değişimdeki ürün depoya ulaşmadan yeni ürün kargoya verilemez; önce iadeyi teslim alın.",
  "orders.edit_balance_open":
    "Siparişte düzenlemeden ayrı bir ödeme farkı var (önceki bir iade ya da tahsilat); bu siparişin kalemleri düzenlenemez.",
  "orders.edit_reference_invalid": "Düzenleme anahtarı geçersiz; pencereyi kapatıp yeniden açın.",
  "returns.exchange_incomplete":
    "Değişimde istenen bütün ürünler gelmeden teslim alınamaz; eksik ürün için müşteriyle görüşün.",
  "returns.exchange_discounted_price":
    "İndirimle alınmış ürün yalnızca aynı fiyatlı bir seçenekle değiştirilebilir; farklı fiyatta iade talebi açıp yeni sipariş verin.",
  "returns.exchange_balance_open":
    "Siparişte değişimden ayrı bir ödeme farkı var; değişim onaylanamıyor.",
  "returns.use_return_requests":
    "İade, değişim ve talepler yalnızca iade talepleri ekranından yürütülür.",
  "returns.carrier_refused": "Kargo firması iade gönderisini açmadı; birazdan tekrar deneyin.",
  "returns.cancel_handed_over":
    "Müşteri ürünü kargoya vermiş; talep iptal edilemez. Ürün depoya ulaşınca teslim alın.",
  "returns.cancel_received": "Bu talepte teslim alınmış ürün var; talep iptal edilemez.",
  "returns.cancel_exchange_collected":
    "Bu değişimde müşteriden fark tahsil edildi; talep buradan iptal edilemez. Ürünü teslim alın ya da farkı müşteriye elle iade edip mağaza yöneticisine başvurun.",
  "returns.refund_failed":
    'Ürünler teslim alındı ama para iadesi yapılamadı; "Para iadesini tekrar dene" ile yineleyin.',
  "aras.customer_code_invalid": "Müşteri kodu en çok 20 harf ve rakam olabilir.",
  "aras.service_url_invalid":
    "Servis adresi Aras Kargo'nun https ile başlayan bir adresi olmalı (araskargo.com.tr).",
  "shipping.carrier_unknown": "Bu gönderinin kargo firması tanınmıyor; takip edilemiyor.",
  "shipping.carrier_not_connected":
    "Kargo hizmeti bağlı değil. Ayarlar > Kargo'dan hesabı bağlayın.",
  "shipping.no_offer":
    "Bu gönderi için kargo teklifi alınamadı. Seçilen kargo hizmeti bu koliyi taşımıyor olabilir.",
  "shipping.option_invalid": "Kargo seçeneği bu hizmete ait değil.",
  "shipping.option_in_use":
    "Bu kargo seçeneğiyle gönderilmeyi bekleyen siparişler var; önce onlar kargoya verilmeli.",
  "shipping.use_ship_route":
    'Bu kargo hizmetiyle gönderi, sipariş sayfasındaki "Kargoya ver" ile açılır.',
  "shipping.address_incomplete":
    "Teslimat adresi kargo için eksik. Sipariş sayfasından teslimat adresini tamamlayın.",
  "shipping.receiver_abroad":
    "Teslimat adresi Türkiye dışında; yurt içi kargo firması bu adrese gönderi açmaz. Adresi düzeltin ya da siparişi mağazanın kendi gönderisiyle yollayın.",
  "shipping.receiver_name_missing":
    "Teslimat adresinde alıcının adı yok; fatura adresinde ve müşteri hesabında da bulunamadı. Sipariş sayfasından teslimat adresine ad soyad ekleyin.",
  "shipping.receiver_name_short":
    "Yurtiçi Kargo alıcı adını en az 5 karakter ve 4 harf olarak istiyor. Sipariş sayfasından teslimat adresindeki ad soyadı tamamlayın.",
  "shipping.receiver_address_missing":
    "Teslimat adresinde açık adres (mahalle, cadde, sokak, numara) yok. Sipariş sayfasından teslimat adresini tamamlayın.",
  "shipping.receiver_address_short":
    "Yurtiçi Kargo açık adresi en az 10 harf ya da rakam olarak istiyor. Sipariş sayfasından teslimat adresine mahalle, cadde ve numarayı ekleyin.",
  "shipping.receiver_place_missing":
    "Teslimat adresinde il ya da ilçe yok; kargo firması gönderiyi bunlarla yönlendiriyor. Sipariş sayfasından teslimat adresini tamamlayın.",
  "shipping.receiver_phone_missing":
    "Teslimat adresinde kuryenin arayabileceği bir telefon (alan koduyla 10 hane) yok; fatura adresinde ve müşteri hesabında da bulunamadı. Sipariş sayfasından teslimat adresine telefon ekleyin.",
  "shipping.sender_address_incomplete":
    "Deponun adresi kargo için eksik ve Geliver hesabında varsayılan gönderici adresi yok. Ayarlar > Depolar'dan deponun adresini tamamlayın.",
  "shipping.sender_location_missing":
    "Gönderinin çıkacağı depo belirlenemedi ve Geliver hesabında varsayılan gönderici adresi yok. Ayarlar > Depolar'dan varsayılan depoyu seçin ya da Geliver panelinde bir gönderici adresi tanımlayın.",
  "shipping.sender_address_missing":
    "Deponun açık adresi (mahalle, cadde, sokak, numara) girilmemiş ve Geliver hesabında varsayılan gönderici adresi yok. Ayarlar > Depolar'dan deponun adresini tamamlayın.",
  "shipping.sender_place_missing":
    "Deponun Türkiye'deki il ya da ilçesi girilmemiş ve Geliver hesabında varsayılan gönderici adresi yok. Ayarlar > Depolar'dan deponun adresini tamamlayın.",
  "shipping.sender_postal_missing":
    "Deponun posta kodu girilmemiş, adres verisinden de bulunamadı (mahalle seçili değil); Geliver hesabında varsayılan gönderici adresi de yok. Ayarlar > Depolar'dan posta kodunu ya da mahalleyi girin.",
  "shipping.sender_phone_missing":
    "Deponun ve mağazanın telefonu girilmemiş; Geliver hesabında varsayılan gönderici adresi de yok. Ayarlar > Depolar'dan deponun ya da Ayarlar > Mağaza'dan mağazanın telefonunu girin.",
  "shipping.sender_contact_missing":
    "Mağazanın iletişim e-postası girilmemiş (Geliver gönderici için istiyor) ve Geliver hesabında varsayılan gönderici adresi yok. Ayarlar > Mağaza'dan e-postayı ekleyin ya da Geliver panelinde bir gönderici adresi tanımlayın.",
  "shipping.fulfillment_invalid": "Etiketi istenen gönderi geçerli değil.",
  "shipping.label_unavailable": "Bu gönderinin etiketi yok.",
  "aras.merchant_invalid":
    "Aras Kargo bu kullanıcı adını kabul etmedi. Kullanıcı adını Aras'ın verdiği entegrasyon bilgilerinden yeniden kopyalayın.",
  "aras.secret_invalid":
    "Aras Kargo bu kullanıcı adı ve şifreyi kabul etmedi. Bilgileri Aras'ın verdiği entegrasyon belgesinden yeniden kopyalayın; test ve canlı hesap ayrıdır.",
  "customers.unknown": "Müşteri bulunamadı.",
  "account.login_email_missing": "Bu oturumun bir e-posta adresi yok; hesap açılamadı.",
  "messaging.consent_evidence_required": "İznin nasıl verildiğini en az 10 karakterle yazın.",
  "carts.unknown": "Sepet bulunamadı ya da tamamlanmış.",
  "customer_segments.rules_empty": "Segment için en az bir kural seçin.",
  "wishlist.full": "Favori listeniz dolu; önce birkaç ürünü çıkarın.",
  "wishlist.product_unknown": "Ürün bulunamadı.",
  "messaging.email_domain_refuses":
    "Bu e-posta adresinin alan adı e-posta almıyor; adresi kontrol edin.",
  "cart_reminders.link_invalid":
    "Bu bağlantı geçersiz, süresi dolmuş ya da kullanılmış. Sepetinize mağazadan ulaşabilirsiniz.",
  "marketing_feeds.unknown": "Feed bulunamadı.",
  "maintenance.not_enabled":
    "Bakım modu kapalı. Bu bağlantı yalnızca mağaza bakımdayken oluşturulabilir.",
  "maintenance.bypass_unknown": "Bakım bağlantısı geçersiz ya da süresi dolmuş.",
  "consents.link_invalid":
    "Bu bağlantı geçersiz, süresi dolmuş ya da kullanılmış. İzninizi hesabınızdan ya da yeniden abone olarak verebilirsiniz.",
  "stock_alerts.link_invalid":
    "Bu bağlantı geçersiz, süresi dolmuş ya da kullanılmış. Ürün sayfasından yeniden isteyebilirsiniz.",
  "stock_alerts.not_tracked": "Bu ürün için stok bildirimi verilemiyor.",
  "stock_alerts.in_stock": "Bu ürün şu an stokta; hemen sipariş verebilirsiniz.",
  "stock_alerts.email_required": "Haber verebilmemiz için e-posta adresinizi yazın.",
  "reviews.not_purchased": "Yalnızca teslim aldığınız ürünlere yorum yazabilirsiniz.",
  "reviews.photo_unknown": "Fotoğraflardan biri bulunamadı; yeniden ekleyin.",
  "reviews.photos_too_many": "Bir yoruma en çok 3 fotoğraf eklenebilir.",
  "reviews.photo_uploads_full":
    "Henüz bir yoruma eklenmemiş çok fazla fotoğraf yüklediniz; yarın yeniden deneyin.",
  "questions.unknown": "Soru bulunamadı.",
  "questions.answer_purchasers_only": "Yalnızca ürünü teslim almış müşteriler cevap yazabilir.",
  "messaging.no_address": "Müşterinin bu kanal için kayıtlı adresi ya da telefonu yok.",
  "messaging.suppression_unknown": "Bu adres listede yok.",
  "messaging.domains_unavailable":
    "Gönderici alan adı yalnızca e-postalar Resend üzerinden giderken doğrulanır (canlı ortam).",
  "messaging.domain_exists": "Zaten bir gönderici alan adı var; önce onu kaldırın.",
  "messaging.domain_missing": "Henüz bir gönderici alan adı eklenmedi.",
  "messaging.domain_invalid": "Alan adını https:// ve yol olmadan yazın, ör. magaza.com.tr.",
  "messaging.local_part_invalid":
    "Adresin @ öncesi kısmı küçük harf, rakam, nokta, tire ve alt çizgiden oluşmalı (en çok 32).",
  "messaging.template_unknown": "Böyle bir ileti şablonu yok.",
  "messaging.recipient_invalid": "Adres ya da telefon numarası geçerli değil.",
  "messaging.email_off": "E-posta gönderimi bu mağazada açık değil.",
  "messaging.sms_off": "SMS hesabı bağlı değil. Ayarlar > SMS'ten Netgsm hesabını girin.",
  "google.merchant_id_invalid": "Merchant Center hesap numarası yalnızca rakamlardan oluşur.",
  "google.merchant_invalid":
    "Bağlı Google hesabı bu Merchant Center hesabına erişemiyor. Hesap numarasını ve hesaptaki yetkinizi kontrol edin.",
  "google.secret_invalid":
    "Google bağlantısı artık geçerli değil; Google hesabını yeniden bağlayın.",
  "google.state_invalid":
    "Google bağlantısının süresi doldu ya da zaten kullanıldı; yeniden bağlayın.",
  "google.no_refresh_token": "Google kalıcı erişim vermedi; bağlantıyı yeniden başlatın.",
  "google.search_console_scope":
    "Google hesabı Search Console izni verilmeden bağlanmış; Search Console için yeniden bağlayın.",
  "google.gsc_site_invalid":
    "Bu Search Console mülkü bağlı Google hesabının okuyabildikleri arasında değil.",
  "google.not_configured": "Google bağlantısı bu mağaza için henüz kurulmadı.",
  "google.not_connected": "Önce Google hesabını bağlayın.",
  "google.reviews_scope":
    "Google hesabı İşletme Profili izni verilmeden bağlanmış; Google yorumları için yeniden bağlayın.",
  "google.location_invalid":
    "Bu işletme konumu bağlı Google hesabının yönettikleri arasında değil; listeyi yenileyin.",
  "google.review_not_found": "Bu Google yorumu artık yok; Google'da silinmiş olabilir.",
  "google.hide_reason_required":
    "Yorumu vitrinden kaldırmak için bir gerekçe seçin: kişisel veri, hakaret ya da konu dışı.",
  "google.hide_reason_invalid":
    "Google yorumu yalnızca kişisel veri, hakaret ya da konu dışı olduğu için kaldırılabilir.",
  "google.hide_reason_unexpected": "Vitrine geri alınan yorum için gerekçe gönderilmez.",
  "google.reply_required": "Yanıt boş olamaz.",
  "google.reply_too_long":
    "Yanıt Google'ın sınırını aşıyor (4096 bayt; Türkçe harfler iki sayılır). Biraz kısaltın.",
  "google.reply_invalid": "Yanıtta görünmeyen denetim karakterleri var; metni yeniden yazın.",
  "google.reply_missing": "Bu yorumun kaldırılacak bir yanıtı yok.",
  "google.reply_forbidden":
    "Bağlı Google hesabının bu işletmenin yorumlarını yanıtlama yetkisi yok; profilin sahibi ya da yöneticisi olan hesabı bağlayın.",
  "google.reply_unverified":
    "Google yalnızca doğrulanmış işletme profillerinde yanıta izin veriyor; profili Google'da doğrulayın.",
  "google.reply_refused": "Google bu yanıtı kabul etmedi; metni gözden geçirip yeniden deneyin.",
  "google.reply_unavailable":
    "Google yanıtı şu an almadı; hiçbir şey değişmedi. Biraz sonra yeniden deneyin.",
  "reports.range_invalid":
    "Tarih aralığı geçersiz: başlangıç bitişten sonra, gelecekte ya da 366 günden uzun olamaz.",
  "catalog_import.cost_invalid": "Maliyet 0 ile 10.000.000 arasında, en fazla 2 ondalıklı olmalı.",
  "webhook.event_scope":
    "Bu anahtar seçilen olayların verisini okuyamaz: sipariş ve iade olayları için sipariş okuma, stok olayı için katalog okuma izni gerekir.",
  "webhook.events_required": "Abonelik için en az bir olay seçin.",
  "webhook.limit": "En çok 20 webhook aboneliği açılabilir; kullanılmayanları silin.",
  "webhook.unknown": "Webhook aboneliği bulunamadı.",
  "webhook.url_https": "Adres https ile başlamalı.",
  "webhook.url_internal": "Adres mağazanın iç ağına ya da yerel bir sunucuya gidemez.",
  "webhook.url_invalid": "Adres geçersiz.",
  "webhook.url_port": "Adres yalnızca 443 numaralı bağlantı noktasını kullanabilir.",
  "staff.no_role": "Hesabınızın bu mağazada bir rolü yok; mağaza sahibine başvurun.",
  "staff.unknown": "Ekip üyesi bulunamadı.",
  "staff.remove_self": "Kendinizi ekipten çıkaramazsınız.",
  "staff.invite_member": "Bu adresin zaten bir hesabı var.",
  "staff.invite_pending": "Bu adrese açık bir davet var; daveti yeniden gönderin.",
  "staff.invite_failed": "Davet oluşturulamadı.",
  "staff.invite_unknown": "Davet bulunamadı.",
  "staff.invite_invalid":
    "Davet bağlantısı geçersiz ya da süresi dolmuş; mağaza sahibinden yeni bir davet isteyin.",
  "staff.invite_login": "Hesap, davet edilen e-posta adresiyle açılmalı.",
  "staff.email_invalid": "E-posta adresi geçersiz.",
  "staff.name_required": "Ad ve soyad gerekli.",
  "staff.mfa_required":
    "Devam etmek için iki adımlı doğrulamayı kurun ya da kodla yeniden giriş yapın.",
  "staff.reset_self": "Kendi iki adımlı doğrulamanızı Ayarlar > Güvenlik'ten kapatın.",
  "staff.reauth_required": "Bu değişiklik için kimliğinizi yeniden doğrulayın.",
  "staff.reauth_failed": "Doğrulama kodu ya da şifre doğru değil.",
  "staff.mfa_code_used": "Bu kod kullanıldı; uygulamadaki yeni kodu girin.",
  "staff.reauth_locked": "Çok fazla deneme yapıldı; biraz sonra yeniden deneyin.",
  "staff.forbidden": "Rolünüz bu işlem için yetkili değil.",
  "staff.last_owner": "Mağazanın son sahibi rolünü bırakamaz; önce başka birini sahip yapın.",
  "api_key.delete_active": "Etkin anahtar silinemez; önce iptal edin.",
  "staff.password_wrong": "Mevcut şifreniz doğru değil.",
  "staff.password_same": "Yeni şifre mevcut şifrenizle aynı olamaz.",
  "staff.email_same": "Bu zaten giriş adresiniz.",
  "staff.email_unavailable": "Bu e-posta adresi kullanılamıyor; başka bir adres deneyin.",
  "staff.email_change_invalid":
    "Onay bağlantısı geçersiz, süresi dolmuş ya da kullanılmış; panelden yeniden isteyin.",
  "staff.job_title_invalid": "Unvan geçersiz karakter içeriyor.",
  "api_key.fields_not_allowed": "Anahtarla alan seçilemez (fields); uç kendi alanlarını döner.",
  "api_key.scope_denied": "Bu anahtar bu işlem için yetkili değil.",
  "api_key.scopes_required": "Anahtar için en az bir izin seçin.",
  "api_key.title_invalid": "Anahtar adı geçersiz.",
  "api_key.unknown": "API anahtarı bulunamadı.",
  "accounting.adapter_unavailable": "Bu muhasebe programı bu ortamda seçilemez.",
  "einvoice.waive_not_allowed":
    'Yalnızca gider pusulası için "belge gerekmiyor" denebilir; şirketin iade faturası her zaman kaydedilir.',
  "einvoice.not_return": "Bu kayıt bir iade belgesi değil.",
  "einvoice.not_sale": "İade belgesi satış faturası gibi işlenmez; iade belgesi olarak girin.",
  "einvoice.return_not_pending":
    "İade belgesi artık beklemiyor: işlenmiş ya da gerekmediği kaydedilmiş.",
  "einvoice.return_number_invalid":
    "Belge numarası harf, rakam, boşluk, nokta, eğik çizgi ya da tireden oluşmalı (en çok 40 karakter).",
  "einvoice.series_mismatch":
    "Fatura numarası, Ayarlar > E-Fatura'daki web satış serisiyle başlamalı.",
  "einvoice.provider_unavailable": "Bu fatura programı bu ortamda seçilemez.",
  "einvoice.currency_unsupported": "Yalnızca Türk lirası siparişler faturalanır.",
  "einvoice.no_lines": "Siparişte faturalanacak satır yok.",
  "einvoice.buyer_name_missing": "Fatura adresinde alıcının adı yok.",
  "einvoice.address_missing": "Siparişte fatura adresi yok.",
  "einvoice.tax_office_missing": "Kurumsal alıcının vergi dairesi yok.",
  "einvoice.carrier_identity_missing":
    "Kargo firmasının unvanı ve VKN'si girilmemiş (Ayarlar > E-Fatura).",
  "einvoice.store_url_missing": "Mağazanın vitrin adresi yok.",
  "einvoice.parasut_unavailable": "Paraşüt bağlantısı bu sunucuda henüz açılmadı.",
  "einvoice.parasut_not_connected": "Paraşüt hesabı bağlı değil (Ayarlar > E-Fatura).",
  "einvoice.parasut_disconnected":
    "Paraşüt bağlantıyı reddetti; hesabı yeniden bağlayın (Ayarlar > E-Fatura).",
  "einvoice.parasut_refresh_unknown":
    "Paraşüt jeton yenilemesinin yanıtı alınamadı; sorun sürerse hesabı yeniden bağlayın.",
  "einvoice.parasut_code_refused":
    "Paraşüt bu kodu kabul etmedi. Paraşüt sayfasından yeni bir kod alıp yapıştırın.",
  "einvoice.parasut_company_refused": "Bu Paraşüt hesabı bu firma numarasına erişemiyor.",
  "einvoice.parasut_company_invalid": "Firma numarası yalnızca rakamlardan oluşur.",
  "einvoice.parasut_code_invalid":
    "Yetki kodu geçersiz görünüyor; Paraşüt sayfasındaki kodu eksiksiz yapıştırın.",
  "einvoice.rate_limited": "Paraşüt'e çok sık istek gitti; biraz sonra yeniden denenecek.",
  "einvoice.unknown": "Fatura bulunamadı.",
  "einvoice.not_external": "Bu fatura mağazanın kendi programıyla kesilmiyor.",
  "einvoice.cancelled": "Bu fatura iptal edildi.",
  "einvoice.already_issued": "Bu fatura başka bir numarayla kesilmiş.",
  "einvoice.number_taken": "Bu fatura numarası başka bir faturada kayıtlı.",
  "einvoice.not_issued": "Önce fatura numarasını girin, sonra PDF'i yükleyin.",
  "einvoice.number_invalid": "Fatura numarası GİB biçiminde olmalı (ör. ABC2026000000123).",
  "einvoice.uuid_invalid": "ETTN geçersiz görünüyor.",
  "einvoice.issued_at_invalid": "Kesim tarihi ileri bir tarih olamaz.",
  "einvoice.pdf_invalid": "Yalnızca PDF dosyası yüklenebilir.",
  "einvoice.pdf_missing": "Bu faturanın PDF'i yok.",
  "einvoice.not_failed": "Yalnızca durmuş bir fatura yeniden denenebilir.",
  "einvoice.not_pending": "Faturanın içeriği yalnızca kesilmeyi beklerken okunabilir.",
  "einvoice.number_year": "Fatura numarasındaki yıl, kesim tarihinin yılıyla aynı olmalı.",
  "einvoice.company_changed":
    "Fatura başka bir Paraşüt firmasında açılmış; bağlı firma değişti. Paraşüt'e bakın.",
  "accounting.sync_unknown": "Aktarım kaydı bulunamadı.",
  "accounting.source_missing": "Aktarılacak kayıt artık yok.",
  "accounting.month_invalid": "Ay geçersiz: başlamış bir ay olmalı, en fazla iki yıl öncesi.",
  "catalog.cost_invalid": "Maliyet 0 ile 10.000.000 TL arasında, en çok iki ondalıkla olmalı.",
  "statements.day_invalid": "Bu gün denetlenemez: en geç dün, en fazla bir yıl öncesi olabilir.",
  "statements.account_missing": "Bu ödeme sağlayıcısı bağlı değil; önce hesabı bağlayın.",
  "content_drafts.no_provider": "Taslak sağlayıcısı henüz tanımlı değil.",
  "content_drafts.quota_reached": "Bu ayın taslak hakkı doldu; gelecek ay yenilenir.",
  "content_drafts.not_open": "Bu taslak artık onay beklemiyor.",
  "content_drafts.unknown_product": "Ürün bulunamadı.",
  "meta.pixel_id_invalid": "Piksel numarası yalnızca rakamlardan oluşur.",
  "meta.test_event_code_invalid": "Test olayı kodu yalnızca harf ve rakamdan oluşur.",
  "meta.merchant_invalid":
    "Meta bu piksel numarasını tanımıyor ya da anahtar bu piksele erişemiyor.",
  "meta.secret_invalid": "Meta bu erişim anahtarını kabul etmedi.",
  "google_analytics.measurement_id_invalid": "Ölçüm kimliği G- ile başlar, örneğin G-ABC123XYZ.",
  "netgsm.iys_brand_code_invalid": "İYS marka kodu yalnızca rakamlardan oluşur.",
  "netgsm.msgheader_invalid":
    "Gönderici adı 2–11 karakter olmalı; Netgsm'de onaylı başlığınızı aynen yazın.",
  "netgsm.merchant_invalid":
    "Netgsm girişi doğru ama bu gönderici adı hesabınızda yok. Netgsm panelindeki onaylı başlığı aynen yazın.",
  "netgsm.secret_invalid":
    "Netgsm bu kullanıcı adı ve şifreyi kabul etmedi ya da API erişimi kapalı. Netgsm panelinde Ayarlar > API işlemleri'nden API erişimini ve IP iznini kontrol edin.",
  "yurtici.merchant_invalid":
    "Yurtiçi Kargo, tahsilatlı teslimat (kapıda ödeme) hesabının kullanıcı adı ve şifresini kabul etmedi. Bilgileri Yurtiçi'nin bu hesap için verdiği belgeden yeniden kopyalayın.",
  "yurtici.secret_invalid":
    "Yurtiçi Kargo bu kullanıcı adı ve şifreyi kabul etmedi. Bilgileri Yurtiçi'nin verdiği web servis belgesinden yeniden kopyalayın; test ve canlı hesap ayrıdır.",
  "yurtici.cod_account_missing":
    "Kapıda ödemeli siparişi Yurtiçi Kargo ile göndermek için tahsilatlı teslimat hesabı gerekir. Ayarlar > Kargo > Yurtiçi Kargo'dan girin.",
  "geliver.merchant_invalid":
    "Geliver bu API anahtarını kabul etmedi. Anahtarı Geliver panelindeki API anahtarları sayfasından yeniden kopyalayın.",
  "geliver.secret_invalid":
    "Geliver bu API anahtarını kabul etmedi. Anahtarı Geliver panelindeki API anahtarları sayfasından yeniden kopyalayın.",
  "iyzico.merchant_invalid":
    "iyzico bu API anahtarını tanımadı. Anahtarın seçili ortama ait olduğundan emin olun: sandbox anahtarı yalnızca sandbox açıkken, canlı anahtar yalnızca kapalıyken çalışır.",
  "iyzico.secret_invalid":
    "iyzico gizli anahtarı kabul etmedi. Gizli anahtarı API anahtarıyla aynı sayfadan yeniden kopyalayın.",
  "media.alt_invalid": "Alt metinde kullanılamayan karakterler var.",
  "media.file_id_invalid": "Dosya adı geçerli değil.",
  "media.file_unknown": "Dosya bulunamadı.",
  "media.filename_invalid": "Dosya adını 1–200 karakter arasında, özel karakter kullanmadan yazın.",
  "media.files_not_removed":
    "Görselin dosyaları şu an silinemedi; görsel kütüphanede kaldı. Biraz sonra yeniden deneyin.",
  "media.import_address_refused":
    "Bu adresten görsel alınamaz. Herkese açık bir https adresi girin.",
  "media.import_unreachable":
    "Adresteki görsele ulaşılamadı. Adresi tarayıcıda açıp görselin göründüğünü kontrol edin.",
  "media.in_use":
    "Bu görsel kullanılıyor; silinemez. Önce kullanıldığı yerlerden kaldırın (ayrıntıda listelenir).",
  "media.not_an_image": "Bu dosya bir görsel değil.",
  "media.unknown": "Görsel bulunamadı.",
  "media.update_empty": "Değiştirilecek bir alan gönderilmedi.",
  "listing.id_required": "Hangi listenin istendiği belirtilmeli.",
  "listing.search_query_invalid": "Aramak için bir kelime yazın (en çok 100 karakter).",
  "listing.search_query_unexpected": "Arama metni yalnızca aramada gönderilir.",
  "orders.nothing_to_ship": "Bu siparişte kargoya verilecek ürün kalmadı.",
  "legal.unknown": "Böyle bir yasal metin türü yok.",
  "legal.not_published": "Bu metin henüz yayımlanmadı.",
  "legal.draft_missing": "Bu metnin taslağı yok.",
  "legal.nothing_published":
    "Bu metnin yayında sürümü yok, taslağa kopyalanamaz. Başlangıç metninden başlayabilirsiniz.",
  "legal.token_invalid":
    "Metinde tanınmayan ya da yarım kalmış belirteç var: {{tokens}}. Belirteçler {mağaza_unvanı} biçiminde ve listedeki adlarla yazılır.",
  "legal.cookie_consent_missing": "Önce çerez tercihinizi seçin.",
  "legal.consent_missing":
    "Ödemeye geçmeden önce mesafeli satış sözleşmesini ve ön bilgilendirme formunu onaylayın.",
  "legal.version_changed":
    "Sözleşme metni güncellendi; lütfen yeni metni okuyup yeniden onaylayın.",
  "legal.nothing_to_accept": "Mağazanın onaylanacak yayında sözleşmesi yok.",
  "legal.copy_unknown": "Bu siparişle saklanan böyle bir sözleşme yok.",
  "catalog.restriction_disabled":
    "Ürün ya da kategoriyi yaş sınırlı işaretlemek için önce Ayarlar > Özellikler'den “Kısıtlı ürünler” özelliğini açın.",
  "catalog.category_unknown": "Kategori bulunamadı.",
  "catalog.category_image_unknown":
    "Kategori görseli mağazanın yüklediği dosyalardan olmalı; ortam kütüphanesinden seçin.",
  "age.declaration_missing":
    "Sepetinizde yaş sınırlı ürün var; ödemeye geçmeden önce yaşınızı beyan edin.",
  "age.under_limit": "Bu ürünler yalnızca yaş sınırını geçenlere satılabilir.",
  "age.birth_date_invalid": "Geçerli bir doğum tarihi girin.",
  "age.not_required": "Bu sepet için yaş beyanı gerekmiyor.",
  "platform_settings.invoice_series_invalid": "Seri 3 harf ya da rakam olmalı (ör. WEB).",
  "platform_settings.min_age_invalid": "Yaş sınırı 18 ile 25 arasında bir tam sayı olmalı.",
  "privacy_requests.unknown": "KVKK talebi bulunamadı.",
  "privacy_requests.not_open": "Bu talep zaten yanıtlandı ya da bu işlem bu talep türü için değil.",
  "privacy_requests.received_in_future": "Talebin alındığı zaman ileri bir tarih olamaz.",
  "privacy_requests.orders_open":
    "Müşterinin henüz teslim edilmemiş ya da iptal edilmemiş bir siparişi var; sipariş tamamlanınca silin.",
  "privacy_requests.returns_open":
    "Müşterinin süren bir iade talebi var; talep sonuçlanınca silin.",
  "privacy_requests.accounting_pending":
    "Müşterinin muhasebe programına henüz aktarılmamış bir satışı var; aktarım bitince silin.",
  "privacy_requests.erase_to_complete":
    "Silme talebi yalnızca veriler silinerek yanıtlanır; reddetmek için Reddet'i kullanın.",
  "privacy_requests.export_missing":
    "Önce dosyayı hazırlayın; talep dosya gönderilince yanıtlanır.",
  "audit_log.forget_too_recent":
    "Denetim kaydındaki istemci bilgisi bu kadar yeni kayıtlarda silinemez.",
  "legal.title_invalid": "Başlık görünmeyen kontrol karakterleri içeremez.",
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
  "platform_settings.color_duplicate": "Her renk adı bir kez yazılabilir.",
  "platform_settings.color_contrast":
    "Bu renk beyaz yazıyla ya da sayfa zemininde yeterince okunmuyor (en az 3:1 karşıtlık gerekir). Daha koyu bir ton seçin.",
  "platform_settings.date_invalid": "Tarih ve saat geçerli değil.",
  "platform_settings.email_duplicate": "Aynı e-posta adresi iki kez yazılmış.",
  "platform_settings.email_invalid": "Geçerli bir e-posta adresi girin.",
  "platform_settings.feature_unknown": "Böyle bir özellik yok.",
  "platform_settings.host_invalid": "Alan adını https:// ve yol olmadan yazın, ör. magaza.com.tr.",
  "platform_settings.invalid": "Girilen değer geçerli değil.",
  "platform_settings.mersis_invalid": "MERSİS numarası 16 rakamdan oluşur.",
  "platform_settings.tax_number_invalid":
    "Geçerli bir vergi kimlik numarası (10 hane) ya da T.C. kimlik numarası (11 hane) girin.",
  "platform_settings.kep_invalid": "Geçerli bir KEP adresi girin, ör. unvan@hs01.kep.tr.",
  "platform_settings.etbis_invalid": "ETBİS kayıt numarası harf, rakam ve tireden oluşur.",
  "platform_settings.withdrawal_days_invalid":
    "Cayma süresi 14 ile 365 gün arasında bir tam sayı olmalı; yasa en az 14 gün istiyor.",
  "platform_settings.return_shipping_shop_only":
    "Cayma iadesinde iade kargo ücreti müşteriden istenemez (Mesafeli Sözleşmeler Yönetmeliği md. 12); iade kargosunu mağaza öder.",
  "platform_settings.hours_invalid":
    "Çalışma saatleri geçerli değil: her aralık açılıştan sonra kapanmalı ve aynı gün içinde çakışmamalı.",
  "platform_settings.phone_invalid": "Geçerli bir Türkiye telefon numarası girin.",
  "platform_settings.robots_invalid":
    "robots.txt yalnızca User-agent, Allow, Disallow, Sitemap, Crawl-delay satırları ve yorum içerebilir.",
  "platform_settings.section_invalid": "Ayar bölümündeki değerler geçerli değil.",
  "platform_settings.token_unknown":
    "Metinde tanınmayan bir {…} bilgisi var. Kullanılabilenler: {mağaza_adı}, {telefon}, {e_posta}, {adres}, {whatsapp}, {ücretsiz_kargo_eşiği}.",
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
  "product_attributes.private_shown":
    "Vitrinde gösterilmeyen bir özellik filtre, arama başlığı ya da ürün seçeneği olamaz.",
  "product_attributes.value_invalid": "Girilen değer bu özellik için geçerli değil.",
  "product_attributes.values_exist": "Kaldırılan özelliklerin ürünlerde değerleri var.",
  "product_attributes.variant_only":
    "variesBy ve seçenek adı yalnızca varyant özelliklerinde kullanılır.",
  "product_attributes.group_unknown": "Bir özellik, şablonda olmayan bir gruba bağlı.",
  "product_attributes.group_key_invalid":
    "Grup anahtarı 1–40 küçük harf, rakam, tire ya da alt çizgiden oluşur.",
  "product_attributes.groups_duplicate": "Bir grup anahtarı şablonda bir kez kullanılabilir.",
  "product_attributes.aliases_duplicate": "Bir alanın başka adları birbirini tekrar edemez.",
  "product_attributes.convert_text_only":
    "Yalnızca ürün düzeyindeki metin tipinde bir özellik seçimliye çevrilebilir.",
  "product_attributes.convert_unmapped":
    "Ürünlerde kayıtlı “{{value}}” değeri hiçbir seçeneğe eşlenmedi; eşleyin ya da boşaltılacağını belirtin.",
  "product_attributes.convert_mapping_duplicate": "Kayıtlı bir değer yalnızca bir kez eşlenebilir.",
  "product_attributes.convert_required": "Zorunlu bir özelliğin değeri boşaltılamaz.",
  "description_facts.template_unknown": "Seçilen özellik şablonu bulunamadı.",
  "description_facts.no_template":
    "Ürünün özellik şablonu yok; önizlemede şablonu olmayan ürünler için bir şablon seçin.",
  "description_facts.none": "Açıklamada aktarılacak özellik bulunmadı.",
  "description_facts.required_missing":
    "Şablonun zorunlu alanı boş kalıyor ({{fields}}); ürün sayfasından doldurup yeniden aktarın.",
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
  "seo.security_txt_unset": "Güvenlik iletişim adresi henüz tanımlanmadı.",
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
  "storefront_layout.text_invalid": "Metin çok uzun ya da kullanılamayan karakter içeriyor.",
  "storefront_layout.token_unknown":
    "Metinde tanınmayan bir {…} bilgisi var. Kullanılabilenler: {mağaza_adı}, {telefon}, {e_posta}, {adres}, {whatsapp}, {ücretsiz_kargo_eşiği}.",
  "storefront_layout.target_invalid": "Seçilen kayıt geçerli değil.",
  "storefront_layout.target_unknown":
    "Bölümlerden birinin gösterdiği kayıt artık yok; onu yeniden seçin.",
  "storefront_layout.image_invalid": "Görsel mağazanın medya kütüphanesinden seçilmeli.",
  "storefront_layout.section_invalid": "Bölüm tanınmadı; sayfayı yenileyip yeniden deneyin.",
  "storefront_layout.section_duplicate":
    "Aynı bölüm iki kez eklenmiş; duyuru şeridi ve bülten birer kez olabilir.",
  "storefront_layout.color_invalid": "Renk #rrggbb biçiminde olmalı, ör. #2f6feb.",
  "storefront_layout.color_duplicate": "Her renk adı bir kez yazılabilir.",
  "storefront_layout.schedule_invalid": "Bölümün bitiş zamanı başlangıçtan sonra olmalı.",
  "storefront_layout.nothing_to_publish": "Yayınlanacak bir taslak yok; önce bir değişiklik yapın.",
  "storefront_layout.nothing_to_preview": "Önizlemek için önce taslağı kaydedin.",
  "storefront_layout.revision_unknown": "Bu sürüm artık tutulmuyor.",
  "storefront_layout.preview_unknown": "Önizleme bağlantısı geçersiz ya da süresi dolmuş.",
  "storefront_menus.text_invalid":
    "Menü adı ve bağlantı adı en fazla 60 karakter olmalı ve kullanılamayan karakter içermemeli.",
  "storefront_menus.target_invalid": "Bağlantının hedefi geçerli değil.",
  "storefront_menus.target_unknown":
    "Bağlantılardan birinin gösterdiği kayıt artık yok; bağlantıyı yeniden seçin.",
  "storefront_menus.url_invalid": "Adres https:// ile ya da / ile başlamalı.",
  "storefront_menus.too_many": "Bir menüde en çok 200 bağlantı olabilir.",
  "storefront_menus.no_children": "Yalnızca ana menüde alt bağlantı olabilir.",
  "storefront_menus.location_taken":
    "Bu yerde zaten bir menü var; ana menü ve üst bağlantılar birer tanedir.",
  "storefront_menus.too_many_footers": "Alt bilgide en çok 10 sütun olabilir.",
  "storefront_menus.unknown": "Menü bulunamadı.",
  "tr_address.phone_invalid": "Telefon numarası geçerli değil.",
  "tr_address.postal_code_invalid": "Posta kodu geçerli değil.",
  "tr_address.postal_code_neighborhood_mismatch": "Posta kodu seçilen mahalleye ait değil.",
  "tr_address.postal_code_province_mismatch": "Posta kodu seçilen ile ait değil.",
  "tr_address.province_code_invalid": "İl seçimi geçerli değil.",
  "tr_address.province_not_found": "İl bulunamadı.",
  "tr_address.source_unavailable":
    "TürkiyeAPI'ye ulaşılamadı; adres verisi değişmedi. Biraz sonra yeniden deneyin.",
  "tr_address.dataset_incomplete":
    "TürkiyeAPI'den gelen veri eksik; adres verisi değişmedi. Biraz sonra yeniden deneyin.",
  "tr_address.dataset_changed":
    "TürkiyeAPI verisi indirilirken güncellendi; adres verisi değişmedi. Yeniden deneyin.",
  "tr_address.file_required": "İçe aktarılacak dosyayı belirtin.",
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
  "payments.amount_due": "Bu sepette ödenecek tutar var; bir ödeme yolu seçin.",
  "payments.checkout_invalid": "Ödeme bilgileri eksik ya da geçersiz.",
  "payments.restart_checkout": "Tutar değişti; ödemeyi yeniden başlatın.",
  "payments.return_url_invalid": "Dönüş adresi bu mağazanın adreslerinden biri değil.",
  "payments.session_invalid": "Ödeme oturumu tanınmadı.",
  "payments.use_checkout_route": "Bu ödeme yöntemi mağazanın ödeme adımından başlatılır.",
  "paytr.not_configured": "Mağaza PayTR hesabını henüz bağlamadı.",
  "orders.test_payment_not_shippable":
    "Bu sipariş test modunda ödendi, gerçek para alınmadı: yalnızca test modundaki bir kargo firmasıyla (Aras, Yurtiçi, Geliver) gönderilebilir. Bu siparişin kargo seçeneği kendi gönderiminiz ya da canlı moddaki bir firma.",
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
  // F14 (adr/0042): moving a shop from its old platform
  "migration.bundle_invalid":
    "Taşıma dosyası okunamadı ya da biçimi uymuyor; sorunlu alan belirtildi.",
  "migration.email_invalid": "E-posta adresi geçersiz; müşteri taşınmadı.",
  "migration.product_not_written": "Ürün yazılamadı; ayrıntı Ürünler sayfasında.",
  "migration.product_description_failed":
    "Ürünün biçimli açıklaması yazılamadı; ürün düz metin açıklamasıyla kaldı.",
  "migration.product_gone": "Önceki taşımanın yaptığı ürün artık yok; açıklaması yenilenmedi.",
  "migration.description_refresh_empty":
    "Dışa aktarmada bu ürünün açıklaması yok; buradaki açıklaması olduğu gibi kaldı.",
  "migration.refresh_wordpress_only":
    "Açıklama yenileme yalnızca WordPress dışa aktarmasıyla yapılır.",
  "migration.review_product_missing": "Yorumun ürünü taşınmadı; yorum da taşınmadı.",
  "migration.review_duplicate": "Bu müşterinin bu ürüne yorumu zaten var; ikinci yorum taşınmadı.",
  "migration.parcel_incomplete":
    "Varsayılan paket için ağırlık, uzunluk, genişlik ve yüksekliğin dördü birlikte verilmeli.",
  "migration.product_parcel_defaulted":
    "Ürünün ölçüsü kaynakta yoktu; varsayılan paket ölçüsü kullanıldı.",
  "migration.product_no_parcel":
    "Ürünün ağırlığı ya da ölçüleri yok; kargo varsayılan paketle hesaplanır.",
  "migration.run_not_interrupted": "Yalnızca yarıda kalan bir aktarım yeniden başlatılabilir.",
  "migration.run_unknown": "Aktarım bulunamadı.",
  "migration.source_file_gone":
    "Bu aktarımın dosyası artık saklanmıyor; dosyayı yeniden yükleyip başlatın.",
  "migration.shopify_not_connected":
    "Shopify mağazası bağlı değil; önce Ayarlar > Entegrasyonlar'dan bağlayın.",
  "migration.shopify_currency":
    "Shopify mağazası Türk lirası dışında bir para birimiyle satıyor; fiyatlar çevrilmeden taşınamaz.",
  "shopify.shop_domain_invalid": "Mağaza adresi magaza-adi.myshopify.com biçiminde olmalı.",
  "shopify.client_id_invalid": "İstemci kimliği (Client ID) geçersiz.",
  "migration.image_address_refused":
    "Görsel adresi reddedildi: iç ağa ya da izin verilmeyen bir adrese gidiyor.",
  "migration.image_too_large": "Görsel 10 MB'tan büyük; taşınmadı.",
  "migration.image_unreachable": "Görsele ulaşılamadı; taşınmadı. Ürüne elle ekleyebilirsiniz.",
  "migration.image_not_accepted":
    "Dosya kabul edilen bir görsel değil (JPEG, PNG, WebP, AVIF) ya da okunamadı.",
  "migration.url_path_taken": "Bu eski adres sitede başka bir kayda ait; yönlendirilmedi.",
  "migration.url_rules_refused":
    "Yönlendirme kuralları yazılamadı; kararları gözden geçirip yeniden uygulayın.",
  "migration.url_target_not_live":
    "Hedef, sitede yayında olan bir sayfa olmalı (başka bir yönlendirme değil).",
  "migration.sitemap_invalid":
    "Site haritası okunamadı; sitemaps.org biçiminde bir XML (ya da .xml.gz) olmalı.",
  "migration.sitemap_unreachable": "Site haritasına ulaşılamadı; adresi tarayıcıda açıp deneyin.",
  "migration.sitemap_address_refused":
    "Bu adres alınamaz: iç ağa ya da izin verilmeyen bir adrese gidiyor.",
  "migration.search_console_invalid":
    "Search Console dosyası okunamadı; Performans > Dışa aktar > CSV'den gelen zip'i ya da sayfalar CSV'sini yükleyin.",
  "migration.feed_invalid":
    "Ürün akışı okunamadı; Google Merchant (RSS 2.0, g: alanları) biçiminde bir XML olmalı.",
  "migration.feed_unreachable": "Ürün akışına ulaşılamadı; adresi tarayıcıda açıp deneyin.",
  "migration.feed_address_refused":
    "Bu adres alınamaz: iç ağa ya da izin verilmeyen bir adrese gidiyor.",
  "migration.feed_currency":
    "Ürün Türk lirası dışında bir para birimiyle; fiyat çevrilmeden taşınmadı.",
  "migration.feed_item_invalid": "Ürünün adı, adresi ya da fiyatı okunamadı; taşınmadı.",
  "migration.customers_sheet_invalid":
    'Müşteri listesi okunamadı; xlsx ya da CSV olmalı ve bir e-posta sütunu ("E-posta") içermeli.',
  "migration.claim_invalid":
    "Davet bağlantısı geçersiz ya da süresi dolmuş; mağazadan yeni bir davet isteyin.",
  "migration.claim_not_yours":
    "Bu davet başka bir e-posta adresine gönderilmiş; davetin geldiği adresle giriş yapın.",
  "migration.claim_used": "Bu davetle önceki hesap bilgileriniz zaten alındı.",
  "migration.customer_erased": "Bu müşteri bilgilerinin silinmesini istedi; yeniden taşınmadı.",
  "migration.product_handle_taken":
    "Bu tanıtıcı sitede başka bir ürüne ait; ürün taşınmadı (üzerine yazılmaz). Tanıtıcıyı kaynakta değiştirin ya da buradaki ürünü kaldırın.",
  "migration.url_path_reserved":
    "Bu eski adres sitenin ana sayfası ya da ayrılmış bir yolu; bir kayda bağlanmadı.",
  "migration.wordpress_invalid":
    "Dosya bir WordPress dışa aktarması değil ya da okunamadı. WordPress'te Araçlar > Dışa aktar > Tüm içerik ile indirilen .xml dosyasını yükleyin.",
  "migration.wordpress_too_large":
    "WordPress dışa aktarması 50 MB'tan büyük (sınır zip içindeki XML için de geçerli); bu yolla henüz taşınamıyor. Taşıma için bizimle iletişime geçin.",
  "migration.wordpress_trashed": "Kayıt WordPress'te çöp kutusunda; taşınmadı.",
  "migration.wordpress_product_type":
    "Gruplanmış ya da dış bağlantılı ürün; kendi fiyatı olmadığı için taşınmadı.",
  "migration.wordpress_product_unread": "Ürünün adı ya da kısa adı okunamadı; taşınmadı.",
  "migration.wordpress_attributes_unread":
    "Ürünün özellikleri okunamadı; seçenekler varyasyonlardan çıkarıldı.",
  "migration.wordpress_product_no_price":
    "Ürünün (ya da hiçbir varyasyonunun) fiyatı yok; taşınmadı.",
  "migration.wordpress_options_too_many":
    "Ürünün üçten fazla varyasyon özelliği var; ilk üçü seçenek oldu.",
  "migration.wordpress_variation_disabled": "Varyasyon WordPress'te kapalı; taşınmadı.",
  "migration.wordpress_variation_no_price": "Varyasyonun fiyatı yok; taşınmadı.",
  "migration.wordpress_variation_unread": "Varyasyonun seçenek değerleri okunamadı; taşınmadı.",
  "migration.wordpress_variation_orphan": "Varyasyonun ana ürünü dosyada yok; taşınmadı.",
  "migration.wordpress_image_missing":
    "Görsel dosyanın ortam kütüphanesinde yok; taşınmadı. Ürüne elle ekleyebilirsiniz.",
  "migration.wordpress_description_cut":
    "Ürün açıklaması bir sayfanın sınırından uzun; bir bölüm sınırında kesildi.",
  "migration.wordpress_summary_cut":
    "Kısa açıklama 1.500 karakterden uzun; o noktada kesildi. Ürün sayfasında kısaltabilirsiniz.",
  "migration.wordpress_body_cut": "Metin çok uzun; bir bölüm sınırında kesildi.",
  "migration.wordpress_body_media":
    "Metindeki görseller ya da ürün vitrini, galeri gibi bileşenler taşınmadı; yazı taşındı. Görselleri içerik düzenleyicide ekleyebilirsiniz.",
  "migration.wordpress_post_unread": "Yazının başlığı ya da kısa adı okunamadı; taşınmadı.",
  "migration.wordpress_path_reserved":
    "Bu adres vitrinin kendi sayfası (/blog, /sepet, /magaza gibi); içerik sayfası yapılmadı, eski adresi Eski adresler'de kararınızı bekliyor.",
  "migration.wordpress_post_categories":
    "Yazının birden çok kategorisi var; birincil olanı kategori oldu, diğerleri taşınmadı.",
  "migration.wordpress_post_tags_cut": "Yazının 50'den fazla etiketi var; ilk 50'si taşındı.",
  "migration.wordpress_term_unread":
    "Kategori ya da etiket adı okunamadı (kısa kod artığı ya da 120 karakterden uzun); taşınmadı.",
  "migration.wordpress_page_front":
    "Ana sayfa; içerik sayfası yapılmadı. Vitrinin ana sayfası Vitrin ayarlarından düzenlenir.",
  "migration.wordpress_page_legal":
    "Yasal metin; içerik sayfası yapılmadı (yasal metinler Ayarlar > Yasal'dan yayınlanır). Eski adresini Eski adresler'de /yasal/... sayfasına yönlendirin.",
  "migration.wordpress_page_system":
    "Mağaza sistem sayfası (sepet, ödeme, hesap, istek listesi); içerik sayfası yapılmadı.",
  "migration.wordpress_page_empty":
    "Sayfanın kendi metni yok (yalnızca tema bileşenleri); içerik sayfası yapılmadı.",
  "migration.wordpress_noindex_draft":
    "Eski sitede arama motorlarından gizliydi (noindex); taslak olarak taşındı, gözden geçirip yayınlayın ya da silin.",
  "migration.wordpress_comment_not_review": "Yorumun puanı yok; ürün yorumu olarak taşınmadı.",
  "migration.wordpress_review_photos": "Yorumun fotoğrafları taşınmadı; metni ve puanı taşındı.",
  "migration.wordpress_handle_duplicate":
    "Aynı kısa adla başka bir kayıt daha var; yalnızca ilki taşındı.",
  "migration.wordpress_menus":
    "Menüler taşınmadı; Vitrin > Menüler'den kurulur (kimlik sütununda öğe sayısı).",
  "migration.wordpress_coupons":
    "Kuponlar taşınmadı; Kampanyalar'dan indirim kodu olarak yeniden açılır (kullanım geçmişleri dışa aktarmada yok).",
  "migration.wordpress_blog_comments": "Blog yorumları taşınmadı (vitrinde blog yorumu yok).",
  "migration.wordpress_product_tags":
    "Ürün etiketleri taşınmadı (vitrinde ürün etiketi sayfası yok; eski etiket adresleri noindex'ti).",
  "migration.wordpress_attribute_not_moved":
    "Ürün özelliği taşınmadı: özellik şablonunda bu anahtarla bir alan açılınca ürünlere yazılabilir (kimlik sütununda ürün ve değer sayısı).",
  "migration.description_facts_left":
    "Açıklamadaki bu özellik ürünlere kendiliğinden yazılmadı (alanı yok, birden çok alana uyuyor ya da değeri okunamadı); Ürünler > Açıklamadaki özellikleri aktar ile karar verin (kimlik sütununda ürün sayısı).",
  "account.verification_session_required":
    "Adresinizi doğrulamak için önce hesabınıza giriş yapın; bağlantı ancak oturumunuzda çalışır.",
  "account.session_invalid": "Oturum geçersiz; yeniden giriş yapın.",
  "account.token_before_password_change":
    "Şifre değiştiği için bu oturum sona erdi; yeni şifrenizle yeniden giriş yapın.",
  "auth.password_too_short": "Şifre en az 10 karakter olmalı.",
  "auth.password_too_long": "Şifre en fazla 256 karakter olabilir.",
  "auth.password_common":
    "Bu şifre çok yaygın, kolayca tahmin edilir; başka bir şifre seçin. Birkaç kelimeden oluşan bir cümle iyi bir seçimdir.",
  "auth.password_contains_email": "Şifre e-posta adresinizin adını içermemeli.",
  "auth.password_breached":
    "Bu şifre bilinen bir veri sızıntısında yer alıyor; başka bir şifre seçin.",
  "fraud.challenge_required":
    "Güvenlik doğrulaması gerekiyor; sayfa bunu kendisi yapar, yeniden deneyin.",
  "fraud.refused": "Bu işlem şu anda yapılamıyor; lütfen mağazayla iletişime geçin.",
  "fraud.checkout_refused": "Bu sipariş şu anda tamamlanamıyor; lütfen mağazayla iletişime geçin.",
  "fraud.velocity": "Çok fazla deneme yapıldı; biraz sonra yeniden deneyin.",
  "fraud.review_pending": "Sipariş incelemede; onaylanmadan kargoya verilemez.",
  "fraud.review_rejected": "Sipariş incelemede reddedildi; kargoya verilemez, iptal edin.",
  "fraud.review_decided": "Bu inceleme az önce karara bağlandı; sayfayı yenileyin.",
  "fraud.block_invalid_email": "Geçerli bir e-posta adresi girin.",
  "fraud.block_invalid_email_domain": "Geçerli bir alan adı girin (ör. ornek.com).",
  "fraud.block_invalid_phone": "Geçerli bir Türkiye telefon numarası girin.",
  "fraud.block_invalid_ip": "Geçerli bir IP adresi girin.",
  "campaigns.unknown": "Toplu ileti bulunamadı.",
  "campaigns.locked":
    "Bu ileti zamanlandı ya da gönderilmeye başladı; içeriği değişmez. Değiştirmek için kopyalayın.",
  "campaigns.status_conflict": "İletinin durumu az önce değişti; sayfayı yenileyin.",
  "campaigns.token_unknown":
    "Metinde tanınmayan bir belirteç var. Yalnızca {ad} ve mağaza bilgisi belirteçleri kullanılabilir.",
  "campaigns.too_many_products": "Bir e-postada en çok 4 ürün kartı olabilir.",
  "campaigns.sms_too_long":
    "SMS metni, mağaza adı ve ret metniyle birlikte en çok 3 SMS boyunu geçmemeli; metni kısaltın.",
  "campaigns.content_missing": "Göndermeden önce iletinin konusunu ve metnini yazın.",
  "campaigns.schedule_invalid": "Gönderim zamanı ileri bir tarih olmalı ve 90 günü geçmemeli.",
  "campaigns.channel_off": "E-posta gönderimi bu mağazada açık değil.",
  "campaigns.sender_unverified":
    "Toplu e-posta için mağazanın gönderen alan adı doğrulanmış olmalı (Ayarlar > E-posta).",
  "campaigns.sms_account_missing": "Toplu SMS için önce SMS hesabını bağlayın (Entegrasyonlar).",
  "campaigns.sms_opt_out_missing":
    "Toplu SMS için önce ret metnini girin (Ayarlar > SMS); her ticari SMS'te bulunması gerekir.",
  "campaigns.segment_unknown": "Seçilen segment artık yok; kitleyi yeniden seçin.",
  "campaigns.test_address_missing":
    "Deneme gönderimi için adres yok: e-postada giriş adresiniz, SMS'te mağazanın telefonu kullanılır.",
  "campaigns.quota_spent": "Bugünkü gönderim sınırı doldu; deneme yarın gönderilebilir.",
  "campaigns.audience_empty":
    "Bu kitlede iletiyi alabilecek kimse yok (izin, bastırma listesi ya da 24 saat sınırı). Kitleyi değiştirin.",
  // adr/0051: payment links
  "payment_link.unavailable":
    "Bu ödeme bağlantısı geçerli değil ya da süresi doldu. Mağazayla iletişime geçin.",
  "payment_link.unknown": "Ödeme bağlantısı bulunamadı.",
  "payment_link.prices_changed":
    "Bu siparişteki fiyatlar değişti. Mağazaya bildirildi; size yeni bir bağlantı gönderilecek.",
  "payment_link.out_of_stock":
    "Siparişteki bir ürün şu anda stokta yok. Mağazaya bildirildi; sizinle iletişime geçilecek.",
  "payment_link.no_storefront":
    "Ödeme bağlantısı için önce mağazanın alan adını girin (Ayarlar > SEO).",
  "payment_link.no_region": "Türk lirası satış bölgesi yok; ödeme bağlantısı oluşturulamaz.",
  "payment_link.variant_unknown": "Seçilen ürünlerden biri bulunamadı ya da yayında değil.",
  "payment_link.variant_unpriced": "Seçilen ürünlerden birinin Türk lirası fiyatı yok.",
  "payment_link.customer_unknown": "Seçilen müşteri bulunamadı.",
  "payment_link.customer_required": "Bir müşteri seçin ya da yeni müşterinin bilgilerini girin.",
  "payment_link.customer_no_email": "Seçilen müşterinin e-posta adresi yok.",
  "payment_link.address_required": "Kargo seçeneği seçildiyse teslimat adresini de girin.",
  "payment_link.shipping_option_unknown": "Seçilen kargo seçeneği bulunamadı.",
  "payment_link.discount_not_allowed": "Rolünüz ödeme bağlantısında indirim veremez.",
  "payment_link.discount_over_limit":
    "Bu indirim sınırınızı aşıyor (en çok %20). Daha fazlasını mağaza sahibi verebilir.",
  "payment_link.discount_invalid": "İndirim tutarı geçersiz; siparişin tamamını karşılayamaz.",
  "payment_link.not_open": "Bu bağlantı artık açık değil.",
  "payment_link.extend_limit":
    "Bağlantı oluşturulduğundan en çok 7 gün geçerli olabilir; daha fazla uzatılamaz.",
  "payment_link.sent_recently": "Bu bağlantı az önce gönderildi; 10 dakika sonra yeniden deneyin.",
  "cart.payment_link_closed":
    "Bu sepetin ödeme bağlantısı kapandı. Ödeme alındıysa kendiliğinden iade edilir.",
  "cart.payment_link_superseded":
    "Bu bağlantıdan daha yeni bir sepet açıldı; ödemeye son açılan sepetten devam edin.",
  "cart.payment_link_changed":
    "Ödeme bağlantısıyla gelen siparişin ürünleri değiştirilemez. Bağlantıyı yeniden açın.",
  "cart.payment_link_prices_changed":
    "Bu siparişteki fiyatlar değişti. Mağazaya bildirildi; size yeni bir bağlantı gönderilecek.",
  "cart.payment_link_code_misused":
    "Bu indirim kodu yalnızca kendi ödeme bağlantısının sepetinde geçerlidir.",
  "cart.payment_link_locked":
    "Ödeme bağlantısıyla gelen siparişin ürünleri ve indirimi değiştirilemez.",
  "cart.payment_link_no_cod": "Ödeme bağlantısıyla gelen siparişte kapıda ödeme kullanılamaz.",
  "orders.use_payment_link":
    "Panelden sipariş, Siparişler > Ödeme bağlantıları ekranından oluşturulur.",
  // adr/0056: site search's synonym groups
  "search.synonym_terms_too_few":
    "Grupta en az iki farklı terim olmalı. Büyük-küçük harf ve Türkçe karakter farkı terimi değiştirmez.",
  "search.synonym_term_too_long": "Bir terim en çok 3 kelime olabilir.",
  "search.synonym_term_length": "Bir terim en çok 60 karakter olabilir.",
  "search.synonym_terms_too_many": "Bir grupta en çok 10 terim olabilir.",
  "search.synonyms_too_many":
    "Mağaza en çok 1000 eş anlamlı grubu tutabilir; yenisini eklemek için birini silin.",
  "search.synonym_unknown": "Eş anlamlı grubu bulunamadı.",
  "search.synonym_term_invalid":
    "Her terim en az bir harf ya da rakam içermeli; görünmeyen karakterler kullanılamaz.",
  // adr/0007 Ek 2026-11-04: KDV oranları
  "vat.rate_unknown": "KDV oranı bulunamadı.",
  "vat.rate_invalid": "0 ile 100 arasında, en çok iki ondalıklı bir oran girin.",
  "vat.rate_exists": "Bu yüzdeyle kullanımda bir KDV oranı zaten var.",
  "vat.rate_in_use":
    "Bu KDV oranında ürünler var. Önce ürünleri başka bir orana taşıyın, sonra kaldırın.",
  "vat.rate_is_default": "Varsayılan oran kaldırılamaz. Önce başka bir oranı varsayılan yapın.",
  "vat.rate_inactive": "Bu KDV oranı kaldırılmış. Önce geri alın.",
  "vat.name_invalid": "En çok 60 karakterlik, görünmeyen karakter içermeyen bir ad girin.",
  "vat.name_taken": "Bu adla başka bir KDV oranı var.",
  "vat.code_invalid": "Kod yalnızca harf, rakam, _ ve - içerebilir; en çok 20 karakter.",
  "vat.code_taken": "Bu kodla başka bir KDV oranı var.",
  "vat.too_many": "Bir mağaza en çok 20 KDV oranı kullanabilir. Yenisi için birini kaldırın.",
}

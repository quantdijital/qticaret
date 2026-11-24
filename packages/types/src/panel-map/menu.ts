import type { PanelMapEntry } from "./types"

/** The side menu's items (`navigation.ts` draws them), keyed as the menu keys them. */
export const MENU_ENTRIES = [
  {
    key: "dashboard",
    path: "/",
    label: "nav.dashboard",
    keywords: {
      tr: ["ana sayfa", "özet", "bugün", "satış özeti", "panel"],
      en: ["home", "overview", "today", "summary"],
    },
    help: {
      tr: "Mağazanın bugünkü durumu: satışlar, bekleyen siparişler ve yapılacak işler.",
      en: "The shop today: sales, orders waiting and what needs doing.",
    },
  },
  {
    key: "reports",
    path: "/reports",
    label: "nav.reports",
    keywords: {
      tr: ["rapor", "istatistik", "ciro", "satış raporu", "analiz", "grafik"],
      en: ["report", "statistics", "revenue", "sales report", "analytics"],
    },
    help: {
      tr: "Seçtiğiniz dönemin satış özeti ve rapor türleri. Her tablo Excel ya da CSV olarak indirilir.",
      en: "Sales for the period you pick, and the kinds of report. Every table downloads as Excel or CSV.",
    },
  },
  {
    key: "orders",
    path: "/orders",
    label: "nav.orders",
    keywords: {
      tr: ["sipariş", "satış", "kargoya ver", "hazırlanacak", "fatura kes"],
      en: ["order", "sale", "fulfil", "to ship"],
    },
    help: {
      tr: "Gelen siparişleri görür, hazırlar, kargoya verir ve iptal ya da iade edersiniz.",
      en: "See the orders that came in, prepare, ship, cancel or refund them.",
    },
  },
  {
    key: "paymentLinks",
    path: "/payment-links",
    feature: "orders.payment_links",
    needs: "paymentLinks",
    label: "nav.paymentLinks",
    keywords: {
      tr: ["ödeme linki", "link ile satış", "telefonla sipariş", "whatsapp sipariş"],
      en: ["payment link", "pay by link", "phone order"],
    },
    help: {
      tr: "Müşteri adına sipariş oluşturup ödeme bağlantısını gönderirsiniz; müşteri bağlantıdan öder.",
      en: "Make an order for a customer and send them a link to pay it.",
    },
  },
  {
    key: "customers",
    path: "/customers",
    label: "nav.customers",
    keywords: {
      tr: ["müşteri", "üye", "alıcı", "kullanıcı listesi", "müşteri bilgisi"],
      en: ["customer", "member", "buyer", "shopper"],
    },
    help: {
      tr: "Müşterilerinizi, adreslerini ve siparişlerini görürsünüz. Gruplar, terk edilen sepetler ve iletişim mesajları da buradadır.",
      en: "Your customers, their addresses and orders. Groups, abandoned carts and contact messages are here too.",
    },
  },
  {
    key: "wholesale",
    path: "/wholesale",
    feature: "customers.wholesale",
    needs: "wholesale",
    label: "nav.wholesale",
    keywords: {
      tr: ["toptan", "bayi", "toptancı", "b2b", "bayi fiyatı"],
      en: ["wholesale", "dealer", "b2b", "reseller"],
    },
    help: {
      tr: "Toptan alıcılarınızı, seviyelerini ve toptan siparişleri perakendeden ayrı yönetirsiniz.",
      en: "Your wholesale buyers, their levels and wholesale orders, apart from retail.",
    },
  },
  {
    key: "products",
    path: "/products",
    label: "nav.products",
    keywords: {
      tr: [
        "ürün",
        "mal",
        "stok kodu",
        "fiyat değiştir",
        "ürün görseli",
        "varyant",
        "beden",
        "renk",
      ],
      en: ["product", "item", "sku", "price", "variant", "size", "colour"],
    },
    help: {
      tr: "Ürünleri ekler, fiyatını, görsellerini, varyantlarını ve stoklarını düzenlersiniz.",
      en: "Add products and edit their prices, pictures, variants and stock.",
    },
  },
  {
    key: "categories",
    path: "/categories",
    label: "nav.categories",
    keywords: {
      tr: ["kategori", "reyon", "ürün grubu", "alt kategori"],
      en: ["category", "department", "subcategory"],
    },
    help: {
      tr: "Ürünlerin dizildiği kategori ağacını kurar, sıralar ve düzenlersiniz.",
      en: "Build, order and edit the category tree your products sit in.",
    },
  },
  {
    key: "brands",
    path: "/brands",
    label: "nav.brands",
    keywords: { tr: ["marka", "üretici", "firma"], en: ["brand", "manufacturer", "maker"] },
    help: {
      tr: "Sattığınız markaları, logolarını ve sayfalarını düzenlersiniz.",
      en: "The brands you sell, their logos and pages.",
    },
  },
  {
    key: "collections",
    path: "/collections",
    feature: "catalog.collections",
    label: "nav.collections",
    keywords: {
      tr: ["koleksiyon", "sezon", "özel seçki", "ürün listesi"],
      en: ["collection", "season", "curated list"],
    },
    help: {
      tr: "Ürünleri kategoriden bağımsız seçkilerde toplarsınız; yaz koleksiyonu gibi.",
      en: "Group products into selections apart from categories (a summer collection).",
    },
  },
  {
    key: "inventory",
    path: "/inventory",
    label: "nav.inventory",
    keywords: {
      tr: ["stok", "envanter", "depo", "adet", "stok sayımı", "tükenen"],
      en: ["stock", "inventory", "warehouse", "quantity", "out of stock"],
    },
    help: {
      tr: "Ürünlerin depolardaki adetlerini görür ve düzeltirsiniz; azalanlar ayrıca listelenir.",
      en: "See and correct how many of each product the warehouses hold; low stock is listed apart.",
    },
  },
  {
    key: "themeEditor",
    path: "/storefront/editor",
    label: "nav.themeEditor",
    keywords: {
      tr: [
        "tema",
        "vitrin tasarımı",
        "site görünümü",
        "ana sayfa düzeni",
        "renk",
        "yazı tipi",
        "logo",
      ],
      en: ["theme", "storefront design", "homepage layout", "colours", "font", "logo"],
    },
    help: {
      tr: "Vitrinin bölümlerini, renklerini ve yazı tiplerini önizleyerek düzenler, sonra yayımlarsınız.",
      en: "Edit the storefront's sections, colours and fonts with a preview, then publish.",
    },
  },
  {
    key: "looks",
    path: "/storefront/looks",
    needs: "looks",
    label: "nav.looks",
    keywords: {
      tr: ["hazır tasarım", "şablon", "kayıtlı görünüm", "tema şablonu"],
      en: ["ready-made look", "template", "saved look", "preset"],
    },
    help: {
      tr: "Hazır ve kaydettiğiniz görünümlerden birini taslağa alırsınız.",
      en: "Take a ready-made or saved look into the draft.",
    },
  },
  {
    key: "menus",
    path: "/storefront/menus",
    label: "nav.menus",
    keywords: {
      tr: ["menü", "üst menü", "alt menü", "gezinme", "bağlantılar"],
      en: ["menu", "navigation", "header menu", "footer links"],
    },
    help: {
      tr: "Vitrinin üst ve alt menülerindeki bağlantıları düzenlersiniz.",
      en: "Edit the links in the storefront's header and footer menus.",
    },
  },
  {
    key: "pages",
    path: "/storefront/pages",
    label: "nav.pages",
    keywords: {
      tr: ["sayfa", "hakkımızda", "iletişim sayfası", "özel sayfa", "sss"],
      en: ["page", "about us", "contact page", "faq"],
    },
    help: {
      tr: "Mağazanın kendi sayfalarını (hakkımızda, iletişim) bulur, tema düzenleyicide yazarsınız.",
      en: "Find the shop's own pages (about, contact) and write them in the theme editor.",
    },
  },
  {
    key: "content",
    path: "/content",
    label: "nav.content",
    keywords: {
      tr: ["blog", "yazı", "makale", "haber", "içerik"],
      en: ["blog", "post", "article", "news"],
    },
    help: {
      tr: "Blog yazılarını, kategorilerini, etiketlerini ve yazarlarını yönetirsiniz.",
      en: "Manage blog posts, their categories, tags and authors.",
    },
  },
  {
    key: "media",
    path: "/media",
    label: "nav.media",
    keywords: {
      tr: ["görsel", "resim", "fotoğraf", "dosya", "yüklenenler"],
      en: ["image", "picture", "photo", "file", "uploads"],
    },
    help: {
      tr: "Mağazaya yüklenen bütün görseller; yeniden kullanır ya da silersiniz.",
      en: "Every picture uploaded to the shop, to use again or delete.",
    },
  },
  {
    key: "promotions",
    path: "/promotions",
    label: "nav.promotions",
    keywords: {
      tr: ["indirim", "kampanya", "kupon", "indirim kodu", "promosyon", "fırsat"],
      en: ["discount", "promotion", "coupon", "discount code", "sale"],
    },
    help: {
      tr: "İndirim kodları ve kampanyalar oluşturursunuz. Fiyat listeleri ve hediye kartları da buradadır.",
      en: "Create discount codes and promotions. Price lists and gift cards are here too.",
    },
  },
  {
    key: "bulkMessages",
    path: "/bulk-messages",
    feature: "marketing.campaigns",
    needs: "bulkMessages",
    label: "nav.bulkMessages",
    keywords: {
      tr: ["toplu e-posta", "toplu sms", "bülten gönder", "duyuru", "e-posta kampanyası"],
      en: ["bulk email", "bulk sms", "newsletter", "email campaign"],
    },
    help: {
      tr: "Müşterilerinize toplu e-posta ve SMS yazar, önizler ve gönderirsiniz.",
      en: "Write, preview and send bulk e-mail and SMS to your customers.",
    },
  },
  {
    key: "popups",
    path: "/popups",
    feature: "marketing.popups",
    label: "nav.popups",
    keywords: {
      tr: [
        "pop-up",
        "açılır pencere",
        "duyuru penceresi",
        "e-bülten penceresi",
        "indirim penceresi",
      ],
      en: ["pop-up", "popup", "modal", "announcement", "newsletter popup"],
    },
    help: {
      tr: "Vitrinde açılan pencereleri (duyuru, indirim, e-bülten) ve ne zaman görüneceklerini yönetirsiniz.",
      en: "Manage the storefront's pop-ups (announcement, discount, newsletter) and when they show.",
    },
  },
  {
    key: "reviews",
    path: "/reviews",
    label: "nav.reviews",
    keywords: {
      tr: ["yorum", "değerlendirme", "puan", "soru", "müşteri yorumu"],
      en: ["review", "rating", "question", "feedback"],
    },
    help: {
      tr: "Ürün yorumlarını ve müşteri sorularını onaylar, yanıtlarsınız.",
      en: "Approve and answer product reviews and customers' questions.",
    },
  },
  {
    key: "settings",
    path: "/settings",
    label: "nav.settings",
    keywords: {
      tr: ["ayar", "yapılandırma", "tercihler", "seçenekler"],
      en: ["settings", "configuration", "preferences"],
    },
    help: {
      tr: "Mağazanın bütün ayarları konularına göre gruplu.",
      en: "All of the shop's settings, grouped by subject.",
    },
  },
] satisfies readonly PanelMapEntry[]

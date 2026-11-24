import type { PanelMapEntry } from "./types"

/** The screens under a menu item: reports, order queues, customer and promotion pages. */
export const PAGE_ENTRIES = [
  {
    key: "reports.products",
    parent: "reports",
    path: "/reports/products",
    label: "reports.tabs.products",
    keywords: {
      tr: ["en çok satan", "ürün satışları", "çok satanlar"],
      en: ["best sellers", "product sales", "top products"],
    },
    help: {
      tr: "Seçtiğiniz dönemde hangi ürünün ne kadar sattığı.",
      en: "How much each product sold in the period you pick.",
    },
  },
  {
    key: "reports.categories",
    parent: "reports",
    path: "/reports/categories",
    label: "reports.tabs.categories",
    keywords: { tr: ["kategori satışları"], en: ["category sales"] },
    help: { tr: "Kategorilere göre satışlar.", en: "Sales by category." },
  },
  {
    key: "reports.brands",
    parent: "reports",
    path: "/reports/brands",
    label: "reports.tabs.brands",
    keywords: { tr: ["marka satışları"], en: ["brand sales"] },
    help: { tr: "Markalara göre satışlar.", en: "Sales by brand." },
  },
  {
    key: "reports.marketing",
    parent: "reports",
    path: "/reports/marketing",
    label: "reports.tabs.marketing",
    keywords: {
      tr: ["trafik kaynağı", "kupon kullanımı", "reklam getirisi", "utm"],
      en: ["traffic source", "coupon use", "campaign results", "utm"],
    },
    help: {
      tr: "Kampanyaların ve ziyaret kaynaklarının getirdiği satışlar.",
      en: "Sales brought by promotions and traffic sources.",
    },
  },
  {
    key: "reports.daily",
    parent: "reports",
    path: "/reports/daily",
    label: "reports.tabs.daily",
    keywords: { tr: ["günlük satış", "gün gün ciro"], en: ["daily sales", "per day"] },
    help: { tr: "Satışların gün gün dökümü.", en: "Sales day by day." },
  },
  {
    key: "reports.finance",
    parent: "reports",
    path: "/reports/finance",
    label: "reports.tabs.finance",
    keywords: {
      tr: ["kâr", "gelir gider", "komisyon", "tahsilat", "muhasebe raporu"],
      en: ["profit", "income", "fees", "payouts", "accounting report"],
    },
    help: {
      tr: "Tahsilatlar, iadeler, komisyonlar ve vergiler: dönemin parası.",
      en: "Payments taken, refunds, fees and taxes: the period's money.",
    },
  },
  {
    key: "reports.stock",
    parent: "reports",
    path: "/reports/stock",
    label: "reports.tabs.stock",
    keywords: { tr: ["stok değeri", "stok raporu"], en: ["stock value", "stock report"] },
    help: { tr: "Eldeki stok ve değeri.", en: "The stock on hand and its value." },
  },
  {
    key: "reports.search",
    parent: "reports",
    path: "/reports/search",
    label: "reports.tabs.search",
    keywords: {
      tr: ["aranan kelimeler", "sonuçsuz arama", "site içi arama"],
      en: ["search terms", "searches without results", "site search"],
    },
    help: {
      tr: "Vitrinde ne arandığı ve hangi aramaların sonuçsuz kaldığı.",
      en: "What was searched on the storefront and which searches found nothing.",
    },
  },
  {
    key: "orders.review",
    parent: "orders",
    path: "/orders/review",
    label: "orders.fraud.queue",
    keywords: {
      tr: ["şüpheli sipariş", "dolandırıcılık", "riskli ödeme", "onay bekleyen"],
      en: ["suspicious order", "fraud", "risky payment", "held order"],
    },
    help: {
      tr: "Sahtekârlık kurallarına takılıp incelemeye alınan siparişler; onaylar ya da iptal edersiniz.",
      en: "Orders held by the fraud rules, to approve or cancel.",
    },
  },
  {
    key: "orders.returns",
    parent: "orders",
    path: "/orders/returns",
    label: "orders.returns.queue",
    keywords: {
      tr: ["iade talebi", "geri gönderim", "değişim", "para iadesi"],
      en: ["return request", "send back", "exchange", "refund"],
    },
    help: {
      tr: "Müşterilerin iade talepleri; kabul eder, ürünü teslim alır ve parayı iade edersiniz.",
      en: "Customers' return requests: accept, receive the items and refund.",
    },
  },
  {
    key: "orders.chargebacks",
    parent: "orders",
    path: "/orders/chargebacks",
    label: "orders.chargeback.queue",
    keywords: {
      tr: ["ters ibraz", "itiraz", "harcama itirazı", "chargeback"],
      en: ["chargeback", "dispute"],
    },
    help: {
      tr: "Kart sahiplerinin bankaya itiraz ettiği ödemeler ve yanıt süreleri.",
      en: "Payments card holders disputed with their bank, and the time left to answer.",
    },
  },
  {
    key: "orders.invoices",
    parent: "orders",
    path: "/orders/invoices",
    label: "orders.invoice.queue",
    keywords: {
      tr: ["e-fatura", "e-arşiv", "kesilen faturalar", "fatura hatası"],
      en: ["e-invoice", "invoices issued", "invoice error"],
    },
    help: {
      tr: "Siparişlerin faturaları ve kesilemeyenler; yeniden denersiniz.",
      en: "The orders' invoices and the ones that failed, to try again.",
    },
  },
  {
    key: "customers.groups",
    parent: "customers",
    path: "/customers/groups",
    label: "customers.sectionGroups",
    keywords: {
      tr: ["müşteri grubu", "segment", "vip müşteri"],
      en: ["customer group", "segment", "vip"],
    },
    help: {
      tr: "Müşterileri gruplara ayırır, segmentler kurarsınız; kampanyalar bunlara göre hedeflenir.",
      en: "Sort customers into groups and segments for promotions to target.",
    },
  },
  {
    key: "customers.abandonedCarts",
    parent: "customers",
    path: "/customers/abandoned-carts",
    needs: "abandonedCarts",
    label: "customers.sectionAbandoned",
    keywords: {
      tr: ["sepette bırakılan", "yarım kalan sipariş", "sepet hatırlatma"],
      en: ["abandoned cart", "cart reminder", "left in cart"],
    },
    help: {
      tr: "Alışverişi yarım bırakan müşterilerin sepetleri ve gönderilen hatırlatmalar.",
      en: "Carts customers left behind, and the reminders sent.",
    },
  },
  {
    key: "customers.contactMessages",
    parent: "customers",
    path: "/customers/contact-messages",
    label: "customers.sectionContact",
    keywords: {
      tr: ["iletişim formu", "gelen mesaj", "müşteri mesajı"],
      en: ["contact form", "messages", "inbox"],
    },
    help: {
      tr: "Vitrindeki iletişim formundan yazılanlar.",
      en: "What was written through the storefront's contact form.",
    },
  },
  {
    key: "customers.travelers",
    parent: "customers",
    path: "/customers/travelers",
    needs: "travelerRequests",
    label: "customers.sectionTravelers",
    keywords: {
      tr: ["katılımcı", "yolcu bilgisi", "kişisel veri talebi", "kvkk başvurusu"],
      en: ["traveler", "participant", "personal data request"],
    },
    help: {
      tr: "Tarihli ürünlerin katılımcılarının KVKK başvuruları: kayıtlarını bulur, verir ya da silersiniz.",
      en: "Dated products' travelers' data requests: find, copy or delete their records.",
    },
  },
  {
    key: "promotions.priceLists",
    parent: "promotions",
    path: "/promotions/price-lists",
    label: "priceLists.sectionPriceLists",
    keywords: {
      tr: ["fiyat listesi", "özel fiyat", "grup fiyatı", "toplu fiyat"],
      en: ["price list", "special price", "group price"],
    },
    help: {
      tr: "Belirli müşteri grupları ya da dönemler için ürünlere ayrı fiyatlar verirsiniz.",
      en: "Give products other prices for some customer groups or periods.",
    },
  },
  {
    key: "promotions.giftCards",
    parent: "promotions",
    path: "/promotions/gift-cards",
    feature: "promotions.gift_cards",
    label: "giftCards.section",
    keywords: { tr: ["hediye çeki", "hediye kartı", "bakiye"], en: ["gift card", "voucher"] },
    help: {
      tr: "Satılan hediye kartları ve kalan bakiyeleri.",
      en: "Gift cards sold and their balances.",
    },
  },
  {
    key: "reviews.questions",
    parent: "reviews",
    path: "/reviews/questions",
    label: "reviews.sectionQuestions",
    keywords: {
      tr: ["ürün sorusu", "müşteri sorusu", "soru cevap"],
      en: ["product question", "q&a"],
    },
    help: {
      tr: "Müşterilerin ürünlere sorduğu sorular; yanıtlar ve yayımlarsınız.",
      en: "Questions customers asked about products, to answer and publish.",
    },
  },
  {
    key: "reviews.google",
    parent: "reviews",
    path: "/reviews/google",
    label: "reviews.sectionGoogle",
    keywords: {
      tr: ["google yorumu", "işletme yorumları"],
      en: ["google reviews", "business reviews"],
    },
    help: {
      tr: "Mağazanın Google işletme yorumları; vitrinde gösterilecekleri seçersiniz.",
      en: "The shop's Google reviews; pick the ones the storefront shows.",
    },
  },
  {
    key: "wholesale.tiers",
    parent: "wholesale",
    path: "/wholesale/tiers",
    label: "wholesale.nav.tiers",
    keywords: {
      tr: ["bayi seviyesi", "toptan indirim", "iskonto"],
      en: ["wholesale tier", "dealer discount"],
    },
    help: {
      tr: "Toptancı seviyeleri ve her seviyenin indirimi.",
      en: "The wholesale levels and each one's discount.",
    },
  },
  {
    key: "wholesale.orders",
    parent: "wholesale",
    path: "/wholesale/orders",
    label: "wholesale.nav.orders",
    keywords: { tr: ["toptan sipariş", "bayi siparişi"], en: ["wholesale order", "dealer order"] },
    help: { tr: "Toptancıların verdiği siparişler.", en: "Orders the wholesalers placed." },
  },
  {
    key: "notifications",
    path: "/notifications",
    label: "notifications.title",
    keywords: {
      tr: ["bildirim", "uyarı", "zil", "haberler"],
      en: ["notifications", "alerts", "bell"],
    },
    help: {
      tr: "Mağazanın size bildirdikleri: yeni sipariş, iade talebi, ödeme sorunu.",
      en: "What the shop told you: new orders, return requests, payment problems.",
    },
  },
] satisfies readonly PanelMapEntry[]

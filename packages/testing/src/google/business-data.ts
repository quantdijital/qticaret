import { createHash } from "node:crypto"

/**
 * What the Business Profile stand-in serves (adr/0058): one account, one
 * location of a knife workshop and its Google reviews in Turkish, written
 * like customers write them: mostly five stars, a few lower, some without
 * text, an anonymous one, the owner's replies under some. Dates count back
 * from now so the newest stay new.
 */

export interface FakeBusinessLocation {
  /** `locations/{id}`. */
  name: string
  title: string
  storefrontAddress: {
    addressLines: string[]
    locality: string
    administrativeArea: string
    postalCode: string
    regionCode: string
  }
  metadata: { placeId: string; mapsUri: string; newReviewUri: string }
}

export interface FakeBusinessReview {
  reviewId: string
  reviewer: { displayName: string; profilePhotoUrl?: string; isAnonymous: boolean }
  starRating: "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE"
  comment?: string
  createTime: string
  updateTime: string
  reviewReply?: { comment: string; updateTime: string; reviewReplyState?: string }
  /** The review in Business Profile, by its Maps id (Google sends it, the v4 reference does not list it). */
  reviewReplyUrl?: string
}

export interface FakeBusinessAccount {
  name: string
  accountName: string
  type: "PERSONAL" | "LOCATION_GROUP" | "ORGANIZATION"
  role: "PRIMARY_OWNER" | "OWNER" | "MANAGER"
  verificationState: "VERIFIED"
}

interface Written {
  name: string
  stars: FakeBusinessReview["starRating"]
  daysAgo: number
  text?: string
  reply?: string
  photo?: boolean
  anonymous?: boolean
}

const WRITTEN: Written[] = [
  {
    name: "Mehmet Kaya",
    stars: "FIVE",
    daysAgo: 3,
    photo: true,
    text: "Şam çeliği av bıçağı aldım. Kılıfı gerçek deri, dikişleri çok temiz. Kargo ertesi gün elimdeydi.",
    reply: "Güzel yorumunuz için teşekkür ederiz Mehmet Bey, iyi günlerde kullanın.",
  },
  { name: "Zeynep Arslan", stars: "FIVE", daysAgo: 9 },
  {
    name: "Emre Yıldız",
    stars: "FOUR",
    daysAgo: 16,
    photo: true,
    text: "Mutfak bıçağı seti beklediğimden biraz ağır ama keskinliği gerçekten iyi. Kutusu hafif ezik geldi, ürüne bir şey olmamış.",
    reply:
      "Kutu için özür dileriz Emre Bey; o haftadan beri gönderimlerde ek koruma kullanıyoruz. Geri bildiriminiz için teşekkürler.",
  },
  {
    name: "Ayşe Demir",
    stars: "FIVE",
    daysAgo: 24,
    text: "Babama doğum günü hediyesi olarak isim yazdırdık, lazer kazıma çok net çıktı. Paketi de hediye paketi gibi özenliydi.",
  },
  {
    name: "Burak Şahin",
    stars: "FIVE",
    daysAgo: 38,
    photo: true,
    text: "Kamp için aldığım bushcraft bıçağı tam beklediğim gibi; kılıfı kemere sağlam oturuyor, sırtı ateş çubuğuyla iyi çalışıyor.",
  },
  {
    name: "Elif Çelik",
    stars: "THREE",
    daysAgo: 52,
    text: "Ürün güzel ama siparişim beş günde geldi, biraz daha hızlı olabilirdi.",
    reply:
      "Haklısınız Elif Hanım, o hafta kargo firmasında yoğunluk vardı. Yaşadığınız gecikme için özür dileriz.",
  },
  {
    name: "Hasan Öztürk",
    stars: "FIVE",
    daysAgo: 67,
    text: "Dükkâna gidip baktım, ustanın bileme konusundaki önerileri çok faydalı oldu. Eski Sürmene bıçağımı da bileyip verdiler.",
    reply: "Ziyaretiniz için teşekkür ederiz Hasan Bey, yine bekleriz.",
  },
  { name: "Selin Aydın", stars: "FIVE", daysAgo: 84, photo: true },
  {
    name: "Okan Koç",
    stars: "TWO",
    daysAgo: 101,
    text: "Çakının kilidi ilk günden biraz boşluk yaptı. Değişim için yazdım, dönüş bekliyorum.",
    reply:
      "Merhaba Okan Bey, mesajınıza döndük; değişim çakınız kargoya verildi. Anlayışınız için teşekkür ederiz.",
  },
  {
    name: "Fatma Yılmaz",
    stars: "FIVE",
    daysAgo: 133,
    text: "Fiyatına göre çok kaliteli. Ceviz sapın işçiliği fotoğraflardan daha güzel.",
  },
  {
    name: "A Google User",
    stars: "FOUR",
    daysAgo: 162,
    anonymous: true,
    text: "Paketleme özenliydi, bıçak kutusundan jilet gibi çıktı.",
  },
  {
    name: "Murat Aksoy",
    stars: "FIVE",
    daysAgo: 205,
    photo: true,
    text: "Üçüncü alışverişim. Her seferinde aynı özen, aynı hız. Kasap bıçağı setini herkese öneririm.",
    reply: "Tekrar tercih ettiğiniz için çok teşekkür ederiz Murat Bey.",
  },
  { name: "Gülşen Polat", stars: "FIVE", daysAgo: 248 },
  {
    name: "Kerem Erdoğan",
    stars: "FIVE",
    daysAgo: 311,
    text: "Usta işi bir bıçak arıyordum, aradığımı buldum. Dengesi çok iyi, elde yormuyor.",
  },
  {
    name: "Derya Kurt",
    stars: "FIVE",
    daysAgo: 397,
    photo: true,
    text: "Annem için sebze bıçağı aldım, çok memnun kaldı. İletişimleri de çok nazik.",
  },
  {
    name: "Serkan Tekin",
    stars: "FIVE",
    daysAgo: 486,
    text: "Yıllardır kullandığım çakıyı onarıma gönderdim, sapını yenileyip geri yolladılar. Teşekkürler.",
    reply: "Rica ederiz Serkan Bey, çakınız artık uzun yıllar dayanır.",
  },
]

const DAY_MS = 24 * 60 * 60 * 1000

/** A stable id from a few words, in the shape Google's review ids take. */
const idOf = (seed: string): string =>
  `AbFvOq${Buffer.from(seed)
    .toString("base64url")
    .replace(/[^A-Za-z0-9]/g, "")}`.slice(0, 48)

/** A protobuf length-delimited field (short values only: one-byte lengths). */
const field = (tag: number, bytes: Buffer): Buffer =>
  Buffer.concat([Buffer.from([(tag << 3) | 2, bytes.length]), bytes])

/**
 * A stable Maps id for a review, in the shape Google Maps gives it
 * (`Ci9DQUlRQUNv…EAE`): base64url of `{1: inner, 2: 1}`, where `inner` is
 * base64url of `{1: 2, 2: 0, 5: {1: "rp_h:<22 characters>"}}`.
 */
export function mapsReviewIdOf(seed: string): string {
  const key = createHash("sha256").update(seed).digest("base64url").slice(0, 22)
  const inner = Buffer.concat([
    Buffer.from([0x08, 0x02, 0x10, 0x00]),
    field(5, field(1, Buffer.from(`rp_h:${key}`))),
  ]).toString("base64url")
  return Buffer.concat([field(1, Buffer.from(inner)), Buffer.from([0x10, 0x01])]).toString(
    "base64url"
  )
}

export interface FakeBusinessProfileData {
  accounts: FakeBusinessAccount[]
  /** Each account's locations, by the account's name. */
  locations: Map<string, FakeBusinessLocation[]>
  /** Each location's reviews, newest change first, by the location's name. */
  reviews: Map<string, FakeBusinessReview[]>
}

/**
 * The workshop's account, location and reviews. `title` and `city` name
 * the place; `photoBase` is where the reviewers' photos are served.
 */
export function businessProfileData(options: {
  title?: string
  city?: string
  district?: string
  photoBase: string
  now?: Date
}): FakeBusinessProfileData {
  const now = (options.now ?? new Date()).getTime()
  const account = "accounts/108472635091283746512"
  const location = "locations/3172645509817263548"
  const placeId = "ChIJ7cv00DwsDogRAMDACa2m4K8"
  const reviews = WRITTEN.map((each): FakeBusinessReview => {
    const written = new Date(now - each.daysAgo * DAY_MS - 3 * 60 * 60 * 1000)
    const id = idOf(`${each.name}:${String(each.daysAgo)}`)
    return {
      reviewId: id,
      reviewer: {
        displayName: each.name,
        ...(each.photo && !each.anonymous
          ? { profilePhotoUrl: `${options.photoBase}/a/${id.slice(6, 18)}=s120-c-rp-mo-br100` }
          : {}),
        isAnonymous: each.anonymous === true,
      },
      starRating: each.stars,
      ...(each.text ? { comment: each.text } : {}),
      createTime: written.toISOString(),
      updateTime: written.toISOString(),
      reviewReplyUrl: `https://business.google.com/n/${location.slice("locations/".length)}/reviews/${mapsReviewIdOf(id)}`,
      ...(each.reply
        ? {
            reviewReply: {
              comment: each.reply,
              updateTime: new Date(written.getTime() + 20 * 60 * 60 * 1000).toISOString(),
            },
          }
        : {}),
    }
  })
  return {
    accounts: [
      {
        name: account,
        accountName: options.title ?? "Bıçak Atölyesi",
        type: "PERSONAL",
        role: "PRIMARY_OWNER",
        verificationState: "VERIFIED",
      },
    ],
    locations: new Map([
      [
        account,
        [
          {
            name: location,
            title: options.title ?? "Bıçak Atölyesi",
            storefrontAddress: {
              addressLines: ["Saraylar Mah. Cumhuriyet Cad. No:12"],
              locality: options.district ?? "Merkezefendi",
              administrativeArea: options.city ?? "Denizli",
              postalCode: "20010",
              regionCode: "TR",
            },
            metadata: {
              placeId,
              mapsUri: "https://maps.google.com/maps?cid=12673514229871092736",
              newReviewUri: `https://search.google.com/local/writereview?placeid=${placeId}`,
            },
          },
        ],
      ],
    ]),
    reviews: new Map([[location, reviews]]),
  }
}

import { classifyLanding } from "../traffic"

describe("classifyLanding (F11.2)", () => {
  it.each([
    ["a Google search", { referrer_host: "www.google.com.tr" }, "organic_search"],
    ["a Google Ads click", { gclid: true, referrer_host: "www.google.com" }, "paid_search"],
    ["a cpc campaign", { utm_source: "google", utm_medium: "cpc" }, "paid_search"],
    ["a paid Instagram campaign", { utm_source: "instagram", utm_medium: "cpc" }, "paid_social"],
    ["a Meta click", { fbclid: true }, "social"],
    ["an Instagram link", { referrer_host: "l.instagram.com" }, "social"],
    ["a newsletter", { utm_source: "bulten", utm_medium: "email" }, "email"],
    ["a blog's link", { referrer_host: "blog.example.org" }, "referral"],
    ["the shop's own page", { referrer_host: "www.magaza.example.com" }, "direct"],
    ["nothing at all", {}, "direct"],
  ])("classes %s", (_label, landing, expected) => {
    expect(classifyLanding(landing, "magaza.example.com")).toBe(expected)
  })
})

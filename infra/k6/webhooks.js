// A burst of PayTR notifications (F15.3, docs/05): a thousand a minute, as
// a provider sends after an outage. Read-mostly: no order changes.
//
//   k6 run -e BASE_URL=http://localhost:9000 infra/k6/webhooks.js
//   k6 run -e PAYTR_MERCHANT_KEY=... -e PAYTR_MERCHANT_SALT=... infra/k6/webhooks.js
//
// Without the shop's PayTR key and salt every notification carries a hash
// that does not match: the route's refusing path (400). With them they are
// signed for references that are not the shop's, so the signature check,
// the order lookup and the workflow all run (404 "unknown order"). The
// key and salt are secrets: pass them in the environment, never in a file.
// Many notifications from one address: the backend runs with LOAD_TEST=on.
// Target (docs/05): an answer within 300 ms at p95, and never a 5xx.
import http from "k6/http"
import crypto from "k6/crypto"
import { check } from "k6"

const BASE = __ENV.BASE_URL || "http://localhost:9000"
const KEY = __ENV.PAYTR_MERCHANT_KEY || ""
const SALT = __ENV.PAYTR_MERCHANT_SALT || ""
const signed = KEY !== "" && SALT !== ""

export const options = {
  scenarios: {
    burst: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV.PER_MINUTE || 1000),
      timeUnit: "1m",
      duration: __ENV.HOLD || "2m",
      preAllocatedVUs: 20,
      maxVUs: 100,
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<300"],
    // Refused notifications are the expected answer here, not failures
    checks: ["rate>0.999"],
  },
}

export default function () {
  const fields = {
    merchant_oid: `YUK${__VU}X${__ITER}X${Date.now()}`,
    status: "success",
    total_amount: "10000",
  }
  // PayTR's notification hash: HMAC-SHA256 over oid, salt, status and amount, base64
  const hash = signed
    ? crypto.hmac(
        "sha256",
        KEY,
        fields.merchant_oid + SALT + fields.status + fields.total_amount,
        "base64"
      )
    : "eWFubGlzLWltemE="
  const answer = http.post(
    `${BASE}/hooks/paytr`,
    { ...fields, hash },
    // The refusal each notification is meant to get is not a failed request
    { responseCallback: http.expectedStatuses(signed ? 404 : 400) }
  )
  check(answer, {
    "answered without a server error": (r) => r.status < 500,
    "answered as expected": (r) => r.status === (signed ? 404 : 400),
  })
}

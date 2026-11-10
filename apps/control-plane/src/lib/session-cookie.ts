/**
 * The staff session cookie's name (adr/0061 Ek C6). Not Medusa's default
 * `connect.sid`: a browser keeps cookies per host, not per port, so on one
 * machine the shop's panel (localhost:5173, backend :9000) and this one
 * (localhost:5174, control plane :9100) would each overwrite the other's
 * session at every sign-in. Its own name keeps both open side by side; once
 * deployed the two live on different hosts anyway.
 */
export const SESSION_COOKIE = "qt_cp.sid"

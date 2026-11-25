/**
 * A port for a fake that has to be named before it listens (an address the
 * app reads from the environment when it starts, before any hook).
 *
 * Taken below Linux's ephemeral range (32768 and up): the test runner's own
 * servers and every outgoing connection are given theirs from that range,
 * so a random port in it now and then is already taken (EADDRINUSE on dev,
 * 2026-11-25). Nothing on a CI runner listens between 20000 and 31999.
 */
export const namedPort = (): number => 20_000 + Math.floor(Math.random() * 12_000)

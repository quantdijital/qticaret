/**
 * The locking module's config (adr/0020). With a Redis, locks hold across
 * processes and replicas: the stock reservation at checkout and our own
 * workflow locks (`acquireLockStep`) stay exclusive when more than one
 * server runs. Without one Medusa keeps locks in process memory, which is
 * right for a single dev or test process only; the env schema requires a
 * Redis once deployed. Keys carry the tenant's namespace: tenants may share
 * a Redis.
 */
export function lockingModules(redisUrl: string | undefined, namespace: string) {
  if (!redisUrl) {
    return []
  }
  return [
    {
      resolve: "@medusajs/medusa/locking",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/locking-redis",
            id: "locking-redis",
            is_default: true,
            options: { redisUrl, namespace: `qt:lock:${namespace}:` },
          },
        ],
      },
    },
  ]
}

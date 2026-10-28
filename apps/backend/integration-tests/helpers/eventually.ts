/** Reads until `done` holds, for what a subscriber does after the request answers (3 s at most). */
export async function eventually<T>(
  look: () => Promise<T>,
  done: (value: T) => boolean,
  attempts = 30
): Promise<T> {
  let value = await look()
  for (let attempt = 0; attempt < attempts && !done(value); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    value = await look()
  }
  return value
}

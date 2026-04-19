const cache = new Map<string, unknown>();

export function getCachedPosition(key: string) {
  return cache.get(key);
}

export function setCachedPosition(key: string, value: unknown) {
  cache.set(key, value);
}

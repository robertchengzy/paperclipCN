/** Resolve connection defaults only when the caller did not set a timeout. */
export function connectionToolTimeoutMs(
  config: Record<string, unknown>,
  fallbackMs: number,
  useDefault: boolean,
): number {
  const value = config.defaultTimeoutMs;
  return useDefault && typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 60_000
    ? value
    : fallbackMs;
}

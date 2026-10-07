// Comparing a book's `updatedAt` with the one a client read (plans/deployment.md D25). The
// database returns microseconds and an offset ("…12.345678+00:00"), a browser store
// milliseconds and "Z", so the text isn't compared.

/** Whether two times are the same instant to the microsecond; two missing times match. */
export function sameInstant(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  const micros = (time: string) => {
    const fraction = /\.(\d+)/.exec(time)?.[1] ?? "";
    return Date.parse(time) * 1000 + Number(fraction.padEnd(6, "0").slice(3, 6));
  };
  const [x, y] = [micros(a), micros(b)];
  return Number.isFinite(x) && x === y;
}

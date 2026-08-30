export function resolveInspectorRow<T extends { slug: string }>(
  rows: readonly T[],
  selectedSlug: string | null,
): T | null {
  if (rows.length === 0) return null;
  return rows.find((row) => row.slug === selectedSlug) ?? rows[0] ?? null;
}

export function toggleExpandedRegistryRow(
  expandedSlug: string | null,
  clickedSlug: string,
): string | null {
  return expandedSlug === clickedSlug ? null : clickedSlug;
}

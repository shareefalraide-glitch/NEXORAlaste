// Case-insensitive text matching across the string fields in a demo record.
export function matchesRecord(row, query) {
  return (
    !query.trim() ||
    Object.values(row).some(
      value =>
        typeof value === 'string' && value.toLowerCase().includes(query.trim().toLowerCase()),
    )
  );
}

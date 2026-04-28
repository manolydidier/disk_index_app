export function normalizeDiskRootPath(input: string) {
  let value = input.trim();

  if (!value) return value;

  value = value.replace(/\//g, '\\');

  // Corrige ":F\" -> "F:\"
  value = value.replace(/^:([a-zA-Z])\\?$/, '$1:\\');

  // Corrige "F" -> "F:\"
  if (/^[a-zA-Z]$/.test(value)) {
    return `${value.toUpperCase()}:\\`;
  }

  // Corrige "F:" -> "F:\"
  if (/^[a-zA-Z]:$/.test(value)) {
    return `${value.toUpperCase()}\\`;
  }

  // Corrige "F\" -> "F:\"
  if (/^[a-zA-Z]\\$/.test(value)) {
    return `${value[0].toUpperCase()}:\\`;
  }

  // Corrige "f:\" -> "F:\"
  if (/^[a-zA-Z]:\\/.test(value)) {
    return `${value[0].toUpperCase()}${value.slice(1)}`;
  }

  return value;
}
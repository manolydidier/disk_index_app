export function normalizeDiskRootPath(input: string) {
  let value = input.trim();

  if (!value) return value;

  value = value.replace(/\//g, '\\');

  // ":F\" -> "F:\"
  value = value.replace(/^:([a-zA-Z])\\?$/, '$1:\\');

  // "F" -> "F:\"
  if (/^[a-zA-Z]$/.test(value)) {
    return `${value.toUpperCase()}:\\`;
  }

  // "F:" -> "F:\"
  if (/^[a-zA-Z]:$/.test(value)) {
    return `${value.toUpperCase()}\\`;
  }

  // "F\" -> "F:\"
  if (/^[a-zA-Z]\\$/.test(value)) {
    return `${value[0].toUpperCase()}:\\`;
  }

  // "f:\" -> "F:\"
  if (/^[a-zA-Z]:\\/.test(value)) {
    return `${value[0].toUpperCase()}${value.slice(1)}`;
  }

  return value;
}

export function isWindowsDriveRootPath(value: string) {
  return /^[A-Z]:\\$/i.test(value.trim());
}
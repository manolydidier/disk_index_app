function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';

  const text = String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((row) =>
    row.map(escapeCsvCell).join(',')
  );

  // BOM so Excel opens UTF-8 (accents, etc.) correctly instead of mangling it.
  return '﻿' + lines.join('\r\n') + '\r\n';
}

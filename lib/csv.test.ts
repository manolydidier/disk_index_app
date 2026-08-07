import { describe, expect, it } from 'vitest';
import { buildCsv } from './csv';

describe('buildCsv', () => {
  it('joins headers and rows with CRLF and a leading BOM', () => {
    const csv = buildCsv(['Nom', 'Taille'], [['fichier.txt', 42]]);

    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('Nom,Taille\r\n');
    expect(csv).toContain('fichier.txt,42\r\n');
  });

  it('quotes and escapes cells containing commas, quotes or newlines', () => {
    const csv = buildCsv(['Nom'], [['a, "quoted", b\nc']]);

    expect(csv).toContain('"a, ""quoted"", b\nc"');
  });

  it('renders null and undefined cells as empty strings', () => {
    const csv = buildCsv(['A', 'B'], [[null, undefined]]);

    expect(csv).toContain('A,B\r\n,\r\n');
  });
});

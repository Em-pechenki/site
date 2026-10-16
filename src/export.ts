// Выгрузка бизнес-данных: CSV/JSON + печать. Только там, где бизнес-действие:
// Заказы, Сводка-отчёт, результат сценария задержки, журнал операций.

export function downloadFile(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 500);
}

function esc(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** rows — массив объектов с одинаковыми ключами; первая строка — заголовки. */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '﻿пусто\n';
  const heads = Object.keys(rows[0]);
  const lines = [heads.map(esc).join(';')];
  for (const r of rows) lines.push(heads.map((h) => esc(r[h])).join(';'));
  return '﻿' + lines.join('\n') + '\n';
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  downloadFile(filename, toCsv(rows), 'text/csv;charset=utf-8');
}

export function downloadJson(filename: string, data: unknown) {
  downloadFile(filename, JSON.stringify(data, null, 2), 'application/json;charset=utf-8');
}

export function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

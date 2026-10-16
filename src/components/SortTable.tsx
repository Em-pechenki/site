import { useMemo, useState } from 'react';
import { useLang } from '../i18n';

export type SortDir = 1 | -1;
export type SortVal = string | number | null | undefined;
export type Accessors<T> = Record<string, (r: T) => SortVal>;

/** Сравнение значений: числа — численно, остальное — localeCompare; пустые всегда в конце. */
export function cmpVals(a: SortVal, b: SortVal, lang: 'ru' | 'en'): number {
  const an = a === null || a === undefined || a === '';
  const bn = b === null || b === undefined || b === '';
  if (an && bn) return 0;
  if (an) return 1;
  if (bn) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), lang === 'en' ? 'en' : 'ru', { numeric: true });
}

/**
 * Сортируемые строки таблицы. Возвращает отсортированную копию, активный
 * ключ, направление и переключатель. Выгрузки (CSV/JSON) стройте от
 * `sorted` — тогда файл повторит порядок на экране.
 */
export function useSorted<T>(rows: T[], acc: Accessors<T>, initialKey: string, initialDir: SortDir = 1) {
  const lang = useLang();
  const [skey, setSkey] = useState(initialKey);
  const [dir, setDir] = useState<SortDir>(initialDir);
  const sorted = useMemo(() => {
    const fn = acc[skey];
    if (!fn) return [...rows];
    return [...rows].sort((x, y) => cmpVals(fn(x), fn(y), lang) * dir);
  }, [rows, acc, skey, dir, lang]);
  function toggle(k: string) {
    if (k === skey) setDir((d) => (d === 1 ? -1 : 1));
    else {
      setSkey(k);
      setDir(1);
    }
  }
  return { sorted, skey, dir, toggle };
}

/** Заголовок колонки со стрелкой сортировки. */
export function SortTh({ label, k, skey, dir, onSort, title }: {
  label: string; k: string; skey: string; dir: SortDir; onSort: (k: string) => void; title: string;
}) {
  const active = skey === k;
  return (
    <th
      className={active ? 'th-sort active' : 'th-sort'}
      onClick={() => onSort(k)}
      title={title}
      aria-sort={active ? (dir === 1 ? 'ascending' : 'descending') : undefined}
    >
      {label}{active ? (dir === 1 ? ' ▲' : ' ▼') : ''}
    </th>
  );
}

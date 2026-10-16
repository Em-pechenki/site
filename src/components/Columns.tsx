import { useState } from 'react';
import { useT } from '../i18n';
import type { SortDir } from './SortTable';

/**
 * Видимость колонок + честная выгрузка.
 *
 * Галочка живёт прямо в заголовке колонки (включена по умолчанию).
 * Снятая галочка: колонка сереет на экране (класс col-off) и
 * выкидывается из CSV/JSON через visibleRows().
 *
 * hidden — множество КЛЮЧЕЙ СОРТИРОВКИ (тех же, что у SortTh/ColTh).
 * colMap переводит ключ сортировки в ключ(и) итоговой строки выгрузки.
 */
export function useColumns() {
  const [hidden, setHidden] = useState<string[]>([]);
  const hiddenSet = new Set(hidden);
  function isOff(k: string) {
    return hiddenSet.has(k);
  }
  function toggleCol(k: string) {
    setHidden((h) => (h.includes(k) ? h.filter((x) => x !== k) : [...h, k]));
  }
  return { hidden: hiddenSet, isOff, toggleCol };
}

/** Сортируемый заголовок с галочкой видимости колонки. */
export function ColTh({ label, k, skey, dir, onSort, title, checked, onToggle }: {
  label: string; k: string; skey: string; dir: SortDir; onSort: (k: string) => void; title: string;
  checked: boolean; onToggle: (k: string) => void;
}) {
  const t = useT();
  const active = skey === k;
  return (
    <th
      className={(active ? 'th-sort active' : 'th-sort') + (checked ? '' : ' col-off')}
      onClick={() => onSort(k)}
      title={title}
      aria-sort={active ? (dir === 1 ? 'ascending' : 'descending') : undefined}
    >
      <input
        type="checkbox"
        className="col-check"
        checked={checked}
        title={t('col_check_title')}
        aria-label={t('col_check_title') + ': ' + label}
        onClick={(e) => e.stopPropagation()}
        onChange={() => onToggle(k)}
      />
      <span className="col-label">{label}{active ? (dir === 1 ? ' ▲' : ' ▼') : ''}</span>
    </th>
  );
}

/** Оставить в строках только видимые колонки. colMap: ключ сортировки -> ключ(и) строки выгрузки. */
export function visibleRows(
  rows: Record<string, unknown>[],
  hidden: Set<string>,
  colMap: Record<string, string | string[]>,
): Record<string, unknown>[] {
  if (!hidden.size) return rows;
  const drop = new Set<string>();
  hidden.forEach((k) => {
    const m = colMap[k];
    if (!m) return;
    (Array.isArray(m) ? m : [m]).forEach((h) => drop.add(h));
  });
  if (!drop.size) return rows;
  return rows.map((r) => {
    const o: Record<string, unknown> = {};
    for (const key of Object.keys(r)) {
      if (!drop.has(key)) o[key] = r[key];
    }
    return o;
  });
}

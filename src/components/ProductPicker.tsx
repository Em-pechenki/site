import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n';

export interface ProductOpt {
  sku: string;
  name: string;
  description?: string;
  aliases?: string[];
}

/** Каталог из snapshot.products + гарантированные air/air plus. Ищется по всему: SKU, название, описание, алиасы. */
export function useCatalog(snapshot: any): ProductOpt[] {
  const t = useT();
  return useMemo(() => {
    const out: ProductOpt[] = [];
    const seen = new Set<string>();
    const push = (sku: string, name: string, desc: string, aliases: string[]) => {
      if (!sku || seen.has(sku)) return;
      seen.add(sku);
      out.push({ sku, name, description: desc, aliases });
    };
    for (const p of snapshot?.products || []) {
      const sku: string = p.sku;
      const known =
        sku === 'FG-AIR' ? { n: 'air', d: t('o_air_desc') }
        : sku === 'FG-PLUS' ? { n: 'air plus', d: t('o_plus_desc') }
        : null;
      const nm = known?.n || p.name || sku;
      push(sku, nm, known?.d || p.description || '', [...(p.aliases || []), sku.toLowerCase(), nm.toLowerCase()]);
    }
    if (!seen.has('FG-AIR')) push('FG-AIR', 'air', t('o_air_desc'), ['air', 'fg-air']);
    if (!seen.has('FG-PLUS')) push('FG-PLUS', 'air plus', t('o_plus_desc'), ['air plus', 'plus', 'fg-plus']);
    return out;
  }, [snapshot, t]);
}

function matches(p: ProductOpt, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const hay = [p.sku, p.name, p.description || '', ...(p.aliases || [])].join(' ').toLowerCase();
  return s.split(/\s+/).every((tok) => hay.includes(tok));
}

/**
 * Товар-комбобокс: можно ввести название/SKU/характеристику вручную и взять
 * из совпадений, а можно просто раскрыть и выбрать из списка.
 * Наружу отдаёт только валидный sku (или 'all' в режиме фильтра).
 */
export default function ProductPicker({ products, value, onChange, allowAll = false, placeholder }: {
  products: ProductOpt[];
  value: string;
  onChange: (sku: string) => void;
  allowAll?: boolean;
  placeholder?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const allOpt: ProductOpt = useMemo(
    () => ({ sku: 'all', name: t('o_all'), description: '', aliases: ['all', 'все'] }),
    [t],
  );

  const opts = useMemo(() => {
    const base = allowAll ? [allOpt, ...products] : products;
    return base.filter((p) => matches(p, q));
  }, [products, allowAll, allOpt, q]);

  useEffect(() => {
    setHi(0);
  }, [q, open]);

  const selected = value === 'all' && allowAll ? allOpt : products.find((p) => p.sku === value);
  const shown = open ? q : selected ? (selected.sku === 'all' ? selected.name : `${selected.name} · ${selected.sku}`) : '';

  function pick(sku: string) {
    onChange(sku);
    setQ('');
    setOpen(false);
  }

  function revert() {
    setQ('');
    setOpen(false);
  }

  function onBlur() {
    // Единственное совпадение — считаем выбором, иначе откат к текущему.
    if (open) {
      if (q.trim() && opts.length === 1) pick(opts[0].sku);
      else revert();
    }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setHi((h) => (opts.length ? (h + (e.key === 'ArrowDown' ? 1 : opts.length - 1)) % opts.length : 0));
    } else if (e.key === 'Enter') {
      if (open && opts[hi]) {
        e.preventDefault();
        pick(opts[hi].sku);
      }
    } else if (e.key === 'Escape') {
      revert();
      inputRef.current?.blur();
    }
  }

  return (
    <div className="pp">
      <input
        ref={inputRef}
        className="pp-input"
        value={shown}
        placeholder={placeholder || t('pp_ph')}
        onFocus={() => {
          setQ('');
          setOpen(true);
        }}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onBlur={onBlur}
        onKeyDown={onKey}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
      />
      {open && (
        <div className="pp-list" role="listbox">
          {opts.map((p, i) => (
            <button
              key={p.sku}
              type="button"
              className={i === hi ? 'pp-opt hi' : 'pp-opt'}
              role="option"
              aria-selected={value === p.sku}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(p.sku);
              }}
              onMouseEnter={() => setHi(i)}
            >
              <b>{p.sku === 'all' ? p.name : `${p.name} (${p.sku})`}</b>
              {!!p.description && <span>{p.description}</span>}
            </button>
          ))}
          {opts.length === 0 && <div className="pp-empty">{t('pp_no_match')}</div>}
        </div>
      )}
    </div>
  );
}

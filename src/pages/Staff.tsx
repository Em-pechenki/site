import { useEffect, useMemo, useState } from 'react';
import { employees as fetchStaff } from '../api';
import { fmtDate } from '../format';
import { useT, useLang } from '../i18n';
import { useSorted, type Accessors } from '../components/SortTable';
import { ColTh, useColumns, visibleRows } from '../components/Columns';
import { downloadCsv, downloadJson, stamp } from '../export';

const DAYS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const DAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Короткий график: подряд идущие дни с одинаковыми часами склеиваем в диапазон. */
export function shortSchedule(schedule: Record<string, [string, string]>, lang: string): string {
  const days = lang === 'en' ? DAYS_EN : DAYS_RU;
  const parts: string[] = [];
  let i = 1;
  while (i <= 7) {
    const h = schedule[String(i)];
    if (!h) { i++; continue; }
    let j = i;
    while (j + 1 <= 7) {
      const nj = schedule[String(j + 1)];
      if (nj && nj[0] === h[0] && nj[1] === h[1]) j++;
      else break;
    }
    const range = j > i ? `${days[i - 1]}–${days[j - 1]}` : days[i - 1];
    parts.push(`${range} ${h[0]}–${h[1]}`);
    i = j + 1;
  }
  return parts.join(', ') || '—';
}

export default function Staff({ snapshot }: { snapshot: any }) {
  const t = useT();
  const lang = useLang();
  const [list, setList] = useState<any[]>([]);
  const [now, setNow] = useState<string>('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const cols = useColumns();

  async function load() {
    try {
      const r = await fetchStaff();
      setList(r.employees || []);
      setNow(r.now || snapshot?.now || '');
    } catch {
      setList([]);
    }
  }
  useEffect(() => { load(); }, []);

  const roleName = (r: string) => t(`role_${r}` as any) || r;
  const q = query.trim().toLowerCase();
  const filtered = list.filter((e: any) => {
    if (statusFilter === 'on' && !e.on_shift) return false;
    if (statusFilter === 'off' && e.on_shift) return false;
    if (!q) return true;
    const hay = `${e.id} ${e.name} ${roleName(e.role)}`.toLowerCase();
    return q.split(/\s+/).every((tok) => hay.includes(tok));
  });

  const acc: Accessors<any> = useMemo(() => ({
    name: (e) => e.name,
    role: (e) => roleName(e.role),
    schedule: (e) => Object.keys(e.schedule || {}).sort().join(','),
    status: (e) => (e.on_shift ? 1 : 0),
    active: (e) => e.active,
    done: (e) => e.done,
  }), [lang]);
  const { sorted, skey, dir, toggle } = useSorted(filtered, acc, 'name');
  const onNow = list.filter((e: any) => e.on_shift).length;

  function exportCsv() {
    const H = { emp: t('st_th_emp'), role: t('st_th_role'), sch: t('st_th_schedule'), st: t('st_th_status'), act: t('st_th_active'), done: t('st_th_done') };
    downloadCsv(`${lang === 'en' ? 'staff' : 'sotrudniki'}_${stamp()}.csv`,
      visibleRows(sorted.map((e: any) => ({
        [H.emp]: `${e.name} (${e.id})`,
        [H.role]: roleName(e.role),
        [H.sch]: shortSchedule(e.schedule || {}, lang),
        [H.st]: e.on_shift ? t('st_on') : t('st_off'),
        [H.act]: e.active,
        [H.done]: e.done,
      })), cols.hidden, { name: H.emp, role: H.role, schedule: H.sch, status: H.st, active: H.act, done: H.done }));
  }

  function exportJson() {
    downloadJson(`${lang === 'en' ? 'staff' : 'sotrudniki'}_${stamp()}.json`, sorted);
  }

  if (!snapshot) return <div className="card">{t('loading')}</div>;

  return (
    <div>
      <div className="toolbar">
        <label style={{ flex: '1 1 280px', minWidth: 220 }}>{t('f_search')}
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('f_search_ph')} style={{ flex: 1, width: '100%', minWidth: 220 }} />
        </label>
      </div>
      <div className="card">
        <div className="card-head-row">
          <div className="sp">
            <h3><span className="n">01</span> {t('st_h', { n: list.length })}</h3>
            <div className="muted">{t('st_lead')}{now ? ` · ${fmtDate(now)}` : ''}</div>
          </div>
          <span className="badge badge-green">{t('st_on_now', { n: onNow })}</span>
        </div>
        <div className="toolbar" style={{ marginTop: 12 }}>
          <label>{t('o_state')}
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">{t('st_filter_all')}</option>
              <option value="on">{t('st_filter_on')}</option>
              <option value="off">{t('st_filter_off')}</option>
            </select>
          </label>
          <button className="ghost" onClick={exportCsv} disabled={!sorted.length} title={t('o_csv_title')}>{t('o_csv')}</button>
          <button className="ghost" onClick={exportJson} disabled={!sorted.length}>{t('b_json')}</button>
        </div>
        <div className="tbl-wrap">
          <table className="tbl tbl-compact">
            <thead><tr>
              <ColTh label={t('st_th_emp')} k="name" skey={skey} dir={dir} onSort={toggle} title={t('sort_title')} checked={!cols.isOff('name')} onToggle={cols.toggleCol} />
              <ColTh label={t('st_th_role')} k="role" skey={skey} dir={dir} onSort={toggle} title={t('sort_title')} checked={!cols.isOff('role')} onToggle={cols.toggleCol} />
              <ColTh label={t('st_th_schedule')} k="schedule" skey={skey} dir={dir} onSort={toggle} title={t('sort_title')} checked={!cols.isOff('schedule')} onToggle={cols.toggleCol} />
              <ColTh label={t('st_th_status')} k="status" skey={skey} dir={dir} onSort={toggle} title={t('sort_title')} checked={!cols.isOff('status')} onToggle={cols.toggleCol} />
              <ColTh label={t('st_th_active')} k="active" skey={skey} dir={dir} onSort={toggle} title={t('sort_title')} checked={!cols.isOff('active')} onToggle={cols.toggleCol} />
              <ColTh label={t('st_th_done')} k="done" skey={skey} dir={dir} onSort={toggle} title={t('sort_title')} checked={!cols.isOff('done')} onToggle={cols.toggleCol} />
            </tr></thead>
            <tbody>
              {sorted.map((e: any) => (
                <tr key={e.id} className={e.on_shift ? '' : 'row-closed'}>
                  <td className={cols.isOff('name') ? 'col-off' : ''}><b>{e.name}</b><div className="sub">{e.id}</div></td>
                  <td className={cols.isOff('role') ? 'col-off' : ''}>{roleName(e.role)}</td>
                  <td className={cols.isOff('schedule') ? 'mono col-off' : 'mono'}>{shortSchedule(e.schedule || {}, lang)}</td>
                  <td className={cols.isOff('status') ? 'col-off' : ''}>{e.on_shift
                    ? <span className="badge badge-green">{t('st_on')}</span>
                    : <span className="badge badge-gray">{t('st_off')}</span>}</td>
                  <td className={cols.isOff('active') ? 'mono col-off' : 'mono'}>{e.active}</td>
                  <td className={cols.isOff('done') ? 'mono col-off' : 'mono'}>{e.done}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { delayScenario } from '../api';
import { fmtDate } from '../format';
import { downloadCsv, downloadJson, stamp } from '../export';
import { useT, useLang } from '../i18n';
import { useSorted, type Accessors } from '../components/SortTable';
import { ColTh, useColumns, visibleRows } from '../components/Columns';

interface ScRow {
  id: string;
  was: string | null;
  now: string | null;
  threatened: boolean;
  risk: boolean;
}

export default function Scenario({ snapshot }: { snapshot: any }) {
  const t = useT();
  const lang = useLang();
  const expected = snapshot?.shipments_expected || [];
  const [shipId, setShipId] = useState('');
  const [newDate, setNewDate] = useState('2026-11-05T10:00');
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [changeFilter, setChangeFilter] = useState('all');
  const resCols = useColumns();

  // Селект всегда указывает на реальную поставку в пути:
  // захардкоженного ID больше нет — после приёмки выбор сам
  // перескакивает на первую доступную, а не шлёт stale-ID на бэкенд.
  useEffect(() => {
    if (!expected.length) return;
    if (!expected.some((s: any) => s.shipment_id === shipId)) {
      setShipId(expected[0].shipment_id);
    }
  }, [expected, shipId]);

  async function check(sid?: string, ndt?: string) {
    const id = sid || shipId;
    if (!id) {
      setErr(t('b_no_ships'));
      return;
    }
    const local = ndt || newDate;
    setErr('');
    setBusy(true);
    try {
      const iso = local.includes('+') || local.endsWith('Z') ? local : `${local}:00+03:00`;
      const r = await delayScenario(id, iso);
      setRes(r);
    } catch (e: any) {
      setErr(e.message + (e.hint ? ' — ' + e.hint : ''));
    } finally {
      setBusy(false);
    }
  }

  function preset() {
    // Пример на живой поставке в пути (air — если есть), а не на захардкоженном ID.
    const air = expected.find((s: any) => s.sku === 'FG-AIR') || expected[0];
    if (!air) {
      setErr(t('b_no_ships'));
      return;
    }
    setShipId(air.shipment_id);
    setNewDate('2026-11-05T10:00');
    check(air.shipment_id, '2026-11-05T10:00');
  }

  const threatSet = useMemo(() => new Set<string>(res?.threatened || []), [res]);

  const merged: ScRow[] = useMemo(() => {
    if (!res) return [];
    const afterMap = new Map<string, any>((res.after || []).map((a: any) => [a.order_id, a]));
    return (res.before || []).map((b: any) => {
      const a: any = afterMap.get(b.order_id);
      return {
        id: b.order_id,
        was: b.readiness || null,
        now: a?.readiness || null,
        threatened: threatSet.has(b.order_id),
        risk: !!a?.atRisk,
      };
    });
  }, [res, threatSet]);

  const acc: Accessors<ScRow> = useMemo(() => ({
    id: (r) => r.id,
    was: (r) => r.was,
    now: (r) => r.now,
    change: (r) => (r.threatened ? 2 : r.risk ? 1 : 0),
  }), []);
  const filtered = changeFilter === 'changed'
    ? merged.filter((r) => r.threatened || r.risk)
    : changeFilter === 'unchanged'
      ? merged.filter((r) => !r.threatened && !r.risk)
      : merged;
  const { sorted, skey, dir, toggle } = useSorted(filtered, acc, 'id');

  function exportScenarioCsv() {
    if (!res) return;
    downloadCsv(`${lang === 'en' ? 'delay' : 'zaderzhka'}_${shipId}_${stamp()}.csv`, visibleRows(sorted.map((r) => ({
      order_id: r.id,
      was_ready: r.was ? fmtDate(r.was) : '—',
      now_ready: r.now ? fmtDate(r.now) : '—',
      change: r.threatened ? t('sc_threat') : t('sc_no_change'),
    })), resCols.hidden, { id: 'order_id', was: 'was_ready', now: 'now_ready', change: 'change' }));
  }

  function exportScenarioJson() {
    if (!res) return;
    downloadJson(`${lang === 'en' ? 'delay' : 'zaderzhka'}_${shipId}_${stamp()}.json`, {
      shipment_id: shipId,
      threatened: res.threatened,
      explanation: res.explanation,
      rows: sorted,
    });
  }

  return (
    <div>
      <div className="card" style={{ borderColor: 'rgba(255,94,0,0.35)' }}>
        <div className="card-head-row">
          <div className="sp">
            <h3><span className="n">01</span> {t('sc_params_h')}</h3>
            <div className="muted">{t('sc_params_lead')}</div>
          </div>
          <span className="badge badge-blue">{t('sc_trial')}</span>
        </div>
        <div className="toolbar" style={{ marginTop: 14 }}>
          <label>{t('sc_shipment')}
            <select value={shipId} onChange={(e) => setShipId(e.target.value)}>
              {expected.map((s: any) => (
                <option key={s.shipment_id} value={s.shipment_id}>{(s.sku === 'FG-AIR' ? 'air' : 'air plus')} ×{s.quantity} · {t('arrives')} {fmtDate(s.expected_at)} ({s.shipment_id})</option>
              ))}
            </select>
          </label>
          <label>{t('sc_date')}
            <input type="datetime-local" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          </label>
          <button onClick={() => check()} disabled={busy || !expected.length}>{busy ? t('sc_busy') : t('sc_check')}</button>
          <button className="ghost" onClick={preset} disabled={!expected.length}>{t('sc_preset')}</button>
        </div>
        {err && <div className="error">{err}</div>}
        {!res && !err && (
          <div className="muted">{t('sc_hint')}</div>
        )}
      </div>

      {res && (
        <div className="card">
          <h3><span className="n">02</span> {t('sc_one_h')}</h3>
          <div className="muted">{t('sc_one_lead')}</div>
          <div className="toolbar" style={{ marginTop: 12 }}>
            <label>{t('o_state')}
              <select value={changeFilter} onChange={(e) => setChangeFilter(e.target.value)}>
                <option value="all">{t('sc_filter_all')}</option>
                <option value="changed">{t('sc_filter_changed')}</option>
                <option value="unchanged">{t('sc_filter_unchanged')}</option>
              </select>
            </label>
            <button className="ghost" onClick={exportScenarioCsv} title={t('sc_csv_title')}>{t('o_csv')}</button>
            <button className="ghost" onClick={exportScenarioJson} title={t('sc_json_title')}>{t('b_json')}</button>
          </div>
          <div className="tbl-wrap">
            <table className="tbl tbl-fit">
              <thead><tr>
                <ColTh label={t('sc_th_order')} k="id" skey={skey} dir={dir} onSort={toggle} title={t('sort_title')} checked={!resCols.isOff('id')} onToggle={resCols.toggleCol} />
                <ColTh label={t('sc_th_was')} k="was" skey={skey} dir={dir} onSort={toggle} title={t('sort_title')} checked={!resCols.isOff('was')} onToggle={resCols.toggleCol} />
                <ColTh label={t('sc_th_now')} k="now" skey={skey} dir={dir} onSort={toggle} title={t('sort_title')} checked={!resCols.isOff('now')} onToggle={resCols.toggleCol} />
                <ColTh label={t('sc_th_change')} k="change" skey={skey} dir={dir} onSort={toggle} title={t('sort_title')} checked={!resCols.isOff('change')} onToggle={resCols.toggleCol} />
              </tr></thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.id} className={r.threatened ? 'row-risk' : ''}>
                    <td className={resCols.isOff('id') ? 'col-off' : ''}><b>{r.id}</b>{r.threatened && <div className="sub" style={{ color: 'var(--danger)' }}>{t('sc_threat')}</div>}</td>
                    <td className={resCols.isOff('was') ? 'mono col-off' : 'mono'}>{r.was ? fmtDate(r.was) : '—'}</td>
                    <td className={resCols.isOff('now') ? 'mono col-off' : 'mono'}>{r.now ? fmtDate(r.now) : '—'}</td>
                    <td className={resCols.isOff('change') ? 'col-off' : ''}>{r.threatened
                      ? <span className="badge badge-red">{t('sc_threat')}</span>
                      : r.risk
                        ? <span className="badge badge-red">{t('sc_risk')}</span>
                        : <span className="badge badge-green">{t('sc_no_change')}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

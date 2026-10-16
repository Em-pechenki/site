import { useEffect, useMemo, useState } from 'react';
import { prodStatus, prodPlan, prodStart, prodCancel, employees as fetchStaff } from '../api';
import { fmtDate } from '../format';
import { useT, useLang } from '../i18n';
import { useSorted, type Accessors } from '../components/SortTable';
import { ColTh, useColumns, visibleRows } from '../components/Columns';
import { downloadCsv, downloadJson, stamp } from '../export';
import ProductPicker, { useCatalog } from '../components/ProductPicker';
import { logOp } from '../opslog';

export default function Production({ snapshot }: { snapshot: any }) {
  const t = useT();
  const lang = useLang();
  const catalog = useCatalog(snapshot);
  const [status, setStatus] = useState<any>(null);
  const [sku, setSku] = useState('FG-PLUS');
  const [qty, setQty] = useState(8);
  const [start, setStart] = useState('2026-11-02T09:00');
  const [plan, setPlan] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [compFilter, setCompFilter] = useState('all');
  const [staff, setStaff] = useState<any[]>([]);
  const [runPick, setRunPick] = useState('auto');
  const compCols = useColumns();
  const shortCols = useColumns();

  useEffect(() => {
    fetchStaff().then((r) => setStaff(r.employees || [])).catch(() => setStaff([]));
  }, []);
  const onShift = staff.filter((e: any) => e.on_shift);

  const isLow = (c: any) => c.on_hand === 0 || (c.sku === 'CMP-CO2' && c.on_hand < 8);

  const shAcc: Accessors<any> = useMemo(() => ({
    comp: (r) => r.sku,
    need: (r) => r.need,
    have: (r) => r.have,
    def: (r) => r.deficit,
  }), []);
  const { sorted: sortedShort, skey: shKey, dir: shDir, toggle: shToggle } = useSorted(plan?.shortage || [], shAcc, 'comp');

  const compAcc: Accessors<any> = useMemo(() => ({
    comp: (r) => r.sku,
    name: (r) => r.name || '',
    left: (r) => r.on_hand,
    state: (r) => (r.on_hand === 0 || (r.sku === 'CMP-CO2' && r.on_hand < 8) ? 1 : 0),
  }), []);
  const compBase = (status?.component_stock || []).filter((c: any) => compFilter === 'short' ? isLow(c) : compFilter === 'ok' ? !isLow(c) : true);
  const { sorted: sortedComp, skey: cpKey, dir: cpDir, toggle: cpToggle } = useSorted(compBase, compAcc, 'comp');

  function compHeads() {
    return { comp: t('p_th_comp'), left: t('b_leftover'), state: t('o_th_state') };
  }

  function exportCompCsv() {
    const H = compHeads();
    downloadCsv(`${lang === 'en' ? 'components' : 'komponenty'}_${stamp()}.csv`,
      visibleRows(sortedComp.map((c: any) => ({
        [H.comp]: `${c.sku}${c.name ? ` · ${c.name}` : ''}`,
        [H.left]: c.on_hand,
        [H.state]: isLow(c) ? t('p_shortage') : t('sc_ok'),
      })), compCols.hidden, { comp: H.comp, name: H.comp, left: H.left, state: H.state }));
  }

  function exportCompJson() {
    downloadJson(`${lang === 'en' ? 'components' : 'komponenty'}_${stamp()}.json`, sortedComp);
  }

  function exportShortCsv() {
    const H = { comp: t('p_th_comp'), need: t('p_th_need'), have: t('p_th_have'), def: t('p_th_def') };
    downloadCsv(`${lang === 'en' ? 'shortage' : 'deficit'}_${stamp()}.csv`,
      visibleRows((plan?.shortage || []).map((s: any) => ({
        [H.comp]: s.sku, [H.need]: s.need, [H.have]: s.have, [H.def]: s.deficit,
      })), shortCols.hidden, { comp: H.comp, need: H.need, have: H.have, def: H.def }));
  }

  function exportShortJson() {
    downloadJson(`${lang === 'en' ? 'shortage' : 'deficit'}_${stamp()}.json`, plan?.shortage || []);
  }

  async function load() {
    try { setStatus(await prodStatus()); }
    catch (e: any) { setMsg(t('p_status_err') + e.message); }
  }
  useEffect(() => { load(); }, []);

  async function doPlan() {
    setMsg('');
    setBusy(true);
    try {
      const sf = start.includes('+') || start.endsWith('Z') ? start : `${start}:00+03:00`;
      const r = await prodPlan(sku, Number(qty), sf);
      setPlan(r);
    } catch (e: any) {
      setMsg(t('o_err') + `${e.message}${e.hint ? ' — ' + e.hint : ''}`);
    } finally {
      setBusy(false);
    }
  }

  async function doStart() {
    setMsg('');
    try {
      const performer = !runPick || runPick === 'auto' ? { auto: true } : { employee_id: runPick };
      const r: any = await prodStart(sku, Number(qty), performer);
      setPlan(r);
      const who = r?.performer ? ` · ${r.performer}` : '';
      logOp({ action: 'start_batch', sku, qty: Number(qty), note: `${t('p_run')}${who}` });
      setMsg(t('p_started') + who);
      load();
    } catch (e: any) {
      setMsg(t('o_err') + `${e.message}${e.hint ? ' — ' + e.hint : ''}`);
    }
  }

  async function doCancel() {
    setMsg('');
    try {
      const r: any = await prodCancel();
      const b = r?.cancelled || status?.active_batch;
      logOp({ action: 'cancel_batch', sku: b?.finished_sku, qty: b?.batch_qty, note: t('log_cancel_batch_note') });
      setPlan(null);
      setMsg(t('p_canceled'));
      load();
    } catch (e: any) {
      setMsg(t('o_err') + `${e.message}${e.hint ? ' — ' + e.hint : ''}`);
    }
  }

  // «2 дн 4 ч 10 мин» из миллисекунд
  function dur(ms: number) {
    const m = Math.max(0, Math.round(ms / 60000));
    const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
    const parts: string[] = [];
    if (d) parts.push(`${d} ${t('p_dur_d')}`);
    if (h) parts.push(`${h} ${t('p_dur_h')}`);
    if (mm || !parts.length) parts.push(`${mm} ${t('p_dur_m')}`);
    return parts.join(' ');
  }

  function Gantt({ timeline, qty, skuLabel, readyIso }: { timeline: any[]; qty: number; skuLabel: string; readyIso?: string }) {
    if (!timeline?.length) return <div className="muted">{t('p_no_chart')}</div>;
    const t0 = new Date('2026-11-02T09:00:00+03:00').getTime();
    const t1 = new Date('2026-11-06T17:00:00+03:00').getTime();
    const span = t1 - t0;
    const pos = (iso: string) => Math.max(0, Math.min(100, ((new Date(iso).getTime() - t0) / span) * 100));
    const width = (a: string, b: string) => `${Math.max(0.5, ((new Date(b).getTime() - new Date(a).getTime()) / span) * 100)}%`;
    // Дни горизонта по МСК: ширина колонки = доля суток в горизонте,
    // границы колонок и вертикальная сетка совпадают по построению
    const MSK = 3 * 3600 * 1000;
    const mskMidnight = (ms: number) => { const d = new Date(ms + MSK); d.setUTCHours(0, 0, 0, 0); return d.getTime() - MSK; };
    const dayFmt = (ms: number) => new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit' }).format(new Date(ms));
    const hmFmt = (ms: number) => new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' }).format(new Date(ms));
    const days: { ms: number; hours: number; segStart: number; segEnd: number }[] = [];
    for (let d = mskMidnight(t0); d < t1; d += 86400000) {
      const segStart = Math.max(d, t0), segEnd = Math.min(d + 86400000, t1);
      if (segEnd > segStart) days.push({ ms: d, hours: (segEnd - segStart) / 3600000, segStart, segEnd });
    }
    const totH = days.reduce((s, x) => s + x.hours, 0) || 1;
    let acc = 0;
    const bounds = days.slice(0, -1).map((d) => { acc += d.hours; return (acc / totH) * 100; });
    const firstSub = days.length && days[0].segStart > days[0].ms ? ` · ${t('p_from')} ${hmFmt(days[0].segStart)}` : '';
    const lastSub = days.length && days[days.length - 1].segEnd < days[days.length - 1].ms + 86400000
      ? ` · ${t('p_to')} ${hmFmt(days[days.length - 1].segEnd)}` : '';
    const first = timeline[0];
    const finishIso = readyIso || timeline[timeline.length - 1].test_end;
    const totalMs = new Date(finishIso).getTime() - new Date(first.assembly_start).getTime();
    // Длительности операций первой штуки — для легенды
    const asmMin = Math.round((new Date(first.assembly_end).getTime() - new Date(first.assembly_start).getTime()) / 60000);
    const tstMin = Math.round((new Date(first.test_end).getTime() - new Date(first.test_start).getTime()) / 60000);
    const dayOf = (iso: string) => fmtDate(iso).split(' ')[0];
    const timeOf = (iso: string) => fmtDate(iso).split(' ')[1] || '';
    // Время штуки: в пределах суток коротко, через ночь — с датами
    const unitSpan = (u: any) => dayOf(u.assembly_start) === dayOf(u.test_end)
      ? `${dayOf(u.assembly_start)} ${timeOf(u.assembly_start)}–${timeOf(u.test_end)}`
      : `${fmtDate(u.assembly_start)} → ${fmtDate(u.test_end)}`;
    const unitTitle = (u: any) =>
      `${t('p_asm_tip')} ${fmtDate(u.assembly_start)}–${fmtDate(u.assembly_end)} · ${t('p_test_tip')} ${fmtDate(u.test_start)}–${fmtDate(u.test_end)}`;
    const shown = timeline.slice(0, 30);
    return (
      <div className="gantt">
        <div className="gantt-head">
          <b>{t('p_gantt_h')} · {qty} × {skuLabel}</b>
          <span className="mono">{fmtDate(first.assembly_start)} → {fmtDate(finishIso)} · {dur(totalMs)}</span>
        </div>
        <div className="gantt-inner">
          <div className="gantt-row">
            <span className="gantt-label" />
            <div className="gantt-scale">
              {days.map((d, i) => (
                <div key={d.ms} className="gantt-day" style={{ flexGrow: d.hours }} title={`${dayFmt(d.ms)} 09:00–17:00`}>
                  <b>{dayFmt(d.ms)}</b>
                  {i === 0 && firstSub && <span>{firstSub}</span>}
                  {i === days.length - 1 && lastSub && <span>{lastSub}</span>}
                </div>
              ))}
            </div>
            <span className="gantt-time" />
          </div>
          <div className="gantt-row gantt-colhead">
            <span className="gantt-label">#</span>
            <span style={{ flex: 1 }} />
            <span className="gantt-time">{t('p_span_h')}</span>
          </div>
          {shown.map((u: any) => (
            <div key={u.unit} className="gantt-row">
              <span className="gantt-label">#{u.unit}</span>
              <div className="gantt-track" title={unitTitle(u)}>
                <div className="gantt-grid" aria-hidden="true">
                  {bounds.map((b) => <i key={b} style={{ left: `${b}%` }} />)}
                </div>
                <div className="g-asm" style={{ left: `${pos(u.assembly_start)}%`, width: width(u.assembly_start, u.assembly_end) }} />
                <div className="g-tst" style={{ left: `${pos(u.test_start)}%`, width: width(u.test_start, u.test_end) }} />
              </div>
              <span className="gantt-time" title={unitTitle(u)}>{unitSpan(u)}</span>
            </div>
          ))}
        </div>
        {timeline.length > 30 && <div className="muted">{t('p_shown_of', { n: timeline.length })}</div>}
        <div className="gantt-legend">
          <span><i className="sw sw-asm" />{t('p_asm_tip')} · {asmMin} {t('p_dur_m')}</span>
          <span><i className="sw sw-tst" />{t('p_test_tip')} · {tstMin} {t('p_dur_m')}</span>
          <span className="muted hours">{t('p_legend_hours')}</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div className="card-head-row">
          <div className="sp">
            <h3><span className="n">01</span> {t('p_comp_h')}</h3>
            <div className="muted">{t('p_comp_lead')}</div>
          </div>
          {status && <span className="badge badge-gray">{t('p_items', { n: status.component_stock.length })}</span>}
        </div>
        {status ? (
          <>
            <div className="toolbar" style={{ marginTop: 12 }}>
              <label>{t('o_state')}
                <select value={compFilter} onChange={(e) => setCompFilter(e.target.value)}>
                  <option value="all">{t('p_filter_all')}</option>
                  <option value="short">{t('p_filter_short')}</option>
                  <option value="ok">{t('p_filter_ok')}</option>
                </select>
              </label>
              <button className="ghost" onClick={exportCompCsv} disabled={!sortedComp.length} title={t('o_csv_title')}>{t('o_csv')}</button>
              <button className="ghost" onClick={exportCompJson} disabled={!sortedComp.length}>{t('b_json')}</button>
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr>
                  <ColTh label={t('p_th_comp')} k="comp" skey={cpKey} dir={cpDir} onSort={cpToggle} title={t('sort_title')} checked={!compCols.isOff('comp')} onToggle={compCols.toggleCol} />
                  <ColTh label={t('b_leftover')} k="left" skey={cpKey} dir={cpDir} onSort={cpToggle} title={t('sort_title')} checked={!compCols.isOff('left')} onToggle={compCols.toggleCol} />
                  <ColTh label={t('o_th_state')} k="state" skey={cpKey} dir={cpDir} onSort={cpToggle} title={t('sort_title')} checked={!compCols.isOff('state')} onToggle={compCols.toggleCol} />
                </tr></thead>
                <tbody>
                  {sortedComp.map((c: any) => {
                    const low = isLow(c);
                    return (
                      <tr key={c.sku} className={low ? 'row-risk' : ''}>
                        <td className={compCols.isOff('comp') ? 'col-off' : ''}><b>{c.sku}</b><div className="sub">{c.name}</div></td>
                        <td className={compCols.isOff('left') ? 'mono col-off' : 'mono'}>{c.on_hand} {t('b_pcs')}</td>
                        <td className={compCols.isOff('state') ? 'col-off' : ''}>{low
                          ? <span className="badge badge-red">{t('p_shortage')}</span>
                          : <span className="badge badge-green">{t('sc_ok')}</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="muted" style={{ marginTop: 12 }}>
              {t('p_waiting')}: {(status.incoming || []).map((s: any) => `${s.shipment_id} · ${s.sku} ×${s.quantity} · ${fmtDate(s.expected_at)}`).join('  ·  ') || '—'}
            </div>
            {status.active_batch && <div className="info" style={{ marginTop: 12 }}>{t('p_batch_on')}: {(status.active_batch.finished_sku === 'FG-AIR' ? 'air' : 'air plus')} ×{status.active_batch.batch_qty}, {t('p_will_ready')} {fmtDate(status.active_batch.batch_ready_at)}{status.active_batch.started_by_name ? ` · ${t('p_started_by')} ${status.active_batch.started_by_name}` : ''}</div>}
            {status.active_batch && (
              <div className="toolbar" style={{ marginTop: 12 }}>
                <button className="ghost" title={t('p_cancel_title')} onClick={doCancel}>{t('p_cancel')}</button>
              </div>
            )}
          </>
        ) : <div>{t('loading')}</div>}
      </div>

      <div className="card" style={{ borderColor: 'rgba(255,94,0,0.3)' }}>
        <div className="card-head-row">
          <div className="sp">
            <h3><span className="n">02</span> {t('p_plan_h')}</h3>
            <div className="muted">{t('p_plan_lead')}</div>
          </div>
          {plan && <span className={plan.feasible ? 'badge badge-green' : 'badge badge-red'}>{plan.feasible ? t('p_feasible') : t('p_impossible')}</span>}
        </div>
        <div className="toolbar" style={{ marginTop: 14 }}>
          <label>{t('p_product')}
            <ProductPicker products={catalog} value={sku} onChange={setSku} />
          </label>
          <label>{t('p_qty')}<input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} style={{ width: 90 }} /></label>
          <label>{t('p_start')}<input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <button onClick={doPlan} disabled={busy}>{busy ? t('sc_busy') : t('p_plan_btn')}</button>
          <label>{t('s_th_assignee')}
            <select value={runPick} onChange={(e) => setRunPick(e.target.value)}>
              <option value="auto">{t('s_assign_auto')}</option>
              {onShift.map((e: any) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </label>
          <button className="ghost" onClick={doStart}>{t('p_run')}</button>
        </div>
        {msg && <div className="info">{msg}</div>}
        {plan && (
          <div>
            <div style={{ fontSize: 15, marginBottom: 6 }}>
              <b style={{ fontWeight: 600 }}>{plan.feasible ? t('p_feasible') : t('p_impossible')}</b>
              {plan.out_of_horizon && <span className="badge badge-red" style={{ marginLeft: 8 }}>{t('p_out')}</span>}
            </div>
            <div className="muted">{plan.explanation}</div>
            {plan.shortage?.length > 0 && (
              <>
              <div className="toolbar" style={{ marginTop: 12 }}>
                <button className="ghost" onClick={exportShortCsv} title={t('o_csv_title')}>{t('o_csv')}</button>
                <button className="ghost" onClick={exportShortJson}>{t('b_json')}</button>
              </div>
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead><tr>
                    <ColTh label={t('p_th_comp')} k="comp" skey={shKey} dir={shDir} onSort={shToggle} title={t('sort_title')} checked={!shortCols.isOff('comp')} onToggle={shortCols.toggleCol} />
                    <ColTh label={t('p_th_need')} k="need" skey={shKey} dir={shDir} onSort={shToggle} title={t('sort_title')} checked={!shortCols.isOff('need')} onToggle={shortCols.toggleCol} />
                    <ColTh label={t('p_th_have')} k="have" skey={shKey} dir={shDir} onSort={shToggle} title={t('sort_title')} checked={!shortCols.isOff('have')} onToggle={shortCols.toggleCol} />
                    <ColTh label={t('p_th_def')} k="def" skey={shKey} dir={shDir} onSort={shToggle} title={t('sort_title')} checked={!shortCols.isOff('def')} onToggle={shortCols.toggleCol} />
                  </tr></thead>
                  <tbody>
                    {sortedShort.map((s: any) => (
                      <tr key={s.sku}>
                        <td className={shortCols.isOff('comp') ? 'mono col-off' : 'mono'}>{s.sku}</td>
                        <td className={shortCols.isOff('need') ? 'mono col-off' : 'mono'}>{s.need}</td>
                        <td className={shortCols.isOff('have') ? 'mono col-off' : 'mono'}>{s.have}</td>
                        <td className={shortCols.isOff('def') ? 'red col-off' : 'red'}>{s.deficit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}
            {plan.batch_ready_at && (
              <div style={{ marginTop: 10 }}>
                {t('p_ready_at')}: <b className="mono">{fmtDate(plan.batch_ready_at)}</b>
                {plan.timeline?.length ? (
                  <> · {qty} × {(sku === 'FG-AIR' ? 'air' : 'air plus')} · {dur(new Date(plan.batch_ready_at).getTime() - new Date(plan.timeline[0].assembly_start).getTime())}</>
                ) : null}
              </div>
            )}
            {plan.timeline?.length > 0 && (
              <Gantt
                timeline={plan.timeline}
                qty={Number(qty)}
                skuLabel={sku === 'FG-AIR' ? 'air' : 'air plus'}
                readyIso={plan.batch_ready_at}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

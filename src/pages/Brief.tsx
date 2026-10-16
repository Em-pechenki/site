import { useEffect, useMemo, useState } from 'react';
import { prodStatus, aiAsk } from '../api';
import { fmtDate } from '../format';
import { downloadCsv, downloadJson, stamp } from '../export';
import { getOps, onOpsChange, clearOps, opActionLabel, type OpEntry } from '../opslog';
import { useT, useLang } from '../i18n';
import { useSorted, type Accessors } from '../components/SortTable';
import { ColTh, useColumns, visibleRows } from '../components/Columns';

// Утренний бриф директора: KPI, топ-3 угрозы с причинами и датами,
// ближайшие отгрузки, дефицит комплектующих + отчёт CSV/JSON/печать,
// журнал операций и бизнес-вопросы в ИИ на тех же facts.

const humanSku = (sku: string) => (sku === 'FG-AIR' ? 'air' : sku === 'FG-PLUS' ? 'air plus' : sku);

export default function Brief({ snapshot, shipmentsAll }: { snapshot: any; shipmentsAll: any[] }) {
  const t = useT();
  const lang = useLang();
  const tz = t('msk');
  const [prod, setProd] = useState<any>(null);
  const [ops, setOps] = useState<OpEntry[]>(() => getOps());
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiOut, setAiOut] = useState<Record<string, string>>({});
  const [opFilter, setOpFilter] = useState('all');
  const opsCols = useColumns();

  useEffect(() => {
    prodStatus().then(setProd).catch(() => setProd(null));
  }, []);

  useEffect(() => {
    setOps(getOps());
    return onOpsChange(() => setOps(getOps()));
  }, []);

  const allShips: any[] = useMemo(() => {
    const arr = shipmentsAll.length ? shipmentsAll : (snapshot?.shipments_expected || []);
    return [...arr]
      .filter((s: any) => s.status === 'expected')
      .sort((a: any, b: any) => +new Date(a.expected_at) - +new Date(b.expected_at));
  }, [shipmentsAll, snapshot]);

  const threats: any[] = useMemo(() => {
    const list: any[] = snapshot?.orders_active || [];
    return [...list]
      .filter((o: any) => o.atRisk || (o.shortage || 0) > 0)
      .sort((a: any, b: any) => +new Date(a.due_at) - +new Date(b.due_at))
      .slice(0, 3);
  }, [snapshot]);

  function causeFor(o: any): string {
    const st = (snapshot?.stock || []).find((s: any) => s.sku === o.sku);
    const free = st?.free ?? '—';
    const hand = st?.on_hand ?? '—';
    if ((o.shortage || 0) > 0) {
      const next = allShips.find((s: any) => s.sku === o.sku);
      return next
        ? t('b_cause_short', { n: o.shortage, f: free, h: hand, s: next.shipment_id, q: next.quantity, d: fmtDate(next.expected_at) })
        : t('b_cause_short_none', { n: o.shortage, f: free, h: hand });
    }
    if (o.readiness && o.due_at && new Date(o.readiness) > new Date(o.due_at)) {
      return t('b_cause_late', { r: fmtDate(o.readiness), d: fmtDate(o.due_at) });
    }
    if (o.atRisk) return t('b_cause_risk', { d: fmtDate(o.due_at), r: o.readiness ? fmtDate(o.readiness) : t('b_unknown') });
    return t('b_cause_ok');
  }

  const deficits: any[] = useMemo(() => {
    const rows: any[] = prod?.component_stock || [];
    return rows.filter((c: any) => c.on_hand === 0 || (c.sku === 'CMP-CO2' && c.on_hand < 8));
  }, [prod]);

  function briefJson() {
    return {
      generated_at: new Date().toISOString(),
      program_time: snapshot?.now,
      kpi: snapshot?.kpi,
      top_threats: threats.map((o: any) => ({
        order_id: o.order_id, customer: o.customer, sku: o.sku,
        quantity: o.quantity, reserved_qty: o.reserved_qty, shipped_qty: o.shipped_qty,
        due_at: o.due_at, readiness: o.readiness, shortage: o.shortage, cause: causeFor(o),
      })),
      shipments_next: allShips.slice(0, 5).map((s: any) => ({
        shipment_id: s.shipment_id, supplier: s.supplier, sku: s.sku,
        quantity: s.quantity, expected_at: s.expected_at,
      })),
      stock: (snapshot?.stock || []).map((s: any) => ({
        sku: s.sku, name: humanSku(s.sku), on_hand: s.on_hand, reserved: s.reserved, free: s.free,
      })),
      components_deficit: deficits,
      components_incoming: prod?.incoming || [],
      ops_log: ops,
    };
  }

  function briefCsvRows(): Record<string, unknown>[] {
    const H = lang === 'en'
      ? { sec: 'section', pos: 'item', det: 'details', date: 'date', st: 'status' }
      : { sec: 'раздел', pos: 'позиция', det: 'детали', date: 'дата', st: 'статус' };
    const rows: Record<string, unknown>[] = [];
    const k = snapshot?.kpi || {};
    rows.push({ [H.sec]: 'KPI', [H.pos]: t('kpi_active'), [H.det]: k.active_orders ?? '', [H.date]: '', [H.st]: '' });
    rows.push({ [H.sec]: 'KPI', [H.pos]: t('kpi_risks'), [H.det]: k.at_risk ?? '', [H.date]: '', [H.st]: (k.at_risk || 0) > 0 ? t('b_threats', { n: k.at_risk }) : t('kpi_all_ok') });
    rows.push({ [H.sec]: 'KPI', [H.pos]: t('o_short'), [H.det]: k.shortage_orders ?? '', [H.date]: '', [H.st]: '' });
    rows.push({ [H.sec]: 'KPI', [H.pos]: t('kpi_transit'), [H.det]: k.expected_shipments ?? '', [H.date]: '', [H.st]: '' });
    if (!threats.length) {
      rows.push({ [H.sec]: t('b_top_h'), [H.pos]: '—', [H.det]: t('b_report_none'), [H.date]: '', [H.st]: t('sc_ok') });
    }
    for (const o of threats) {
      rows.push({
        [H.sec]: t('b_top_h'), [H.pos]: o.order_id,
        [H.det]: `${o.customer} · ${humanSku(o.sku)} ×${o.quantity} (${t('o_th_booked')} ${o.reserved_qty}, ${t('o_shipped_sub', { n: o.shipped_qty })})`,
        [H.date]: `${t('b_deadline')} ${fmtDate(o.due_at)} · ${t('b_ready')} ${o.readiness ? fmtDate(o.readiness) : '—'}`,
        [H.st]: causeFor(o),
      });
    }
    for (const s of allShips.slice(0, 5)) {
      rows.push({
        [H.sec]: t('b_next_h'), [H.pos]: s.shipment_id,
        [H.det]: `${s.supplier || t('s_supplier_def')} · ${humanSku(s.sku)} ×${s.quantity}`,
        [H.date]: fmtDate(s.expected_at), [H.st]: t('intransit_badge'),
      });
    }
    for (const s of snapshot?.stock || []) {
      rows.push({
        [H.sec]: t('nav_dash'), [H.pos]: `${humanSku(s.sku)} (${s.sku})`,
        [H.det]: `${t('in_stock')} ${s.on_hand} · ${t('booked')} ${s.reserved} · ${t('free')} ${s.free}`,
        [H.date]: '', [H.st]: s.free <= 0 ? t('b_empty') : t('sc_ok'),
      });
    }
    if (deficits.length) {
      for (const c of deficits) {
        rows.push({ [H.sec]: t('b_def_h'), [H.pos]: c.sku, [H.det]: `${c.name || ''} · ${t('b_leftover')} ${c.on_hand} ${t('b_pcs')}`, [H.date]: '', [H.st]: t('b_deficit') });
      }
    } else {
      rows.push({ [H.sec]: t('b_def_h'), [H.pos]: '—', [H.det]: t('b_no_def'), [H.date]: '', [H.st]: t('sc_ok') });
    }
    return rows;
  }

  function exportBriefCsv() {
    downloadCsv(`${lang === 'en' ? 'brief' : 'svodka'}_${stamp()}.csv`, briefCsvRows());
  }

  function exportBriefJson() {
    downloadJson(`${lang === 'en' ? 'brief' : 'svodka'}_${stamp()}.json`, briefJson());
  }

  function exportOpsCsv() {
    const H = lang === 'en'
      ? { ts: 'time', who: 'who', act: 'action', doc: 'order', ship: 'shipment', sku: 'product', qty: 'qty', note: 'note' }
      : { ts: 'время', who: 'кто', act: 'действие', doc: 'заказ', ship: 'поставка', sku: 'товар', qty: 'колво', note: 'примечание' };
    // порядок строк = порядок на экране после сортировки, колонки — только с галочками
    downloadCsv(`${lang === 'en' ? 'log' : 'zhurnal'}_${stamp()}.csv`, visibleRows(sortedOps.map((o) => ({
      [H.ts]: o.ts, [H.who]: actorName(o.actor), [H.act]: opActionLabel(o.action, lang),
      [H.doc]: o.order_id || '', [H.ship]: o.shipment_id || '',
      [H.sku]: o.sku || '', [H.qty]: o.qty ?? '', [H.note]: o.note || '',
    })), opsCols.hidden, {
      when: H.ts, who: H.who, action: H.act, doc: [H.doc, H.ship], qty: H.qty, note: [H.sku, H.note],
    }));
  }

  function exportOpsJson() {
    downloadJson(`${lang === 'en' ? 'log' : 'zhurnal'}_${stamp()}.json`, visibleRows(
      sortedOps.map((o) => ({ ts: o.ts, actor: o.actor, action: o.action, order_id: o.order_id, shipment_id: o.shipment_id, sku: o.sku, qty: o.qty, note: o.note })),
      opsCols.hidden,
      { when: 'ts', who: 'actor', action: 'action', doc: ['order_id', 'shipment_id'], qty: 'qty', note: ['sku', 'note'] },
    ));
  }

  function actorName(a: string): string {
    return a === 'оператор' || a === 'operator' ? (lang === 'en' ? 'operator' : 'оператор') : a;
  }

  async function askBiz(key: string, question: string) {
    if (aiBusy) return;
    setAiBusy(key);
    try {
      const r = await aiAsk(question, undefined, 'analyst', [], lang);
      setAiOut((p) => ({ ...p, [key]: r.answer || '' }));
    } catch (e: any) {
      setAiOut((p) => ({ ...p, [key]: t('b_ask_fail') + (e.message || e) }));
    } finally {
      setAiBusy(null);
    }
  }

  if (!snapshot) return <div className="card">{t('loading_snap')}</div>;
  const kpi = snapshot.kpi || {};

  const opsAcc: Accessors<OpEntry> = {
    when: (o) => o.ts,
    who: (o) => actorName(o.actor),
    action: (o) => opActionLabel(o.action, lang),
    doc: (o) => o.order_id || o.shipment_id || '',
    qty: (o) => (o.qty ?? null),
    note: (o) => `${o.sku ? o.sku + ' · ' : ''}${o.note || ''}`,
  };
  const filteredOps = opFilter === 'all' ? ops : ops.filter((o) => o.action === opFilter);
  const { sorted: sortedOpsAll, skey: opsKey, dir: opsDir, toggle: opsToggle } = useSorted(filteredOps, opsAcc, 'when', -1);
  const sortedOps = sortedOpsAll;
  const shownOps = sortedOps.slice(0, 30);
  const opActions = [...new Set(ops.map((o) => o.action))];

  return (
    <div className="brief">
      <div className="toolbar">
        <button onClick={exportBriefCsv} title={t('b_csv_title')}>{t('b_csv')}</button>
        <button className="ghost" onClick={exportBriefJson} title={t('b_json_title')}>{t('b_json')}</button>
        <span style={{ marginLeft: 'auto' }} className="badge badge-gray">
          {fmtDate(snapshot.now)} {tz}
        </span>
      </div>

      <div className="fc-stats fc-stats--kpi" style={{ marginTop: 12 }}>
        <div className="fc-stat good">
          <div className="fc-stat-label">{t('kpi_active')}</div>
          <div className="fc-stat-value">{kpi.active_orders ?? '—'}</div>
          <div className="fc-stat-sub">{kpi.expected_shipments ?? '—'} {t('kpi_transit')}</div>
        </div>
        <div className={(kpi.at_risk || 0) > 0 ? 'fc-stat risk' : 'fc-stat good'}>
          <div className="fc-stat-label">{t('kpi_risks')}</div>
          <div className="fc-stat-value">{kpi.at_risk ?? '—'}</div>
          <div className="fc-stat-sub">{(kpi.at_risk || 0) > 0 ? t('b_threats', { n: kpi.at_risk }) : t('kpi_all_ok')}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head-row">
          <div className="sp">
            <h3><span className="n">01</span> {t('b_top_h')}</h3>
            <div className="muted">{t('b_top_lead')}</div>
          </div>
          <span className={threats.length ? 'badge badge-red' : 'badge badge-green'}>
            {threats.length ? t('b_threats', { n: threats.length }) : t('b_no_threats')}
          </span>
        </div>
        {threats.length === 0 && <div className="muted">{t('b_report_none')}</div>}
        <div className="cx-rows">
          {threats.map((o: any) => (
            <div className="cx-row risk" key={o.order_id}>
              <span className="cx-ic bad">!</span>
              <div className="cx-row-main">
                <b>{o.order_id} · {o.customer} · {humanSku(o.sku)} ×{o.quantity}</b>
                <span>{t('b_deadline')} {fmtDate(o.due_at)} · {t('b_ready')} {o.readiness ? fmtDate(o.readiness) : t('b_unknown')} · {causeFor(o)}</span>
              </div>
              <div className="cx-row-meta">
                <span className="badge badge-red">{(o.shortage || 0) > 0 ? t('b_short_of', { n: o.shortage }) : t('b_deadline_risk')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <h3><span className="n">02</span> {t('b_next_h')}</h3>
          <div className="muted">{t('b_next_lead')}</div>
          <div className="cx-rows">
            {allShips.slice(0, 4).map((s: any) => (
              <div className="cx-row" key={s.shipment_id}>
                <span className="cx-ic cx-ic--accent">▸</span>
                <div className="cx-row-main">
                  <b>{s.shipment_id}</b>
                  <span>{humanSku(s.sku)} ×{s.quantity} · {s.supplier || t('s_supplier_def')} · {t('arrives')} {fmtDate(s.expected_at)}</span>
                </div>
              </div>
            ))}
            {allShips.length === 0 && <div className="muted">{t('b_no_ships')}</div>}
          </div>
        </div>
        <div className="card">
          <h3><span className="n">03</span> {t('b_def_h')}</h3>
          <div className="muted">{t('b_def_lead')}</div>
          {deficits.length === 0 && <div className="muted">{t('b_no_def')}</div>}
          <div className="cx-rows">
            {deficits.map((c: any) => (
              <div className="cx-row risk" key={c.sku}>
                <span className="cx-ic bad">{c.sku.replace('CMP-', '').slice(0, 2)}</span>
                <div className="cx-row-main">
                  <b>{c.sku}</b>
                  <span>{c.name || ''} · {t('b_leftover')} {c.on_hand} {t('b_pcs')}</span>
                </div>
                <div className="cx-row-meta"><span className="badge badge-red">{t('b_deficit')}</span></div>
              </div>
            ))}
          </div>
          {(prod?.incoming || []).length > 0 && (
            <div className="muted" style={{ marginTop: 10 }}>
              {t('b_waiting')}: {(prod.incoming || []).map((s: any) => `${s.shipment_id} · ${s.sku} ×${s.quantity} · ${fmtDate(s.expected_at)}`).join(' · ')}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head-row">
          <div className="sp">
            <h3><span className="n">04</span> {t('b_ai_h')}</h3>
            <div className="muted">{t('b_ai_lead')}</div>
          </div>
        </div>
        <div className="toolbar" style={{ marginTop: 12 }}>
          <button className="ghost" disabled={!!aiBusy} onClick={() => askBiz('first', t('b_q1_full'))}>
            {aiBusy === 'first' ? t('b_thinking') : t('b_q1')}
          </button>
          <button className="ghost" disabled={!!aiBusy} onClick={() => askBiz('risk', t('b_q2_full'))}>
            {aiBusy === 'risk' ? t('b_thinking') : t('b_q2')}
          </button>
        </div>
        {aiOut.first && <div className="ai-answer"><div style={{ whiteSpace: 'pre-wrap' }}>{aiOut.first}</div></div>}
        {aiOut.risk && <div className="ai-answer"><div style={{ whiteSpace: 'pre-wrap' }}>{aiOut.risk}</div></div>}
      </div>

      <div className="card">
        <div className="card-head-row">
          <div className="sp">
            <h3><span className="n">05</span> {t('b_log_h')}</h3>
            <div className="muted">{t('b_log_lead')}</div>
          </div>
          <span className="badge badge-gray">{t('b_records', { n: ops.length })}</span>
        </div>
        <div className="toolbar" style={{ marginTop: 12 }}>
          <label>{t('o_state')}
            <select value={opFilter} onChange={(e) => setOpFilter(e.target.value)}>
              <option value="all">{t('o_all')}</option>
              {opActions.map((a) => (
                <option key={a} value={a}>{opActionLabel(a, lang)}</option>
              ))}
            </select>
          </label>
          <button className="ghost" onClick={exportOpsCsv} disabled={!ops.length} title={t('b_log_csv_title')}>{t('b_log_csv')}</button>
          <button className="ghost" onClick={exportOpsJson} disabled={!ops.length}>{t('b_log_json')}</button>
          <button className="ghost" onClick={clearOps} disabled={!ops.length} title={t('b_log_clear_title')}>{t('b_log_clear')}</button>
        </div>
        {!ops.length && <div className="muted">{t('b_log_empty')}</div>}
        {!!ops.length && (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr>
                <ColTh label={t('b_th_when')} k="when" skey={opsKey} dir={opsDir} onSort={opsToggle} title={t('sort_title')} checked={!opsCols.isOff('when')} onToggle={opsCols.toggleCol} />
                <ColTh label={t('b_th_who')} k="who" skey={opsKey} dir={opsDir} onSort={opsToggle} title={t('sort_title')} checked={!opsCols.isOff('who')} onToggle={opsCols.toggleCol} />
                <ColTh label={t('b_th_action')} k="action" skey={opsKey} dir={opsDir} onSort={opsToggle} title={t('sort_title')} checked={!opsCols.isOff('action')} onToggle={opsCols.toggleCol} />
                <ColTh label={t('b_th_doc')} k="doc" skey={opsKey} dir={opsDir} onSort={opsToggle} title={t('sort_title')} checked={!opsCols.isOff('doc')} onToggle={opsCols.toggleCol} />
                <ColTh label={t('b_th_qty')} k="qty" skey={opsKey} dir={opsDir} onSort={opsToggle} title={t('sort_title')} checked={!opsCols.isOff('qty')} onToggle={opsCols.toggleCol} />
                <ColTh label={t('b_th_note')} k="note" skey={opsKey} dir={opsDir} onSort={opsToggle} title={t('sort_title')} checked={!opsCols.isOff('note')} onToggle={opsCols.toggleCol} />
              </tr></thead>
              <tbody>
                {shownOps.map((o, i) => (
                  <tr key={`${o.ts}-${i}`}>
                    <td className={opsCols.isOff('when') ? 'mono col-off' : 'mono'}>{fmtDate(o.ts)}</td>
                    <td className={opsCols.isOff('who') ? 'col-off' : ''}>{actorName(o.actor)}</td>
                    <td className={opsCols.isOff('action') ? 'col-off' : ''}>{opActionLabel(o.action, lang)}</td>
                    <td className={opsCols.isOff('doc') ? 'mono col-off' : 'mono'}>{o.order_id || o.shipment_id || '—'}</td>
                    <td className={opsCols.isOff('qty') ? 'mono col-off' : 'mono'}>{o.qty ?? '—'}</td>
                    <td className={opsCols.isOff('note') ? 'col-off' : ''}>{o.sku ? `${o.sku} · ` : ''}{o.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {ops.length > shownOps.length && <div className="muted">{t('b_log_more', { s: shownOps.length, n: ops.length })}</div>}
      </div>
    </div>
  );
}

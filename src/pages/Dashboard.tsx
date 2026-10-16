import { useMemo, useState } from 'react';
import { fmtDate } from '../format';
import { useT, useLang } from '../i18n';
import { useSorted, type Accessors } from '../components/SortTable';
import { ColTh, useColumns, visibleRows } from '../components/Columns';
import { downloadCsv, downloadJson, stamp } from '../export';

export default function Dashboard({ snapshot, shipmentsAll }: { snapshot: any; shipmentsAll: any[] }) {
  const t = useT();
  const lang = useLang();
  const tz = t('msk');
  const [query, setQuery] = useState('');
  const [availFilter, setAvailFilter] = useState('all');
  const [transitFilter, setTransitFilter] = useState('all');
  const stockCols = useColumns();
  const transitCols = useColumns();

  const stockAcc: Accessors<any> = useMemo(() => ({
    name: (s) => s.sku,
    hand: (s) => s.on_hand,
    reserved: (s) => s.reserved,
    free: (s) => s.free,
    pct: (s) => (s.on_hand > 0 ? Math.round((s.reserved / s.on_hand) * 100) : 0),
  }), []);
  const { sorted: sortedStockBase, skey: stKey, dir: stDir, toggle: stToggle } = useSorted(snapshot?.stock || [], stockAcc, 'name');
  const humanSku = (sku: string) => (sku === 'FG-AIR' ? 'air' : sku === 'FG-PLUS' ? 'air plus' : sku);
  // Единый поиск как в Заказах: пусто = все; иначе по SKU и названию товара.
  const q = query.trim().toLowerCase();
  function matchStock(s: any) {
    if (!q) return true;
    const hay = `${s.sku} ${humanSku(s.sku)}`.toLowerCase();
    return q.split(/\s+/).every((tok) => hay.includes(tok));
  }
  const sortedStock = sortedStockBase.filter((s: any) => {
    if (!matchStock(s)) return false;
    if (availFilter === 'ok' && !(s.free > 0)) return false;
    if (availFilter === 'empty' && s.free > 0) return false;
    return true;
  });

  const transitAcc: Accessors<any> = useMemo(() => ({
    id: (s) => s.shipment_id,
    sku: (s) => s.sku,
    qty: (s) => s.quantity,
    arrives: (s) => s.expected_at,
    state: (s) => (s.status === 'expected' && snapshot && new Date(s.expected_at) < new Date(snapshot.now) ? 1 : 0),
  }), [snapshot]);
  const allShips = shipmentsAll.length ? shipmentsAll : (snapshot?.shipments_expected || []);
  const transitFiltered = allShips.filter((s: any) => s.status === 'expected' || !s.status).filter((s: any) => {
    if (q) {
      const hay = `${s.shipment_id} ${(s.supplier || '')} ${s.sku} ${humanSku(s.sku)}`.toLowerCase();
      if (!q.split(/\s+/).every((tok) => hay.includes(tok))) return false;
    }
    const overdue = snapshot && new Date(s.expected_at) < new Date(snapshot.now);
    if (transitFilter === 'late' && !overdue) return false;
    if (transitFilter === 'ok' && overdue) return false;
    return true;
  });
  const { sorted: sortedTransit, skey: trKey, dir: trDir, toggle: trToggle } = useSorted(transitFiltered, transitAcc, 'arrives');

  function stockHeads() {
    return { prod: t('o_th_product'), hand: t('in_stock'), res: t('booked'), free: t('free'), pct: t('booked_pct') };
  }

  function exportStockCsv() {
    const H = stockHeads();
    downloadCsv(`${lang === 'en' ? 'stock' : 'sklad'}_${stamp()}.csv`,
      visibleRows(sortedStock.map((s: any) => ({
        [H.prod]: `${humanSku(s.sku)} (${s.sku})`,
        [H.hand]: s.on_hand,
        [H.res]: s.reserved,
        [H.free]: s.free,
        [H.pct]: s.on_hand > 0 ? Math.round((s.reserved / s.on_hand) * 100) : 0,
      })), stockCols.hidden, { name: H.prod, hand: H.hand, reserved: H.res, free: H.free, pct: H.pct }));
  }

  function exportStockJson() {
    downloadJson(`${lang === 'en' ? 'stock' : 'sklad'}_${stamp()}.json`, sortedStock);
  }

  function transitHeads() {
    return { id: t('th_shipment'), sku: t('o_th_product'), qty: t('o_th_qty'), arr: t('th_arrives'), st: t('o_th_state') };
  }

  function exportTransitCsv() {
    const H = transitHeads();
    downloadCsv(`${lang === 'en' ? 'in_transit' : 'v_puti'}_${stamp()}.csv`,
      visibleRows(sortedTransit.map((s: any) => ({
        [H.id]: s.shipment_id,
        [H.sku]: humanSku(s.sku),
        [H.qty]: s.quantity,
        [H.arr]: fmtDate(s.expected_at),
        [H.st]: (snapshot && new Date(s.expected_at) < new Date(snapshot.now)) ? t('overdue_badge') : t('intransit_badge'),
      })), transitCols.hidden, { id: H.id, sku: H.sku, qty: H.qty, arrives: H.arr, state: H.st }));
  }

  function exportTransitJson() {
    downloadJson(`${lang === 'en' ? 'in_transit' : 'v_puti'}_${stamp()}.json`, sortedTransit);
  }

  if (!snapshot) return <div className="card">{t('loading_snap')}</div>;
  const now = snapshot.now;

  return (
    <div>
      <div className="fc-stats fc-stats--kpi">
        <div className="fc-stat good">
          <div className="fc-stat-label">{t('kpi_active')}</div>
          <div className="fc-stat-value">{snapshot.kpi?.active_orders ?? '—'}</div>
          <div className="fc-stat-sub">{snapshot.kpi?.expected_shipments ?? '—'} {t('kpi_transit')}</div>
        </div>
        <div className={snapshot.kpi?.at_risk > 0 ? 'fc-stat risk' : 'fc-stat good'}>
          <div className="fc-stat-label">{t('kpi_risks')}</div>
          <div className="fc-stat-value">{snapshot.kpi?.at_risk ?? '—'}</div>
          <div className="fc-stat-sub">{snapshot.kpi?.at_risk > 0 ? t('kpi_check_delay') : t('kpi_all_ok')}</div>
        </div>
      </div>

      <div className="toolbar">
        <label style={{ flex: '1 1 280px', minWidth: 220 }}>{t('f_search')}
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('f_search_ph')} style={{ flex: 1, width: '100%', minWidth: 220 }} />
        </label>
      </div>

      <div className="card">
        <div className="card-head-row">
          <div className="sp">
            <h3><span className="n">01</span> {t('stock_h')}</h3>
            <div className="muted">{t('stock_lead', { date: fmtDate(now), tz })}</div>
          </div>
          <span className="badge badge-blue">{t('items_count', { n: snapshot.stock.length })}</span>
        </div>
        <div className="toolbar" style={{ marginTop: 12 }}>
          <label>{t('d_avail')}
            <select value={availFilter} onChange={(e) => setAvailFilter(e.target.value)}>
              <option value="all">{t('o_all')}</option>
              <option value="ok">{t('d_avail_ok')}</option>
              <option value="empty">{t('d_avail_empty')}</option>
            </select>
          </label>
          <button className="ghost" onClick={exportStockCsv} disabled={!sortedStock.length} title={t('o_csv_title')}>{t('o_csv')}</button>
          <button className="ghost" onClick={exportStockJson} disabled={!sortedStock.length}>{t('b_json')}</button>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr>
              <ColTh label={t('o_th_product')} k="name" skey={stKey} dir={stDir} onSort={stToggle} title={t('sort_title')} checked={!stockCols.isOff('name')} onToggle={stockCols.toggleCol} />
              <ColTh label={t('in_stock')} k="hand" skey={stKey} dir={stDir} onSort={stToggle} title={t('sort_title')} checked={!stockCols.isOff('hand')} onToggle={stockCols.toggleCol} />
              <ColTh label={t('booked')} k="reserved" skey={stKey} dir={stDir} onSort={stToggle} title={t('sort_title')} checked={!stockCols.isOff('reserved')} onToggle={stockCols.toggleCol} />
              <ColTh label={t('free')} k="free" skey={stKey} dir={stDir} onSort={stToggle} title={t('sort_title')} checked={!stockCols.isOff('free')} onToggle={stockCols.toggleCol} />
              <ColTh label={t('booked_pct')} k="pct" skey={stKey} dir={stDir} onSort={stToggle} title={t('sort_title')} checked={!stockCols.isOff('pct')} onToggle={stockCols.toggleCol} />
            </tr></thead>
            <tbody>
              {sortedStock.map((s: any) => {
                const pct = s.on_hand > 0 ? Math.round((s.reserved / s.on_hand) * 100) : 0;
                const isAir = s.sku === 'FG-AIR';
                return (
                  <tr key={s.sku}>
                    <td className={stockCols.isOff('name') ? 'col-off' : ''}><b>{t('sensor')} {isAir ? 'air' : 'air plus'}</b><div className="sub">{s.sku}</div></td>
                    <td className={stockCols.isOff('hand') ? 'mono col-off' : 'mono'}>{s.on_hand}</td>
                    <td className={stockCols.isOff('reserved') ? 'mono col-off' : 'mono'}>{s.reserved}</td>
                    <td className={stockCols.isOff('free') ? 'mono col-off' : 'mono'}>{s.free}</td>
                    <td className={stockCols.isOff('pct') ? 'mono col-off' : 'mono'}>{pct}%<div className="bar bar-sm"><div className="bar-fill" style={{ width: `${Math.min(100, pct)}%` }} /></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head-row">
          <div className="sp">
            <h3><span className="n">02</span> {t('transit_h')}</h3>
            <div className="muted">{t('transit_lead')}</div>
          </div>
          <span className="badge badge-gray">{sortedTransit.length} {t('intransit_badge')}</span>
        </div>
        <div className="toolbar" style={{ marginTop: 12 }}>
          <label>{t('o_state')}
            <select value={transitFilter} onChange={(e) => setTransitFilter(e.target.value)}>
              <option value="all">{t('o_all')}</option>
              <option value="late">{t('overdue_badge')}</option>
              <option value="ok">{t('intransit_badge')}</option>
            </select>
          </label>
          <button className="ghost" onClick={exportTransitCsv} disabled={!sortedTransit.length} title={t('o_csv_title')}>{t('o_csv')}</button>
          <button className="ghost" onClick={exportTransitJson} disabled={!sortedTransit.length}>{t('b_json')}</button>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr>
              <ColTh label={t('th_shipment')} k="id" skey={trKey} dir={trDir} onSort={trToggle} title={t('sort_title')} checked={!transitCols.isOff('id')} onToggle={transitCols.toggleCol} />
              <ColTh label={t('o_th_product')} k="sku" skey={trKey} dir={trDir} onSort={trToggle} title={t('sort_title')} checked={!transitCols.isOff('sku')} onToggle={transitCols.toggleCol} />
              <ColTh label={t('o_th_qty')} k="qty" skey={trKey} dir={trDir} onSort={trToggle} title={t('sort_title')} checked={!transitCols.isOff('qty')} onToggle={transitCols.toggleCol} />
              <ColTh label={t('th_arrives')} k="arrives" skey={trKey} dir={trDir} onSort={trToggle} title={t('sort_title')} checked={!transitCols.isOff('arrives')} onToggle={transitCols.toggleCol} />
              <ColTh label={t('o_th_state')} k="state" skey={trKey} dir={trDir} onSort={trToggle} title={t('sort_title')} checked={!transitCols.isOff('state')} onToggle={transitCols.toggleCol} />
            </tr></thead>
            <tbody>
              {sortedTransit.map((s: any) => {
                const overdue = s.status === 'expected' && new Date(s.expected_at) < new Date(now);
                return (
                  <tr key={s.shipment_id} className={overdue ? 'row-risk' : ''}>
                    <td className={transitCols.isOff('id') ? 'mono col-off' : 'mono'}>{s.shipment_id}</td>
                    <td className={transitCols.isOff('sku') ? 'col-off' : ''}><span className="cx-tag">{s.sku === 'FG-AIR' ? 'air' : 'air plus'}</span></td>
                    <td className={transitCols.isOff('qty') ? 'mono col-off' : 'mono'}>{s.quantity}</td>
                    <td className={transitCols.isOff('arrives') ? 'mono col-off' : 'mono'}>{fmtDate(s.expected_at)}</td>
                    <td className={transitCols.isOff('state') ? 'col-off' : ''}>{overdue
                      ? <span className="badge badge-red">{t('overdue_badge')}</span>
                      : <span className="badge badge-blue">{t('intransit_badge')}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

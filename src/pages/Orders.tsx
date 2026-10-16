import { useEffect, useMemo, useState } from 'react';
import { createOrder, reserve, ship, unreserve, cancelShip, orders as fetchOrders } from '../api';
import { fmtDate } from '../format';
import { RiskBadge, StatusBadge } from '../components/Badges';
import { logOp } from '../opslog';
import { downloadCsv, downloadJson } from '../export';
import { useT, useLang } from '../i18n';
import { useSorted, type Accessors } from '../components/SortTable';
import { ColTh, useColumns, visibleRows } from '../components/Columns';
import ProductPicker, { useCatalog } from '../components/ProductPicker';

export default function Orders({ snapshot, onChange }: { snapshot: any; onChange: () => void }) {
  const t = useT();
  const lang = useLang();
  const [riskFilter, setRiskFilter] = useState('all');
  const [showClosed, setShowClosed] = useState(true);
  const [closed, setClosed] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ customer: '', sku: 'FG-AIR', quantity: 5, due_at: '2026-11-03T17:00' });
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [query, setQuery] = useState('');
  const openCols = useColumns();
  const closedCols = useColumns();
  const catalog = useCatalog(snapshot);

  const freeBySku: Record<string, number> = {};
  for (const s of snapshot?.stock || []) freeBySku[s.sku] = s.free ?? 0;

  function suggested(o: any) {
    return Math.max(0, Math.min(o.unreserved ?? 0, freeBySku[o.sku] ?? 0));
  }

  function manualQty(o: any) {
    const v = qtyMap[o.order_id];
    if (v && v > 0) return Math.floor(v);
    return 0;
  }

  function reserveQtyFor(o: any) {
    return manualQty(o) || suggested(o);
  }

  function shipQtyFor(o: any) {
    // Отгрузка идёт только из брони — дефолт это reserved_qty,
    // а не min(unreserved, free) как для резерва.
    return manualQty(o) || Math.max(0, o.reserved_qty ?? 0);
  }

  function unreserveQtyFor(o: any) {
    return manualQty(o) || Math.max(0, o.reserved_qty ?? 0);
  }

  function cancelShipQtyFor(o: any) {
    return manualQty(o) || Math.max(0, o.shipped_qty ?? 0);
  }

  function placeholderFor(o: any) {
    // Резерв — основной сценарий, но если резервировать уже нечего
    // (suggested 0), а бронь есть — показываем бронь, чтобы поле
    // не предлагало «0» при активной кнопке «Отгрузить».
    const s = suggested(o);
    if (s > 0) return s;
    return Math.max(0, o.reserved_qty ?? 0);
  }

  const humanSku = (sku: string) => (sku === 'FG-AIR' ? 'air' : sku === 'FG-PLUS' ? 'air plus' : sku);

  const rawList: any[] = snapshot?.orders_active || [];
  let list: any[] = rawList;
  if (riskFilter === 'risk') list = list.filter((o) => o.atRisk);
  if (riskFilter === 'ok') list = list.filter((o) => !o.atRisk);
  if (riskFilter === 'short') list = list.filter((o) => (o.shortage || 0) > 0);
  // Единый поиск: пусто = все; иначе ищем по номеру, клиенту, SKU и названию товара.
  const q = query.trim().toLowerCase();
  if (q) list = list.filter((o) => {
    const hay = `${o.order_id} ${(o.customer || '')} ${o.sku} ${humanSku(o.sku)}`.toLowerCase();
    return q.split(/\s+/).every((tok) => hay.includes(tok));
  });

  const openAcc: Accessors<any> = useMemo(() => ({
    id: (o) => o.order_id,
    customer: (o) => o.customer,
    sku: (o) => o.sku,
    qty: (o) => o.quantity,
    booked: (o) => o.reserved_qty,
    ready: (o) => o.readiness || null,
    state: (o) => ((o.shortage || 0) > 0 ? 2 : o.atRisk ? 1 : 0),
  }), []);
  const { sorted: sortedOpen, skey, dir, toggle } = useSorted(list, openAcc, 'id');

  const closedAcc: Accessors<any> = useMemo(() => ({
    id: (o) => o.order_id,
    customer: (o) => o.customer,
    sku: (o) => o.sku,
    qty: (o) => o.quantity,
    state: (o) => o.status,
  }), []);
  const { sorted: sortedClosed, skey: cKey, dir: cDir, toggle: cToggle } = useSorted(closed, closedAcc, 'id');

  useEffect(() => { loadClosed(); }, []);

  if (!snapshot) return <div className="card">{t('loading')}</div>;

  async function loadClosed() {
    try {
      const all = await fetchOrders('all');
      setClosed(all.filter((o: any) => o.status !== 'active'));
    } catch (e: any) {
      setMsg(t('o_closed_err') + e.message);
    }
  }

  async function doReserve(o: any) {
    const qty = reserveQtyFor(o);
    if (!(qty > 0)) {
      setMsg(t('o_nothing_reserve', { id: o.order_id }));
      return;
    }
    setMsg('');
    try {
      await reserve(o.order_id, qty);
      logOp({ action: 'reserve', order_id: o.order_id, sku: o.sku, qty, note: t('log_reserve_note', { qty }) });
      setMsg(t('o_reserved_ok', { qty, id: o.order_id }));
      onChange();
    } catch (e: any) {
      setMsg(t('o_err') + `${e.message}${e.hint ? ' — ' + e.hint : ''}`);
    }
  }

  async function doShip(o: any) {
    const qty = shipQtyFor(o);
    if (!(qty > 0)) {
      setMsg(t('o_nothing_ship', { id: o.order_id }));
      return;
    }
    setMsg('');
    try {
      await ship(o.order_id, qty);
      logOp({ action: 'ship', order_id: o.order_id, sku: o.sku, qty, note: t('log_ship_note', { qty }) });
      setMsg(t('o_shipped_ok', { qty, id: o.order_id }));
      onChange();
    } catch (e: any) {
      setMsg(t('o_err') + `${e.message}${e.hint ? ' — ' + e.hint : ''}`);
    }
  }

  async function doUnreserve(o: any) {
    const qty = unreserveQtyFor(o);
    if (!(qty > 0)) {
      setMsg(t('o_nothing_unreserve', { id: o.order_id }));
      return;
    }
    setMsg('');
    try {
      await unreserve(o.order_id, qty);
      logOp({ action: 'unreserve', order_id: o.order_id, sku: o.sku, qty, note: t('log_unreserve_note', { qty }) });
      setMsg(t('o_unreserved_ok', { qty, id: o.order_id }));
      onChange();
    } catch (e: any) {
      setMsg(t('o_err') + `${e.message}${e.hint ? ' — ' + e.hint : ''}`);
    }
  }

  async function doCancelShip(o: any) {
    const qty = cancelShipQtyFor(o);
    if (!(qty > 0)) {
      setMsg(t('o_nothing_cancel_ship', { id: o.order_id }));
      return;
    }
    setMsg('');
    try {
      const r: any = await cancelShip(o.order_id, qty);
      logOp({ action: 'cancel_ship', order_id: o.order_id, sku: o.sku, qty, note: t('log_cancel_ship_note', { qty }) });
      setMsg(t('o_ship_canceled_ok', { qty, id: o.order_id }) + (o.status !== 'active' ? ' ' + t('o_reopen_ok', { id: o.order_id }) : ''));
      void r;
      onChange();
      if (showClosed) loadClosed();
    } catch (e: any) {
      setMsg(t('o_err') + `${e.message}${e.hint ? ' — ' + e.hint : ''}`);
    }
  }

  async function doCreate() {
    setMsg('');
    try {
      const due_at = form.due_at.includes('+') || form.due_at.endsWith('Z') ? form.due_at : `${form.due_at}:00+03:00`;
      const created: any = await createOrder({ customer: form.customer || t('o_new_customer'), sku: form.sku, quantity: Number(form.quantity), due_at });
      logOp({ action: 'create_order', order_id: created?.order_id, sku: form.sku, qty: Number(form.quantity), note: `${form.customer || t('o_new_customer')} · ${t('log_due_word')} ${due_at}` });
      setShowNew(false);
      setMsg(t('o_created_ok'));
      onChange();
    } catch (e: any) {
      setMsg(t('o_err') + `${e.message}${e.hint ? ' — ' + e.hint : ''}`);
    }
  }

  function orderRows(rows: any[], H: Record<string, string>) {
    return rows.map((o: any) => ({
      [H.id]: o.order_id,
      [H.cust]: o.customer,
      [H.sku]: o.sku,
      [H.qty]: o.quantity,
      [H.res]: o.reserved_qty,
      [H.shp]: o.shipped_qty,
      [H.rem]: o.remaining ?? (o.quantity - (o.shipped_qty || 0)),
      [H.unr]: o.unreserved ?? ((o.quantity - (o.shipped_qty || 0)) - (o.reserved_qty || 0)),
      [H.rdy]: o.readiness || '',
      [H.due]: o.due_at,
      [H.risk]: o.atRisk ? 'yes' : 'no',
      [H.sh]: o.shortage || 0,
      [H.st]: o.status || 'active',
    }));
  }

  // Выгрузка = экран: открытые в их сортировке + (если галочка стоит)
  // закрытые в их сортировке общим списком с флагом статуса.
  // Снятые галочки колонок выкидывают колонку из файла.
  function exportRows(): Record<string, unknown>[] {
    const H = lang === 'en'
      ? { id: 'order_id', cust: 'customer', sku: 'sku', qty: 'qty', res: 'reserved', shp: 'shipped', rem: 'remaining', unr: 'unreserved', rdy: 'readiness', due: 'due_at', risk: 'atRisk', sh: 'shortage', st: 'status' }
      : { id: 'order_id', cust: 'customer', sku: 'sku', qty: 'quantity', res: 'reserved_qty', shp: 'shipped_qty', rem: 'remaining', unr: 'unreserved', rdy: 'readiness', due: 'due_at', risk: 'atRisk', sh: 'shortage', st: 'статус' };
    const OPEN_MAP: Record<string, string | string[]> = {
      id: H.id, customer: H.cust, sku: H.sku, qty: H.qty, booked: H.res, ready: H.rdy,
      state: [H.risk, H.sh, H.st],
    };
    const CLOSED_MAP: Record<string, string | string[]> = {
      id: H.id, customer: H.cust, sku: H.sku, qty: H.qty, state: H.st,
    };
    const rows = visibleRows(orderRows(sortedOpen, H), openCols.hidden, OPEN_MAP);
    if (showClosed) rows.push(...visibleRows(orderRows(sortedClosed, H), closedCols.hidden, CLOSED_MAP));
    return rows;
  }

  function exportOrdersCsv() {
    // порядок строк = порядок на экране после сортировки
    downloadCsv(`${lang === 'en' ? 'orders' : 'zakazy'}.csv`, exportRows());
  }

  function exportOrdersJson() {
    downloadJson(`${lang === 'en' ? 'orders' : 'zakazy'}.json`, exportRows());
  }

  return (
    <div>
      <div className="filters-2row">
        <button className="btn-square" onClick={() => setShowNew(true)}><span aria-hidden="true">+</span><span>{t('o_new').replace(/^[+\s]+/, '')}</span></button>
        <div className="filters-col">
          <div className="toolbar">
            <label style={{ flex: '1 1 280px', minWidth: 220 }}>{t('f_search')}
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('f_search_ph')} style={{ flex: 1, width: '100%', minWidth: 220 }} />
            </label>
          </div>
          <div className="toolbar">
            <label>{t('o_state')}
              <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
                <option value="all">{t('o_all')}</option>
                <option value="risk">{t('o_risk')}</option>
                <option value="ok">{t('o_ok')}</option>
                <option value="short">{t('o_short')}</option>
              </select>
            </label>
            <button className="ghost" onClick={exportOrdersCsv} title={t('o_csv_title')}>{t('o_csv')}</button>
            <button className="ghost" onClick={exportOrdersJson} title={t('o_csv_title')}>{t('b_json')}</button>
            <label className="muted">
              <input type="checkbox" checked={showClosed} onChange={(e) => { setShowClosed(e.target.checked); if (e.target.checked) loadClosed(); }} />
              {t('o_closed_show')}
            </label>
          </div>
        </div>
      </div>

      {msg && <div className="info">{msg}</div>}

      {showNew && (
        <div className="card" style={{ borderColor: 'rgba(255,94,0,0.4)' }}>
          <h3><span className="n">＋</span> {t('o_new_h')}</h3>
          <div className="muted">{t('o_new_lead')}</div>
          <div className="form-grid">
            <label>{t('o_customer')}<input value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} placeholder={t('o_customer_ph')} /></label>
            <label>{t('o_product')}
              <ProductPicker products={catalog} value={form.sku} onChange={(sku) => setForm({ ...form, sku })} />
            </label>
            <label>{t('o_qty')}<input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} /></label>
            <label>{t('o_due')}<input type="datetime-local" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} /></label>
          </div>
          <div className="toolbar">
            <button onClick={doCreate}>{t('o_create')}</button>
            <button className="ghost" onClick={() => setShowNew(false)}>{t('o_cancel')}</button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head-row">
          <div className="sp">
            <h3><span className="n">01</span> {t('o_open_h', { n: list.length })}</h3>
            <div className="muted">{t('o_open_lead')}</div>
          </div>
        </div>
        <div className="tbl-wrap">
          <table className="tbl tbl-compact">
            <thead>
              <tr>
                <ColTh label={t('o_th_order')} k="id" skey={skey} dir={dir} onSort={toggle} title={t('sort_title')} checked={!openCols.isOff('id')} onToggle={openCols.toggleCol} />
                <ColTh label={t('o_th_customer')} k="customer" skey={skey} dir={dir} onSort={toggle} title={t('sort_title')} checked={!openCols.isOff('customer')} onToggle={openCols.toggleCol} />
                <ColTh label={t('o_th_product')} k="sku" skey={skey} dir={dir} onSort={toggle} title={t('sort_title')} checked={!openCols.isOff('sku')} onToggle={openCols.toggleCol} />
                <ColTh label={t('o_th_qty')} k="qty" skey={skey} dir={dir} onSort={toggle} title={t('sort_title')} checked={!openCols.isOff('qty')} onToggle={openCols.toggleCol} />
                <ColTh label={t('o_th_booked')} k="booked" skey={skey} dir={dir} onSort={toggle} title={t('sort_title')} checked={!openCols.isOff('booked')} onToggle={openCols.toggleCol} />
                <ColTh label={t('o_th_ready')} k="ready" skey={skey} dir={dir} onSort={toggle} title={t('sort_title')} checked={!openCols.isOff('ready')} onToggle={openCols.toggleCol} />
                <ColTh label={t('o_th_state')} k="state" skey={skey} dir={dir} onSort={toggle} title={t('sort_title')} checked={!openCols.isOff('state')} onToggle={openCols.toggleCol} />
                <th>{t('th_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedOpen.map((o: any) => (
                <tr key={o.order_id} className={o.atRisk ? 'row-risk' : ''}>
                  <td className={openCols.isOff('id') ? 'col-off' : ''}><b>{o.order_id}</b></td>
                  <td className={openCols.isOff('customer') ? 'col-off' : ''}>{o.customer}</td>
                  <td className={openCols.isOff('sku') ? 'col-off' : ''}><span className="cx-tag">{o.sku}</span></td>
                  <td className={openCols.isOff('qty') ? 'mono col-off' : 'mono'}>{o.quantity}</td>
                  <td className={openCols.isOff('booked') ? 'mono col-off' : 'mono'}>{o.reserved_qty}</td>
                  <td className={openCols.isOff('ready') ? 'col-off' : ''}>{o.readiness ? fmtDate(o.readiness) : <span className="badge badge-red">{t('o_short_is', { n: o.shortage })}</span>}</td>
                  <td className={openCols.isOff('state') ? 'col-off' : ''}><RiskBadge atRisk={o.atRisk} shortage={o.shortage} /></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span className="actions-box">
                    <input
                      type="number"
                      min={1}
                      style={{ width: 64 }}
                      title={t('o_qty_title', { n: o.unreserved })}
                      value={qtyMap[o.order_id] ?? ''}
                      placeholder={String(placeholderFor(o))}
                      onChange={(e) => setQtyMap({ ...qtyMap, [o.order_id]: Number(e.target.value) })}
                    />{' '}
                    <button className="ghost small" disabled={o.unreserved <= 0} title={o.unreserved <= 0 ? t('o_all_booked') : `${t('o_reserve')} ${reserveQtyFor(o)}`} onClick={() => doReserve(o)}>{t('o_reserve')}</button>{' '}
                    {(o.shipped_qty ?? 0) > 0 ? (
                      <button className="ghost small" title={t('o_cancel_ship_title', { n: cancelShipQtyFor(o) })} onClick={() => doCancelShip(o)}>{t('o_cancel_ship')}</button>
                    ) : (
                      <button className="ghost small" disabled={o.reserved_qty <= 0} title={o.reserved_qty <= 0 ? t('o_no_book') : `${t('o_ship')} ${shipQtyFor(o)}`} onClick={() => doShip(o)}>{t('o_ship')}</button>
                    )}{' '}
                    {o.reserved_qty > 0 && (
                      <><button className="ghost small" title={t('o_unreserve_title', { n: unreserveQtyFor(o) })} onClick={() => doUnreserve(o)}>{t('o_unreserve')}</button>{' '}</>
                    )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showClosed && (
        <div className="card">
          <h3><span className="n">02</span> {t('o_closed_h')}</h3>
          <div className="tbl-wrap">
            <table className="tbl tbl-compact">
              <thead><tr>
                <ColTh label={t('o_th_num')} k="id" skey={cKey} dir={cDir} onSort={cToggle} title={t('sort_title')} checked={!closedCols.isOff('id')} onToggle={closedCols.toggleCol} />
                <ColTh label={t('o_th_customer')} k="customer" skey={cKey} dir={cDir} onSort={cToggle} title={t('sort_title')} checked={!closedCols.isOff('customer')} onToggle={closedCols.toggleCol} />
                <ColTh label={t('o_th_product')} k="sku" skey={cKey} dir={cDir} onSort={cToggle} title={t('sort_title')} checked={!closedCols.isOff('sku')} onToggle={closedCols.toggleCol} />
                <ColTh label={t('o_th_qty')} k="qty" skey={cKey} dir={cDir} onSort={cToggle} title={t('sort_title')} checked={!closedCols.isOff('qty')} onToggle={closedCols.toggleCol} />
                <ColTh label={t('o_th_state')} k="state" skey={cKey} dir={cDir} onSort={cToggle} title={t('sort_title')} checked={!closedCols.isOff('state')} onToggle={closedCols.toggleCol} />
                <th>{t('th_actions')}</th>
              </tr></thead>
              <tbody>
                {sortedClosed.map((o: any) => (
                  <tr key={o.order_id} className="row-closed">
                    <td className={closedCols.isOff('id') ? 'mono col-off' : 'mono'}>{o.order_id}</td>
                    <td className={closedCols.isOff('customer') ? 'col-off' : ''}>{o.customer}</td>
                    <td className={closedCols.isOff('sku') ? 'col-off' : ''}>{o.sku}</td>
                    <td className={closedCols.isOff('qty') ? 'col-off' : ''}>{o.quantity}</td>
                    <td className={closedCols.isOff('state') ? 'col-off' : ''}><StatusBadge status={o.status} /></td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {o.status === 'shipped' && (o.shipped_qty ?? o.quantity) > 0 && (
                        <button className="ghost small" title={t('o_cancel_ship_title', { n: o.shipped_qty ?? o.quantity })} onClick={() => doCancelShip(o)}>{t('o_cancel_ship')}</button>
                      )}
                    </td>
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

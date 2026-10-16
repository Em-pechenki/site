import { useMemo, useState } from 'react';
import { createShipment, receive, unreceive } from '../api';
import { fmtDate } from '../format';
import { logOp } from '../opslog';
import { useT, useLang } from '../i18n';
import { useSorted, type Accessors } from '../components/SortTable';
import { ColTh, ActTh, useColumns, visibleRows } from '../components/Columns';
import { downloadCsv, downloadJson, stamp } from '../export';
import ProductPicker, { useCatalog } from '../components/ProductPicker';

export default function Shipments({ snapshot, shipmentsAll, onChange }: { snapshot: any; shipmentsAll: any[]; onChange: () => void }) {
  const t = useT();
  const lang = useLang();
  const catalog = useCatalog(snapshot);
  const [msg, setMsg] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ supplier: '', sku: 'FG-AIR', quantity: 10, expected_at: '2026-11-05T10:00' });
  const [stateFilter, setStateFilter] = useState('all');
  const [query, setQuery] = useState('');
  const todoCols = useColumns();
  const doneCols = useColumns();
  const all = shipmentsAll.length ? shipmentsAll : (snapshot?.shipments_expected || []);
  const humanSku = (sku: string) => (sku === 'FG-AIR' ? 'air' : sku === 'FG-PLUS' ? 'air plus' : sku);
  const q = query.trim().toLowerCase();
  // Единый поиск: пусто = все; иначе ищем по номеру, поставщику, SKU и названию товара.
  function passCommon(s: any) {
    if (!q) return true;
    const hay = `${s.shipment_id} ${(s.supplier || '')} ${s.sku} ${humanSku(s.sku)}`.toLowerCase();
    return q.split(/\s+/).every((tok) => hay.includes(tok));
  }
  const now = snapshot?.now;
  const isOverdue = (s: any) => s.status === 'expected' && now && new Date(s.expected_at) < new Date(now);
  let todoBase = all.filter((s: any) => s.status === 'expected').filter(passCommon);
  if (stateFilter === 'late') todoBase = todoBase.filter(isOverdue);
  if (stateFilter === 'ok') todoBase = todoBase.filter((s: any) => !isOverdue(s));
  const doneBase = all.filter((s: any) => s.status !== 'expected').filter(passCommon);

  const shipAcc: Accessors<any> = useMemo(() => ({
    id: (s) => s.shipment_id,
    supplier: (s) => s.supplier || '',
    sku: (s) => s.sku,
    qty: (s) => s.quantity,
    arrives: (s) => s.expected_at,
    state: (s) => (s.status === 'expected' && now && new Date(s.expected_at) < new Date(now) ? 1 : 0),
  }), [now]);
  const { sorted: todo, skey: tdKey, dir: tdDir, toggle: tdToggle } = useSorted(todoBase, shipAcc, 'arrives', 1);
  const { sorted: done, skey: dnKey, dir: dnDir, toggle: dnToggle } = useSorted(doneBase, shipAcc, 'arrives', -1);

  async function doReceive(id: string) {
    setMsg('');
    try {
      await receive(id);
      const s = all.find((x: any) => x.shipment_id === id);
      logOp({ action: 'receive', shipment_id: id, sku: s?.sku, qty: s?.quantity, note: t('log_receive_note', { qty: s?.quantity ?? '' }) });
      setMsg(t('s_received_ok', { id }));
      onChange();
    } catch (e: any) {
      setMsg(t('o_err') + `${e.message}${e.hint ? ' — ' + e.hint : ''}`);
    }
  }

  async function doUnreceive(id: string) {
    setMsg('');
    try {
      await unreceive(id);
      const s = all.find((x: any) => x.shipment_id === id);
      logOp({ action: 'unreceive', shipment_id: id, sku: s?.sku, qty: s?.quantity, note: t('log_unreceive_note', { qty: s?.quantity ?? '' }) });
      setMsg(t('s_unreceived_ok', { id }));
      onChange();
    } catch (e: any) {
      setMsg(t('o_err') + `${e.message}${e.hint ? ' — ' + e.hint : ''}`);
    }
  }

  async function doCreate() {
    setMsg('');
    try {
      const expected_at = form.expected_at.includes('+') || form.expected_at.endsWith('Z') ? form.expected_at : `${form.expected_at}:00+03:00`;
      const r = await createShipment({ supplier: form.supplier || t('s_supplier_ph'), sku: form.sku, quantity: Number(form.quantity), expected_at });
      logOp({ action: 'create_shipment', shipment_id: r.shipment_id, sku: form.sku, qty: Number(form.quantity), note: `${form.supplier || t('s_supplier_ph')} · ${t('log_arrive_word')} ${expected_at}` });
      setShowNew(false);
      setMsg(t('s_created_ok', { id: r.shipment_id }));
      onChange();
    } catch (e: any) {
      setMsg(t('o_err') + `${e.message}${e.hint ? ' — ' + e.hint : ''}`);
    }
  }

  function shipHeads() {
    return { id: t('th_shipment'), sup: t('s_supplier'), sku: t('o_th_product'), qty: t('o_th_qty'), arr: t('th_arrives'), st: t('o_th_state') };
  }

  function shipRows(list: any[], H: Record<string, string>, stateOf: (s: any) => string) {
    return list.map((s: any) => ({
      [H.id]: s.shipment_id,
      [H.sup]: s.supplier || t('s_supplier_def'),
      [H.sku]: s.sku === 'FG-AIR' ? 'air' : 'air plus',
      [H.qty]: s.quantity,
      [H.arr]: fmtDate(s.expected_at),
      [H.st]: stateOf(s),
    }));
  }

  function shipMap(H: Record<string, string>) {
    return { id: H.id, supplier: H.sup, sku: H.sku, qty: H.qty, arrives: H.arr, state: H.st };
  }

  function exportTodoCsv() {
    const H = shipHeads();
    downloadCsv(`${lang === 'en' ? 'inbound_todo' : 'postavki_k_priemke'}_${stamp()}.csv`,
      visibleRows(shipRows(todo, H, (s) => isOverdue(s) ? t('s_overdue_b') : t('s_in_transit')), todoCols.hidden, shipMap(H)));
  }

  function exportTodoJson() {
    downloadJson(`${lang === 'en' ? 'inbound_todo' : 'postavki_k_priemke'}_${stamp()}.json`, todo);
  }

  function exportDoneCsv() {
    const H = shipHeads();
    downloadCsv(`${lang === 'en' ? 'inbound_received' : 'postavki_prinyatye'}_${stamp()}.csv`,
      visibleRows(shipRows(done, H, () => t('s_done_badge')), doneCols.hidden, shipMap(H)));
  }

  function exportDoneJson() {
    downloadJson(`${lang === 'en' ? 'inbound_received' : 'postavki_prinyatye'}_${stamp()}.json`, done);
  }

  return (
    <div>
      <div className="filters-2row">
        <button className="btn-square" onClick={() => setShowNew(true)}><span aria-hidden="true">+</span><span>{t('s_new').replace(/^[+\s]+/, '')}</span></button>
        <div className="filters-col">
          <div className="toolbar">
            <label style={{ flex: '1 1 280px', minWidth: 220 }}>{t('f_search')}
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('f_search_ph')} style={{ flex: 1, width: '100%', minWidth: 220 }} />
            </label>
          </div>
          <div className="toolbar">
            <label>{t('o_state')}
              <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
                <option value="all">{t('o_all')}</option>
                <option value="late">{t('s_overdue_b')}</option>
                <option value="ok">{t('s_in_transit')}</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      {msg && <div className="info">{msg}</div>}

      {showNew && (
        <div className="card" style={{ borderColor: 'rgba(255,94,0,0.4)' }}>
          <h3><span className="n">＋</span> {t('s_new_h')}</h3>
          <div className="muted">{t('s_new_lead')}</div>
          <div className="form-grid">
            <label>{t('s_supplier')}<input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder={t('s_supplier_ph')} /></label>
            <label>{t('s_product')}
              <ProductPicker products={catalog} value={form.sku} onChange={(sku) => setForm({ ...form, sku })} />
            </label>
            <label>{t('s_qty')}<input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} /></label>
            <label>{t('s_arrive')}<input type="datetime-local" value={form.expected_at} onChange={(e) => setForm({ ...form, expected_at: e.target.value })} /></label>
          </div>
          <div className="toolbar">
            <button onClick={doCreate}>{t('s_create')}</button>
            <button className="ghost" onClick={() => setShowNew(false)}>{t('s_cancel')}</button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head-row">
          <div className="sp">
            <h3><span className="n">01</span> {t('s_todo_h', { n: todo.length })}</h3>
            <div className="muted">{t('s_todo_lead')}</div>
          </div>
          <span className="badge badge-blue">{t('s_in_transit')}</span>
        </div>
        <div className="toolbar" style={{ marginTop: 12 }}>
          <button className="ghost" onClick={exportTodoCsv} disabled={!todo.length} title={t('o_csv_title')}>{t('o_csv')}</button>
          <button className="ghost" onClick={exportTodoJson} disabled={!todo.length}>{t('b_json')}</button>
        </div>
        {todo.length === 0 && <div className="muted">{t('s_all_done')}</div>}
        {todo.length > 0 && (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr>
                <ColTh label={t('th_shipment')} k="id" skey={tdKey} dir={tdDir} onSort={tdToggle} title={t('sort_title')} checked={!todoCols.isOff('id')} onToggle={todoCols.toggleCol} />
                <ColTh label={t('s_supplier')} k="supplier" skey={tdKey} dir={tdDir} onSort={tdToggle} title={t('sort_title')} checked={!todoCols.isOff('supplier')} onToggle={todoCols.toggleCol} />
                <ColTh label={t('o_th_product')} k="sku" skey={tdKey} dir={tdDir} onSort={tdToggle} title={t('sort_title')} checked={!todoCols.isOff('sku')} onToggle={todoCols.toggleCol} />
                <ColTh label={t('o_th_qty')} k="qty" skey={tdKey} dir={tdDir} onSort={tdToggle} title={t('sort_title')} checked={!todoCols.isOff('qty')} onToggle={todoCols.toggleCol} />
                <ColTh label={t('th_arrives')} k="arrives" skey={tdKey} dir={tdDir} onSort={tdToggle} title={t('sort_title')} checked={!todoCols.isOff('arrives')} onToggle={todoCols.toggleCol} />
                <ColTh label={t('o_th_state')} k="state" skey={tdKey} dir={tdDir} onSort={tdToggle} title={t('sort_title')} checked={!todoCols.isOff('state')} onToggle={todoCols.toggleCol} />
                <ActTh label={t('th_actions')} k="actions" checked={!todoCols.isOff('actions')} onToggle={todoCols.toggleCol} />
              </tr></thead>
              <tbody>
                {todo.map((s: any) => {
                  const overdue = s.status === 'expected' && now && new Date(s.expected_at) < new Date(now);
                  return (
                    <tr key={s.shipment_id} className={overdue ? 'row-risk' : ''}>
                      <td className={todoCols.isOff('id') ? 'mono col-off' : 'mono'}>{s.shipment_id}</td>
                      <td className={todoCols.isOff('supplier') ? 'col-off' : ''}>{s.supplier || t('s_supplier_def')}</td>
                      <td className={todoCols.isOff('sku') ? 'col-off' : ''}><span className="cx-tag">{s.sku === 'FG-AIR' ? 'air' : 'air plus'}</span></td>
                      <td className={todoCols.isOff('qty') ? 'mono col-off' : 'mono'}>{s.quantity}</td>
                      <td className={todoCols.isOff('arrives') ? 'mono col-off' : 'mono'}>{fmtDate(s.expected_at)}</td>
                      <td className={todoCols.isOff('state') ? 'col-off' : ''}>{overdue
                        ? <span className="badge badge-red">{t('s_overdue_b')}</span>
                        : <span className="badge badge-blue">{t('s_in_transit')}</span>}</td>
                      <td style={{ whiteSpace: 'nowrap' }} className={todoCols.isOff('actions') ? 'col-off' : ''}>
                        <button className="ghost small" onClick={() => doReceive(s.shipment_id)}>{t('s_accept')}</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head-row">
          <div className="sp">
            <h3><span className="n">02</span> {t('s_done_h', { n: done.length })}</h3>
            <div className="muted">{t('s_done_lead')}</div>
          </div>
          <span className="badge badge-gray">{t('s_done_badge')}</span>
        </div>
        <div className="toolbar" style={{ marginTop: 12 }}>
          <button className="ghost" onClick={exportDoneCsv} disabled={!done.length} title={t('o_csv_title')}>{t('o_csv')}</button>
          <button className="ghost" onClick={exportDoneJson} disabled={!done.length}>{t('b_json')}</button>
        </div>
        {done.length === 0 && <div className="muted">{t('s_done_empty')}</div>}
        {done.length > 0 && (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr>
                <ColTh label={t('th_shipment')} k="id" skey={dnKey} dir={dnDir} onSort={dnToggle} title={t('sort_title')} checked={!doneCols.isOff('id')} onToggle={doneCols.toggleCol} />
                <ColTh label={t('s_supplier')} k="supplier" skey={dnKey} dir={dnDir} onSort={dnToggle} title={t('sort_title')} checked={!doneCols.isOff('supplier')} onToggle={doneCols.toggleCol} />
                <ColTh label={t('o_th_product')} k="sku" skey={dnKey} dir={dnDir} onSort={dnToggle} title={t('sort_title')} checked={!doneCols.isOff('sku')} onToggle={doneCols.toggleCol} />
                <ColTh label={t('o_th_qty')} k="qty" skey={dnKey} dir={dnDir} onSort={dnToggle} title={t('sort_title')} checked={!doneCols.isOff('qty')} onToggle={doneCols.toggleCol} />
                <ColTh label={t('th_arrives')} k="arrives" skey={dnKey} dir={dnDir} onSort={dnToggle} title={t('sort_title')} checked={!doneCols.isOff('arrives')} onToggle={doneCols.toggleCol} />
                <ColTh label={t('o_th_state')} k="state" skey={dnKey} dir={dnDir} onSort={dnToggle} title={t('sort_title')} checked={!doneCols.isOff('state')} onToggle={doneCols.toggleCol} />
                <ActTh label={t('th_actions')} k="actions" checked={!doneCols.isOff('actions')} onToggle={doneCols.toggleCol} />
              </tr></thead>
              <tbody>
                {done.map((s: any) => (
                  <tr key={s.shipment_id}>
                    <td className={doneCols.isOff('id') ? 'mono col-off' : 'mono'}>{s.shipment_id}</td>
                    <td className={doneCols.isOff('supplier') ? 'col-off' : ''}>{s.supplier || t('s_supplier_def')}</td>
                    <td className={doneCols.isOff('sku') ? 'col-off' : ''}><span className="cx-tag">{s.sku === 'FG-AIR' ? 'air' : 'air plus'}</span></td>
                    <td className={doneCols.isOff('qty') ? 'mono col-off' : 'mono'}>{s.quantity}</td>
                    <td className={doneCols.isOff('arrives') ? 'mono col-off' : 'mono'}>{fmtDate(s.expected_at)}</td>
                    <td className={doneCols.isOff('state') ? 'col-off' : ''}><span className="badge badge-gray">{t('s_done_badge')}</span></td>
                    <td style={{ whiteSpace: 'nowrap' }} className={doneCols.isOff('actions') ? 'col-off' : ''}>
                      <button className="ghost small" title={t('s_unreceive_title')} onClick={() => doUnreceive(s.shipment_id)}>{t('s_unreceive')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

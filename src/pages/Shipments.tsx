import { useEffect, useMemo, useState } from 'react';
import { createShipment, receive, unreceive, assignShipment, unassignShipment, employees as fetchStaff } from '../api';
import { fmtDate } from '../format';
import { logOp } from '../opslog';
import { useT, useLang } from '../i18n';
import { useSorted, type Accessors } from '../components/SortTable';
import { ColTh, useColumns, visibleRows } from '../components/Columns';
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
  const [staff, setStaff] = useState<any[]>([]);
  const [assignOpen, setAssignOpen] = useState<string | null>(null);
  const [assignPick, setAssignPick] = useState<Record<string, string>>({});
  const [recvOpen, setRecvOpen] = useState<string | null>(null);
  const shipCols = useColumns();
  const all = shipmentsAll.length ? shipmentsAll : (snapshot?.shipments_expected || []);
  const humanSku = (sku: string) => (sku === 'FG-AIR' ? 'air' : sku === 'FG-PLUS' ? 'air plus' : sku);
  const q = query.trim().toLowerCase();
  // Единый поиск: пусто = все; иначе ищем по номеру, поставщику, SKU, названию и приёмщику.
  function passCommon(s: any) {
    if (!q) return true;
    const hay = `${s.shipment_id} ${(s.supplier || '')} ${s.sku} ${humanSku(s.sku)} ${empName(s.assignee)}`.toLowerCase();
    return q.split(/\s+/).every((tok) => hay.includes(tok));
  }
  const now = snapshot?.now;
  const isOverdue = (s: any) => s.status === 'expected' && now && new Date(s.expected_at) < new Date(now);
  const base = all.filter(passCommon).filter((s: any) => {
    if (stateFilter === 'late') return isOverdue(s);
    if (stateFilter === 'todo') return s.status === 'expected' && !isOverdue(s);
    if (stateFilter === 'done') return s.status !== 'expected';
    return true;
  });

  const shipAcc: Accessors<any> = useMemo(() => ({
    id: (s) => s.shipment_id,
    supplier: (s) => s.supplier || '',
    sku: (s) => s.sku,
    qty: (s) => s.quantity,
    arrives: (s) => s.expected_at,
    state: (s) => (s.status !== 'expected' ? 2 : (s.status === 'expected' && now && new Date(s.expected_at) < new Date(now) ? 1 : 0)),
    assignee: (s) => s.assignee || '',
  }), [now]);
  const { sorted: rows, skey: tdKey, dir: tdDir, toggle: tdToggle } = useSorted(base, shipAcc, 'arrives', 1);

  async function loadStaff() {
    try {
      const r = await fetchStaff();
      setStaff(r.employees || []);
    } catch {
      setStaff([]);
    }
  }
  useEffect(() => { loadStaff(); }, []);

  function empName(id: string | null | undefined): string {
    if (!id) return '';
    return staff.find((e: any) => e.id === id)?.name || id;
  }
  const onShift = staff.filter((e: any) => e.on_shift);

  async function doAssign(id: string) {
    const pick = assignPick[id] || 'auto';
    setMsg('');
    try {
      const r = await assignShipment(id, pick === 'auto' ? { auto: true } : { employee_id: pick });
      const s = all.find((x: any) => x.shipment_id === id);
      logOp({ action: 'assign', shipment_id: id, sku: s?.sku, qty: s?.quantity, note: r.employee || r.assignee });
      setMsg(r.auto ? t('s_assign_auto_ok', { id, name: r.employee }) : t('s_assign_ok', { id, name: r.employee }));
      setAssignOpen(null);
      onChange();
      loadStaff();
    } catch (e: any) {
      setMsg(t('o_err') + `${e.message}${e.hint ? ' — ' + e.hint : ''}`);
    }
  }

  function pickOf(id: string) {
    const v = assignPick[id];
    return !v || v === 'auto' ? { auto: true } : { employee_id: v };
  }

  async function doUnassign(id: string) {
    setMsg('');
    try {
      const s = all.find((x: any) => x.shipment_id === id);
      const prev = empName(s?.assignee);
      await unassignShipment(id);
      logOp({ action: 'unassign', shipment_id: id, sku: s?.sku, qty: s?.quantity, note: prev });
      setMsg(t('s_unassigned_ok', { id }));
      onChange();
      loadStaff();
    } catch (e: any) {
      setMsg(t('o_err') + `${e.message}${e.hint ? ' — ' + e.hint : ''}`);
    }
  }

  async function doReceive(id: string, performer?: { employee_id?: string; auto?: boolean }) {
    setMsg('');
    try {
      const r: any = await receive(id, performer);
      const s = all.find((x: any) => x.shipment_id === id);
      const who = r?.performer ? ` · ${r.performer}` : '';
      logOp({ action: 'receive', shipment_id: id, sku: s?.sku, qty: s?.quantity, note: t('log_receive_note', { qty: s?.quantity ?? '' }) + who });
      setMsg(t('s_received_ok', { id }) + who);
      setRecvOpen(null);
      onChange();
      loadStaff();
    } catch (e: any) {
      setMsg(t('o_err') + `${e.message}${e.hint ? ' — ' + e.hint : ''}`);
    }
  }

  async function doUnreceive(id: string, performer?: { employee_id?: string; auto?: boolean }) {
    setMsg('');
    try {
      const r: any = await unreceive(id, performer);
      const s = all.find((x: any) => x.shipment_id === id);
      const who = r?.performer ? ` · ${r.performer}` : '';
      logOp({ action: 'unreceive', shipment_id: id, sku: s?.sku, qty: s?.quantity, note: t('log_unreceive_note', { qty: s?.quantity ?? '' }) + who });
      setMsg(t('s_unreceived_ok', { id }) + who);
      setRecvOpen(null);
      onChange();
      loadStaff();
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

  function stateOf(s: any): string {
    if (s.status !== 'expected') return t('s_done_badge');
    return isOverdue(s) ? t('s_overdue_b') : t('s_in_transit');
  }

  function shipHeads() {
    return { id: t('th_shipment'), sup: t('s_supplier'), sku: t('o_th_product'), qty: t('o_th_qty'), arr: t('th_arrives'), st: t('o_th_state'), who: t('s_th_assignee') };
  }

  function exportCsv() {
    const H = shipHeads();
    downloadCsv(`${lang === 'en' ? 'shipments' : 'postavki'}_${stamp()}.csv`,
      visibleRows(rows.map((s: any) => ({
        [H.id]: s.shipment_id,
        [H.sup]: s.supplier || t('s_supplier_def'),
        [H.sku]: s.sku === 'FG-AIR' ? 'air' : 'air plus',
        [H.qty]: s.quantity,
        [H.arr]: fmtDate(s.expected_at),
        [H.st]: stateOf(s),
        [H.who]: empName(s.assignee) || t('s_unassigned'),
      })), shipCols.hidden, { id: H.id, supplier: H.sup, sku: H.sku, qty: H.qty, arrives: H.arr, state: H.st, assignee: H.who }));
  }

  function exportJson() {
    downloadJson(`${lang === 'en' ? 'shipments' : 'postavki'}_${stamp()}.json`, rows);
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
                <option value="todo">{t('s_filter_todo')}</option>
                <option value="late">{t('s_overdue_b')}</option>
                <option value="done">{t('s_filter_done')}</option>
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
            <h3><span className="n">01</span> {t('s_all_h', { n: rows.length })}</h3>
            <div className="muted">{t('s_all_lead')}</div>
          </div>
          <span className="badge badge-blue">{t('s_in_transit')}</span>
        </div>
        <div className="toolbar" style={{ marginTop: 12 }}>
          <button className="ghost" onClick={exportCsv} disabled={!rows.length} title={t('o_csv_title')}>{t('o_csv')}</button>
          <button className="ghost" onClick={exportJson} disabled={!rows.length}>{t('b_json')}</button>
        </div>
        {rows.length === 0 && <div className="muted">{t('s_all_done')}</div>}
        {rows.length > 0 && (
          <div className="tbl-wrap">
            <table className="tbl tbl-compact">
              <thead><tr>
                <ColTh label={t('th_shipment')} k="id" skey={tdKey} dir={tdDir} onSort={tdToggle} title={t('sort_title')} checked={!shipCols.isOff('id')} onToggle={shipCols.toggleCol} />
                <ColTh label={t('s_supplier')} k="supplier" skey={tdKey} dir={tdDir} onSort={tdToggle} title={t('sort_title')} checked={!shipCols.isOff('supplier')} onToggle={shipCols.toggleCol} />
                <ColTh label={t('o_th_product')} k="sku" skey={tdKey} dir={tdDir} onSort={tdToggle} title={t('sort_title')} checked={!shipCols.isOff('sku')} onToggle={shipCols.toggleCol} />
                <ColTh label={t('o_th_qty')} k="qty" skey={tdKey} dir={tdDir} onSort={tdToggle} title={t('sort_title')} checked={!shipCols.isOff('qty')} onToggle={shipCols.toggleCol} />
                <ColTh label={t('th_arrives')} k="arrives" skey={tdKey} dir={tdDir} onSort={tdToggle} title={t('sort_title')} checked={!shipCols.isOff('arrives')} onToggle={shipCols.toggleCol} />
                <ColTh label={t('o_th_state')} k="state" skey={tdKey} dir={tdDir} onSort={tdToggle} title={t('sort_title')} checked={!shipCols.isOff('state')} onToggle={shipCols.toggleCol} />
                <ColTh label={t('s_th_assignee')} k="assignee" skey={tdKey} dir={tdDir} onSort={tdToggle} title={t('sort_title')} checked={!shipCols.isOff('assignee')} onToggle={shipCols.toggleCol} />
                <th className="col-actions">{t('th_actions')}</th>
              </tr></thead>
              <tbody>
                {rows.map((s: any) => {
                  const overdue = isOverdue(s);
                  const isDone = s.status !== 'expected';
                  const name = empName(s.assignee);
                  return (
                    <tr key={s.shipment_id} className={overdue ? 'row-risk' : ''}>
                      <td className={shipCols.isOff('id') ? 'mono col-off' : 'mono'}>{s.shipment_id}</td>
                      <td className={shipCols.isOff('supplier') ? 'col-off' : ''}>{s.supplier || t('s_supplier_def')}</td>
                      <td className={shipCols.isOff('sku') ? 'col-off' : ''}><span className="cx-tag">{s.sku === 'FG-AIR' ? 'air' : 'air plus'}</span></td>
                      <td className={shipCols.isOff('qty') ? 'mono col-off' : 'mono'}>{s.quantity}</td>
                      <td className={shipCols.isOff('arrives') ? 'mono col-off' : 'mono'}>{fmtDate(s.expected_at)}</td>
                      <td className={shipCols.isOff('state') ? 'col-off' : ''}>{isDone
                        ? <span className="badge badge-gray">{t('s_done_badge')}</span>
                        : overdue
                          ? <span className="badge badge-red">{t('s_overdue_b')}</span>
                          : <span className="badge badge-blue">{t('s_in_transit')}</span>}</td>
                      <td className={shipCols.isOff('assignee') ? 'col-off' : ''}>{name || <span className="muted">{t('s_unassigned')}</span>}</td>
                      <td style={{ whiteSpace: 'nowrap' }} className="col-actions">
                        <span className="actions-row">
                          {!isDone && (
                            assignOpen === s.shipment_id ? (
                              <>
                                <select
                                  value={assignPick[s.shipment_id] || 'auto'}
                                  onChange={(e) => setAssignPick({ ...assignPick, [s.shipment_id]: e.target.value })}
                                  title={t('s_assign')}
                                >
                                  <option value="auto">{t('s_assign_auto')}</option>
                                  {onShift.map((e: any) => (
                                    <option key={e.id} value={e.id}>{e.name}</option>
                                  ))}
                                </select>
                                <button className="ghost small" onClick={() => doAssign(s.shipment_id)}>{name ? t('s_reassign') : t('s_assign')}</button>
                                <button className="ghost small" onClick={() => setAssignOpen(null)}>{t('s_assign_cancel')}</button>
                              </>
                            ) : recvOpen === `${s.shipment_id}|receive` ? (
                              <>
                                <select
                                  value={assignPick[s.shipment_id] || 'auto'}
                                  onChange={(e) => setAssignPick({ ...assignPick, [s.shipment_id]: e.target.value })}
                                  title={t('s_assign')}
                                >
                                  <option value="auto">{t('s_assign_auto')}</option>
                                  {onShift.map((e: any) => (
                                    <option key={e.id} value={e.id}>{e.name}</option>
                                  ))}
                                </select>
                                <button className="ghost small" onClick={() => doReceive(s.shipment_id, pickOf(s.shipment_id))}>{t('s_accept')}</button>
                                <button className="ghost small" onClick={() => setRecvOpen(null)}>{t('s_assign_cancel')}</button>
                              </>
                            ) : (
                              <>
                                <button className="ghost small" onClick={() => setAssignOpen(s.shipment_id)}>{name ? t('s_reassign') : t('s_assign')}</button>
                                {name && (
                                  <button className="ghost small" title={t('s_unassign_title')} onClick={() => doUnassign(s.shipment_id)}>{t('s_unassign')}</button>
                                )}
                                <button className="ghost small" onClick={() => setRecvOpen(`${s.shipment_id}|receive`)}>{t('s_accept')}</button>
                              </>
                            )
                          )}
                          {isDone && (
                            recvOpen === `${s.shipment_id}|unreceive` ? (
                              <>
                                <select
                                  value={assignPick[s.shipment_id] || 'auto'}
                                  onChange={(e) => setAssignPick({ ...assignPick, [s.shipment_id]: e.target.value })}
                                  title={t('s_assign')}
                                >
                                  <option value="auto">{t('s_assign_auto')}</option>
                                  {onShift.map((e: any) => (
                                    <option key={e.id} value={e.id}>{e.name}</option>
                                  ))}
                                </select>
                                <button className="ghost small" title={t('s_unreceive_title')} onClick={() => doUnreceive(s.shipment_id, pickOf(s.shipment_id))}>{t('s_unreceive')}</button>
                                <button className="ghost small" onClick={() => setRecvOpen(null)}>{t('s_assign_cancel')}</button>
                              </>
                            ) : (
                              <button className="ghost small" title={t('s_unreceive_title')} onClick={() => setRecvOpen(`${s.shipment_id}|unreceive`)}>{t('s_unreceive')}</button>
                            )
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

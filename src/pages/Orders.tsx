import { useState } from 'react';
import { createOrder, reserve, ship, orders as fetchOrders } from '../api';
import { fmtDate } from '../format';
import { RiskBadge, StatusBadge } from '../components/Badges';

export default function Orders({ snapshot, onChange }: { snapshot: any; onChange: () => void }) {
  const [skuFilter, setSkuFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [showClosed, setShowClosed] = useState(false);
  const [closed, setClosed] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ customer: '', sku: 'FG-AIR', quantity: 5, due_at: '2026-11-03T17:00' });

  if (!snapshot) return <div className="card">Загрузка…</div>;
  let list: any[] = snapshot.orders_active || [];
  if (skuFilter !== 'all') list = list.filter((o) => o.sku === skuFilter);
  if (riskFilter === 'risk') list = list.filter((o) => o.atRisk);
  if (riskFilter === 'ok') list = list.filter((o) => !o.atRisk);
  if (riskFilter === 'short') list = list.filter((o) => (o.shortage || 0) > 0);

  async function loadClosed() {
    try {
      const all = await fetchOrders('all');
      setClosed(all.filter((o: any) => o.status !== 'active'));
    } catch (e: any) {
      setMsg('Не удалось загрузить закрытые: ' + e.message);
    }
  }

  async function doReserve(id: string) {
    const v = prompt(`Резерв для ${id}: сколько?`, '1');
    if (v === null) return;
    const qty = Number(v);
    setMsg('');
    try {
      await reserve(id, qty);
      setMsg(`Резерв ${qty} для ${id} — ок. Свободный запас уменьшен.`);
      onChange();
    } catch (e: any) {
      setMsg(`Ошибка: ${e.message}${e.hint ? ' — ' + e.hint : ''}`);
    }
  }

  async function doShip(id: string) {
    const v = prompt(`Отгрузка для ${id}: сколько?`, '1');
    if (v === null) return;
    const qty = Number(v);
    setMsg('');
    try {
      await ship(id, qty);
      setMsg(`Отгружено ${qty} для ${id}.`);
      onChange();
    } catch (e: any) {
      setMsg(`Ошибка: ${e.message}${e.hint ? ' — ' + e.hint : ''}`);
    }
  }

  async function doCreate() {
    setMsg('');
    try {
      const due_at = form.due_at.includes('+') || form.due_at.endsWith('Z') ? form.due_at : `${form.due_at}:00+03:00`;
      await createOrder({ customer: form.customer || 'Новый клиент', sku: form.sku, quantity: Number(form.quantity), due_at });
      setShowNew(false);
      setMsg('Заказ создан — готовность пересчитана от свободных и входящих.');
      onChange();
    } catch (e: any) {
      setMsg(`Ошибка: ${e.message}${e.hint ? ' — ' + e.hint : ''}`);
    }
  }

  return (
    <div>
      <div className="toolbar">
        <label>SKU
          <select value={skuFilter} onChange={(e) => setSkuFilter(e.target.value)}>
            <option value="all">все</option>
            <option value="FG-AIR">FG-AIR</option>
            <option value="FG-PLUS">FG-PLUS</option>
          </select>
        </label>
        <label>Статус
          <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
            <option value="all">все</option>
            <option value="risk">в риске</option>
            <option value="ok">в срок</option>
            <option value="short">с нехваткой</option>
          </select>
        </label>
        <button onClick={() => setShowNew(true)}>+ Новый заказ</button>
        <label className="muted">
          <input type="checkbox" checked={showClosed} onChange={(e) => { setShowClosed(e.target.checked); if (e.target.checked) loadClosed(); }} />
          shipped / cancelled
        </label>
        <span style={{ marginLeft: 'auto' }} className="badge badge-gray">{list.length} активных</span>
      </div>

      {msg && <div className="info">{msg}</div>}

      {showNew && (
        <div className="card" style={{ borderColor: 'rgba(129,140,248,0.4)' }}>
          <h3><span className="n">＋</span> Новый заказ</h3>
          <div className="muted">Создаётся со сроком в МСК. Готовность посчитается автоматически.</div>
          <div className="form-grid">
            <label>Клиент<input value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} placeholder="Новый клиент" /></label>
            <label>SKU
              <select value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}>
                <option value="FG-AIR">FG-AIR · Air</option>
                <option value="FG-PLUS">FG-PLUS · Air Plus</option>
              </select>
            </label>
            <label>Кол-во<input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} /></label>
            <label>Срок, МСК<input type="datetime-local" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} /></label>
          </div>
          <div className="toolbar">
            <button onClick={doCreate}>Создать ›</button>
            <button className="ghost" onClick={() => setShowNew(false)}>Отмена</button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head-row">
          <div className="sp">
            <h3><span className="n">01</span> Активные · {list.length}</h3>
            <div className="muted">Резерв — из свободного запаса. Отгрузка — только из резерва. Ошибки возвращают hint.</div>
          </div>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Заказ</th><th>Клиент</th><th>SKU</th><th>qty</th><th>резерв</th><th>готовность</th><th>статус</th><th></th></tr>
            </thead>
            <tbody>
              {list.map((o: any) => (
                <tr key={o.order_id} className={o.atRisk ? 'row-risk' : ''}>
                  <td><b>{o.order_id}</b><div className="sub">отгр. {o.shipped_qty}</div></td>
                  <td>{o.customer}</td>
                  <td><span className="cx-tag">{o.sku}</span></td>
                  <td className="mono">{o.quantity}</td>
                  <td className="mono">{o.reserved_qty}</td>
                  <td>{o.readiness ? fmtDate(o.readiness) : <span className="badge badge-red">не хватает {o.shortage}</span>}</td>
                  <td><RiskBadge atRisk={o.atRisk} shortage={o.shortage} /></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="ghost small" onClick={() => doReserve(o.order_id)}>Резерв</button>{' '}
                    <button className="ghost small" onClick={() => doShip(o.order_id)}>Отгрузить</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="muted" style={{ marginTop: 10 }}>На выходе <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ok)' }}>готовность каждого заказа + список рисков</span></div>
      </div>

      {showClosed && (
        <div className="card">
          <h3><span className="n">02</span> Закрытые</h3>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>ID</th><th>Клиент</th><th>SKU</th><th>qty</th><th>статус</th></tr></thead>
              <tbody>
                {closed.map((o: any) => (
                  <tr key={o.order_id} className="row-closed">
                    <td className="mono">{o.order_id}</td><td>{o.customer}</td><td>{o.sku}</td><td>{o.quantity}</td>
                    <td><StatusBadge status={o.status} /></td>
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

import { useState } from 'react';
import { receive } from '../api';
import { fmtDate } from '../format';

export default function Shipments({ snapshot, shipmentsAll, onChange }: { snapshot: any; shipmentsAll: any[]; onChange: () => void }) {
  const [msg, setMsg] = useState('');
  const list = shipmentsAll.length ? shipmentsAll : (snapshot?.shipments_expected || []);
  const now = snapshot?.now;

  async function doReceive(id: string) {
    setMsg('');
    try {
      await receive(id);
      setMsg(`Поставка ${id} получена — qty оприходован на склад один раз.`);
      onChange();
    } catch (e: any) {
      setMsg(`Ошибка: ${e.message}${e.hint ? ' — ' + e.hint : ''}`);
    }
  }

  return (
    <div>
      <div className="card">
        <div className="card-head-row">
          <div className="sp">
            <h3><span className="n">01</span> Поставки · {list.length}</h3>
            <div className="muted">Получение приходует qty на склад один раз. Повтор отклоняется. Просрочка без received — вне прогноза.</div>
          </div>
          <span className="badge badge-blue">expected</span>
        </div>
        {msg && <div className="info">{msg}</div>}
        <div className="cx-rows">
          {list.map((s: any) => {
            const overdue = s.status === 'expected' && now && new Date(s.expected_at) < new Date(now);
            return (
              <div className={overdue ? 'cx-row risk' : 'cx-row'} key={s.shipment_id}>
                <span className={overdue ? 'cx-ic bad' : 'cx-ic cx-ic--accent'}>
                  <svg viewBox="0 0 50 30" fill="currentColor" aria-hidden="true"><path d="M10 19.96h10v-9.92h10v10H20v9.92H10v-9.92H0v-10h10zm40 .08H40v9.92h-9.999v-10H40v-9.92h10zM20 10H10V0h10zM40 0v10h-9.999V0z" /></svg>
                </span>
                <div className="cx-row-main">
                  <b>{s.shipment_id}</b>
                  <span>{s.supplier || 'поставщик'} · {s.sku} × {s.quantity} · {fmtDate(s.expected_at)}{overdue ? ' · просрочена — вне прогноза' : ''}</span>
                </div>
                <div className="cx-row-meta">
                  <span className={overdue ? 'badge badge-red' : 'badge badge-blue'}>{overdue ? 'просрочена' : s.status}</span>
                  {s.status === 'expected'
                    ? <button className="ghost small" onClick={() => doReceive(s.shipment_id)}>Получить ›</button>
                    : <span className="muted">—</span>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="muted" style={{ marginTop: 12 }}>На выходе <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ok)' }}>оприходованный остаток + обновлённая готовность</span></div>
      </div>
    </div>
  );
}

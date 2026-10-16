// Журнал бизнес-операций: кто/когда/что зарезервировал и отгрузил.
// Хранится в localStorage — работает и в демо-режиме на GitHub Pages,
// где живого backend нет и записи иначе терялись бы при перезагрузке.

export type OpAction = 'reserve' | 'ship' | 'receive' | 'create_order' | 'create_shipment'
  | 'unreserve' | 'cancel_ship' | 'unreceive' | 'cancel_batch';

export interface OpEntry {
  ts: string; // ISO
  actor: string;
  action: OpAction;
  order_id?: string;
  shipment_id?: string;
  sku?: string;
  qty?: number;
  note?: string;
}

const KEY = 'yabloki-ops-log-v1';

function readRaw(): OpEntry[] {
  try {
    const txt = localStorage.getItem(KEY);
    if (!txt) return [];
    const arr = JSON.parse(txt);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function notify() {
  try {
    window.dispatchEvent(new CustomEvent('opslog-change'));
  } catch {
    /* noop */
  }
}

export function getOps(): OpEntry[] {
  return readRaw().sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
}

export function onOpsChange(cb: () => void): () => void {
  const h = () => cb();
  window.addEventListener('opslog-change', h);
  window.addEventListener('storage', h);
  return () => {
    window.removeEventListener('opslog-change', h);
    window.removeEventListener('storage', h);
  };
}

export function logOp(e: Omit<OpEntry, 'ts' | 'actor'> & { actor?: string }): OpEntry {
  const entry: OpEntry = {
    ts: new Date().toISOString(),
    actor: e.actor || 'оператор',
    action: e.action,
    order_id: e.order_id,
    shipment_id: e.shipment_id,
    sku: e.sku,
    qty: e.qty,
    note: e.note,
  };
  const arr = readRaw();
  arr.push(entry);
  // держим последние 300 записей, чтобы не раздувать localStorage
  const trimmed = arr.slice(-300);
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* переполнен — чистим наполовину */
    try {
      localStorage.setItem(KEY, JSON.stringify(trimmed.slice(-120)));
    } catch { /* noop */ }
  }
  notify();
  return entry;
}

export function clearOps() {
  try {
    localStorage.removeItem(KEY);
  } catch { /* noop */ }
  notify();
}

export const OP_ACTION_LABEL: Record<OpAction, string> = {
  reserve: 'резерв',
  ship: 'отгрузка',
  receive: 'приёмка',
  create_order: 'новый заказ',
  create_shipment: 'новая поставка',
  unreserve: 'снятие брони',
  cancel_ship: 'отмена отгрузки',
  unreceive: 'возврат в путь',
  cancel_batch: 'отмена партии',
};

// Локализованные подписи действий (журнал и выгрузки).
export function opActionLabel(action: OpAction, lang: 'ru' | 'en'): string {
  const map: Record<OpAction, { ru: string; en: string }> = {
    reserve: { ru: 'резерв', en: 'reserve' },
    ship: { ru: 'отгрузка', en: 'shipment' },
    receive: { ru: 'приёмка', en: 'receiving' },
    create_order: { ru: 'новый заказ', en: 'new order' },
    create_shipment: { ru: 'новая поставка', en: 'new inbound' },
    unreserve: { ru: 'снятие брони', en: 'unreserve' },
    cancel_ship: { ru: 'отмена отгрузки', en: 'shipment cancelled' },
    unreceive: { ru: 'возврат в путь', en: 'back to transit' },
    cancel_batch: { ru: 'отмена партии', en: 'batch cancelled' },
  };
  return (map[action] || { ru: action, en: action })[lang];
}

export function opActor(lang: 'ru' | 'en'): string {
  return lang === 'en' ? 'operator' : 'оператор';
}

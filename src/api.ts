// fetch-обёртка к бэкенду + автоматический fallback на mock.ts
import * as mock from './mock';
import { getToken } from './auth';

// Адрес бэкенда подбираем автоматически: перебираем кандидатов и берём того,
// кто ответил на /api/health. Так одни и те же исходники работают и локально,
// и по LAN-адресу (когда сайт отдаёт сам бэкенд, http://192.168.x.x:8000),
// и на статике без сервера (тогда всё уходит в демо + прямой вызов модели).
const ENV_API = ((import.meta.env.VITE_API_URL as string) || '').replace(/\/+$/, '');

// Ручное подключение сервера из демо-режима: ?api=https://host... или кнопка
// «Подключить сервер» в баннере. Хранится в этом браузере.
const LS_API_KEY = 'yabloki-api-url';

function readQueryApi(): string {
  try {
    const u = new URLSearchParams(window.location.search).get('api') || '';
    return u.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function readStoredApi(): string {
  try {
    return (localStorage.getItem(LS_API_KEY) || '').replace(/\/+$/, '');
  } catch {
    return '';
  }
}

export function getApiOverride(): string {
  return readQueryApi() || readStoredApi();
}

export function setApiOverride(url: string) {
  try {
    const v = (url || '').trim().replace(/\/+$/, '');
    if (v) localStorage.setItem(LS_API_KEY, v);
    else localStorage.removeItem(LS_API_KEY);
  } catch { /* noop */ }
  baseProbe = null;
}

export function clearApiOverride() {
  try {
    localStorage.removeItem(LS_API_KEY);
  } catch { /* noop */ }
  baseProbe = null;
}

export function getApiBase(): string {
  return BASE;
}

function candidateBases(): string[] {
  const out: string[] = [];
  const add = (u: string) => {
    const v = (u || '').replace(/\/+$/, '');
    if (v && !out.includes(v)) out.push(v);
  };
  add(getApiOverride());
  add(ENV_API);
  // страницу отдал сам бэкенд? тогда её origin и есть нужный адрес
  if (location.origin && location.origin !== 'null') add(location.origin);
  add('http://localhost:8000');
  add('http://127.0.0.1:8000');
  const h = location.hostname;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.endsWith('.local')) add(`http://${h}:8000`);
  return out;
}

let BASE = candidateBases()[0] || 'http://localhost:8000';
let baseProbe: Promise<string> | null = null;
let baseProbedAt = 0;
// Отвечал ли хоть один кандидат на /api/health.
// false = чистая статика без бэкенда (GitHub Pages): ошибки 4xx от хостинга
// (POST запрещён → 405) — не повод пугать «старым сервером», уходим в мок.
let apiAlive = false;
export function isApiAlive() { return apiAlive; }

function pingApi(base: string, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => { ctrl.abort(); resolve(false); }, timeoutMs);
    fetch(`${base}/api/health`, { signal: ctrl.signal })
      .then(async (r) => {
        clearTimeout(t);
        // Статика (GitHub Pages) может отдать index.html с 200 — это не API.
        if (!r.ok) { resolve(false); return; }
        try {
          const d: any = await r.clone().json();
          resolve(d && (d.ok === true || typeof d.now === 'string'));
        } catch {
          resolve(false);
        }
      })
      .catch(() => { clearTimeout(t); resolve(false); });
  });
}

async function resolveBase(): Promise<string> {
  const cands = candidateBases();
  if (baseProbe && Date.now() - baseProbedAt < 15000) return baseProbe;
  baseProbedAt = Date.now();
  baseProbe = (async () => {
    for (const c of cands) {
      if (await pingApi(c)) { BASE = c; apiAlive = true; return c; }
    }
    apiAlive = false;
    return cands[0] || BASE; // никто не ответил — уйдём в демо-режим
  })();
  return baseProbe;
}

let mockMode = false;
const listeners = new Set<(v: boolean) => void>();
export function isMockMode() { return mockMode; }
export function onMockMode(cb: (v: boolean) => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
function setMock(v: boolean) {
  if (mockMode !== v) { mockMode = v; listeners.forEach((cb) => cb(v)); }
}

async function req(path: string, init?: RequestInit, timeoutMs = 4000): Promise<any> {
  const base = await resolveBase();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  let netFail = false;
  try {
    const token = getToken();
    const r = await fetch(`${base}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers || {}),
      },
    });
    const text = await r.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (isHtmlNotApi(data, path)) {
      // Статика отдала HTML вместо API — считаем сетевой ошибкой и уходим в демо.
      throw new TypeError('fetch: not an api response');
    }
    if (!r.ok) {
      const err: any = new Error(data?.error || data?.detail || `HTTP ${r.status}`);
      err.status = r.status;
      err.hint = data?.hint || '';
      if ((r.status === 404 || r.status === 405) && path.startsWith('/api/auth/') && !err.hint) {
        // Роут есть в коде, но сервер его не знает — запущен старый backend
        // без авторизации. На чистой статике (GitHub Pages) этот хинт не
        // показываем: там бэкенда нет вовсе, auth уйдёт в мок (см. ниже).
        if (apiAlive) {
          err.hint = 'похоже, сервер запущен из старого кода: остановите START-LAN (Ctrl+C) и запустите заново';
        }
      }
      err.data = data;
      throw err;
    }
    setMock(false);
    return data;
  } catch (e: any) {
    netFail = isNetwork(e);
    throw e;
  } finally {
    clearTimeout(t);
    // адрес мог перестать отвечать (сервер выключили/включили) — подберём заново
    if (netFail) baseProbe = null;
  }
}

function isHtmlNotApi(data: any, path: string): boolean {
  return typeof data === 'string' && path.startsWith('/api/');
}

function mockError(e: any): never {
  const err: any = new Error(e.message || 'Ошибка демо-данных');
  err.status = e.status || 400;
  err.hint = e.hint || '';
  throw err;
}

// Гарантируем загрузку мока заранее (для fallback)
let mockReady = mock.ensureMockLoaded();

export async function health() {
  try { return await req('/api/health'); }
  catch {
    await mockReady;
    setMock(true);
    return mock.mockHealth();
  }
}

export async function snapshot() {
  try { return await req('/api/snapshot'); }
  catch { await mockReady; setMock(true); return mock.buildSnapshot(); }
}

export async function orders(status = 'active') {
  try { return await req(`/api/orders?status=${encodeURIComponent(status)}`); }
  catch { await mockReady; setMock(true); return mock.mockOrders(status); }
}

export async function shipments() {
  try { return await req('/api/shipments'); }
  catch { await mockReady; setMock(true); return mock.mockShipments(); }
}

export async function createOrder(body: { customer: string; sku: string; quantity: number; due_at: string }) {
  try { return await req('/api/orders', { method: 'POST', body: JSON.stringify(body) }); }
  catch (e: any) {
    if (e?.status && e.status !== 0 && !isNetwork(e)) throw e;
    await mockReady; setMock(true);
    try { return mock.mockCreateOrder(body); } catch (m: any) { mockError(m); }
  }
}

function isNetwork(e: any) {
  return e?.name === 'AbortError' || e?.name === 'TypeError' || e?.status === undefined || String(e?.message || '').includes('fetch') || String(e?.message || '').includes('Failed');
}

export async function reserve(orderId: string, qty: number) {
  try { return await req(`/api/orders/${encodeURIComponent(orderId)}/reserve`, { method: 'POST', body: JSON.stringify({ qty }) }); }
  catch (e: any) {
    if (e?.status && e.status >= 400 && e.status < 500 && !mockMode) {
      // пробуем понять: это реальный 400 бэкенда или сеть? сеть не имеет status.
      throw e;
    }
    if (e?.status && !isNetwork(e) && !mockModeFallbackNeeded()) throw e;
    await mockReady; setMock(true);
    try { return mock.mockReserve(orderId, qty); } catch (m: any) { mockError(m); }
  }
}

function mockModeFallbackNeeded() {
  // если BASE недоступен — req бросит TypeError без status; тогда идём в мок
  return true;
}

export type PerformerOpts = { employee_id?: string; auto?: boolean };

function performerBody(opts?: PerformerOpts) {
  return { employee_id: opts?.employee_id ?? null, auto: opts?.auto ?? false };
}

export async function ship(orderId: string, qty: number, performer?: PerformerOpts) {
  try { return await req(`/api/orders/${encodeURIComponent(orderId)}/ship`, { method: 'POST', body: JSON.stringify({ qty, ...performerBody(performer) }) }); }
  catch (e: any) {
    if (e?.status >= 400 && e?.status < 500 && !mockMode && e?.hint !== undefined && String(e?.message || '').length > 0 && !isNetwork(e)) {
      // реальный ответ API с ошибкой валидации — пробрасываем
      if (e.status) throw e;
    }
    await mockReady; setMock(true);
    try { return mock.mockShip(orderId, qty, performer?.employee_id, performer?.auto); } catch (m: any) { mockError(m); }
  }
}

export async function receive(shipmentId: string, performer?: PerformerOpts) {
  try { return await req(`/api/shipments/${encodeURIComponent(shipmentId)}/receive`, { method: 'POST', body: JSON.stringify(performerBody(performer)) }); }
  catch (e: any) {
    if (e?.status >= 400 && e?.status < 500 && !isNetwork(e) && !mockMode) throw e;
    await mockReady; setMock(true);
    try { return mock.mockReceive(shipmentId, performer?.employee_id, performer?.auto); } catch (m: any) { mockError(m); }
  }
}

export async function unreceive(shipmentId: string, performer?: PerformerOpts) {
  try { return await req(`/api/shipments/${encodeURIComponent(shipmentId)}/cancel-receive`, { method: 'POST', body: JSON.stringify(performerBody(performer)) }); }
  catch (e: any) {
    if (e?.status >= 400 && e?.status < 500 && !isNetwork(e) && !mockMode) throw e;
    await mockReady; setMock(true);
    try { return mock.mockUnreceive(shipmentId, performer?.employee_id, performer?.auto); } catch (m: any) { mockError(m); }
  }
}

export async function unreserve(orderId: string, qty: number) {
  try { return await req(`/api/orders/${encodeURIComponent(orderId)}/unreserve`, { method: 'POST', body: JSON.stringify({ qty }) }); }
  catch (e: any) {
    if (e?.status && e.status >= 400 && e.status < 500 && !isNetwork(e) && !mockMode) throw e;
    await mockReady; setMock(true);
    try { return mock.mockUnreserve(orderId, qty); } catch (m: any) { mockError(m); }
  }
}

export async function cancelShip(orderId: string, qty: number, performer?: PerformerOpts) {
  try { return await req(`/api/orders/${encodeURIComponent(orderId)}/cancel-ship`, { method: 'POST', body: JSON.stringify({ qty, ...performerBody(performer) }) }); }
  catch (e: any) {
    if (e?.status && e.status >= 400 && e.status < 500 && !isNetwork(e) && !mockMode) throw e;
    await mockReady; setMock(true);
    try { return mock.mockCancelShip(orderId, qty, performer?.employee_id, performer?.auto); } catch (m: any) { mockError(m); }
  }
}

export async function createShipment(body: { supplier: string; sku: string; quantity: number; expected_at: string }) {
  try { return await req('/api/shipments', { method: 'POST', body: JSON.stringify(body) }); }
  catch (e: any) {
    if (e?.status >= 400 && e?.status < 500 && !isNetwork(e) && !mockMode) throw e;
    await mockReady; setMock(true);
    try { return mock.mockCreateShipment(body); } catch (m: any) { mockError(m); }
  }
}

export async function delayScenario(shipment_id: string, new_expected_at: string) {
  try { return await req('/api/scenarios/delay', { method: 'POST', body: JSON.stringify({ shipment_id, new_expected_at }) }); }
  catch (e: any) {
    if (e?.status >= 400 && e?.status < 500 && !isNetwork(e) && !mockMode) throw e;
    await mockReady; setMock(true);
    try { return mock.mockDelay(shipment_id, new_expected_at); } catch (m: any) { mockError(m); }
  }
}

export async function employees() {
  try { return await req('/api/employees'); }
  catch { await mockReady; setMock(true); return mock.mockEmployees(); }
}

export async function assignShipment(shipmentId: string, opts?: { employee_id?: string; auto?: boolean }) {
  const body = { employee_id: opts?.employee_id ?? null, auto: opts?.auto ?? !opts?.employee_id };
  try { return await req(`/api/shipments/${encodeURIComponent(shipmentId)}/assign`, { method: 'POST', body: JSON.stringify(body) }); }
  catch (e: any) {
    if (e?.status >= 400 && e?.status < 500 && !isNetwork(e) && !mockMode) throw e;
    await mockReady; setMock(true);
    try { return mock.mockAssign(shipmentId, opts?.employee_id, body.auto); } catch (m: any) { mockError(m); }
  }
}

export async function unassignShipment(shipmentId: string) {
  try { return await req(`/api/shipments/${encodeURIComponent(shipmentId)}/unassign`, { method: 'POST' }); }
  catch (e: any) {
    if (e?.status >= 400 && e?.status < 500 && !isNetwork(e) && !mockMode) throw e;
    await mockReady; setMock(true);
    try { return mock.mockUnassign(shipmentId); } catch (m: any) { mockError(m); }
  }
}

export async function prodStatus() {
  try { return await req('/api/production/status'); }
  catch { await mockReady; setMock(true); return mock.mockProdStatus(); }
}

export async function prodPlan(finished_sku: string, batch_qty: number, start_from?: string) {
  try { return await req('/api/production/plan', { method: 'POST', body: JSON.stringify({ finished_sku, batch_qty, start_from }) }); }
  catch (e: any) {
    if (e?.status >= 400 && e?.status < 500 && !isNetwork(e) && !mockMode) throw e;
    await mockReady; setMock(true);
    try { return mock.planProduction(finished_sku, batch_qty, start_from); } catch (m: any) { mockError(m); }
  }
}

export async function prodStart(finished_sku: string, batch_qty: number, performer?: PerformerOpts) {
  try { return await req('/api/production/start', { method: 'POST', body: JSON.stringify({ finished_sku, batch_qty, ...performerBody(performer) }) }); }
  catch (e: any) {
    if ((e?.status === 400 || e?.status === 404 || e?.status === 409) && !isNetwork(e) && !mockMode) throw e;
    await mockReady; setMock(true);
    try { return mock.mockProdStart(finished_sku, batch_qty, performer?.employee_id, performer?.auto); } catch (m: any) { mockError(m); }
  }
}

export async function prodCancel() {
  try { return await req('/api/production/cancel', { method: 'POST' }); }
  catch (e: any) {
    if ((e?.status === 400 || e?.status === 404) && !isNetwork(e) && !mockMode) throw e;
    await mockReady; setMock(true);
    try { return mock.mockProdCancel(); } catch (m: any) { mockError(m); }
  }
}

export async function aiAsk(question: string, scenario?: { shipment_id: string; new_expected_at: string }, persona: 'analyst' | 'consultant' = 'analyst', history: { role: string; content: string }[] = [], lang: 'ru' | 'en' = 'ru') {
  try { return await req('/api/ai/ask', { method: 'POST', body: JSON.stringify({ question, scenario: scenario ?? null, persona, history, lang }) }, 90000); }
  catch (e: any) {
    if (e?.status >= 400 && e?.status < 500 && !isNetwork(e) && !mockMode) throw e;
    await mockReady; setMock(true);
    return mock.mockAiAsk(question, scenario, persona, history, lang);
  }
}

export async function adminReset(fixture: 'simple' | 'extended') {
  try { return await req(`/api/admin/reset?fixture=${fixture}`, { method: 'POST' }); }
  catch {
    await mockReady; setMock(true);
    const snap = mock.mockReset(fixture);
    return { ok: true, fixture, snapshot: snap };
  }
}

export async function register(name: string, email: string, password: string) {
  try {
    return await req('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
  } catch (e: any) {
    // Ошибка валидации живого бэкенда — показываем; иначе (статика без API,
    // сервер недоступен) молча уходим в локальный демо-вход.
    if (isApiAlive() && e?.status && !isNetwork(e)) throw e;
    await mockReady;
    setMock(true);
    try {
      return mock.mockRegister(name, email, password);
    } catch (m: any) {
      mockError(m);
    }
  }
}

export async function login(email: string, password: string) {
  try {
    return await req('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  } catch (e: any) {
    // см. register: 4xx живого бэкенда — наружу, статика — в мок.
    if (isApiAlive() && e?.status && !isNetwork(e)) throw e;
    await mockReady;
    setMock(true);
    try {
      return mock.mockLogin(email, password);
    } catch (m: any) {
      mockError(m);
    }
  }
}

/** Обход для тестового показа заказчикам: вход как админ без пароля. */
export async function demoAdminLogin() {
  try {
    return await req('/api/auth/demo', { method: 'POST' });
  } catch (e: any) {
    // см. register: 4xx живого бэкенда — наружу, статика — в мок.
    if (isApiAlive() && e?.status && !isNetwork(e)) throw e;
    await mockReady;
    setMock(true);
    return mock.mockDemoAdmin();
  }
}

export async function me() {
  return await req('/api/auth/me');
}

export async function logout() {
  try {
    await req('/api/auth/logout', { method: 'POST' });
  } catch {
    /* noop — локальный выход всё равно выполняем */
  }
}

export const API_BASE = BASE;

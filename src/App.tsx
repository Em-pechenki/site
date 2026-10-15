import { useCallback, useEffect, useMemo, useState } from 'react';
import { snapshot as fetchSnapshot, shipments as fetchShipments, adminReset, isMockMode, onMockMode } from './api';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Shipments from './pages/Shipments';
import Scenario from './pages/Scenario';
import Production from './pages/Production';
import AiChat from './components/AiChat';
import Landing from './pages/Landing';
import { fmtDate } from './format';

type Tab = 'dash' | 'orders' | 'ships' | 'scenario' | 'prod' | 'ai';
type View = 'landing' | 'app';

const NAV: { id: Tab; label: string; hint: string }[] = [
  { id: 'dash', label: 'Склад', hint: 'остатки и поставки' },
  { id: 'orders', label: 'Заказы', hint: 'резерв и отгрузка' },
  { id: 'ships', label: 'Поставки', hint: 'приём входящих' },
  { id: 'scenario', label: 'Задержка', hint: 'what-if на копии' },
  { id: 'prod', label: 'Производство', hint: 'партии и BOM' },
  { id: 'ai', label: 'ИИ-аналитик', hint: 'вопросы по фактам' },
];

/* Короткие подписи для нижней таб-панели на мобильных */
const TABBAR: { id: Tab; label: string }[] = [
  { id: 'dash', label: 'Склад' },
  { id: 'orders', label: 'Заказы' },
  { id: 'ships', label: 'Поставки' },
  { id: 'scenario', label: 'Задержка' },
  { id: 'prod', label: 'Цех' },
  { id: 'ai', label: 'ИИ' },
];

const SECTION: Record<Tab, { h: string; lead: string }> = {
  dash: { h: 'Склад', lead: 'Физический и свободный остаток. Свободно = on_hand − резерв. Air — температура и влажность, Plus — плюс CO₂.' },
  orders: { h: 'Заказы', lead: 'Резерв — из свободного запаса, отгрузка — только из резерва. Готовность считается от свободных и входящих поставок.' },
  ships: { h: 'Поставки', lead: 'Входящие expected-поставки. Получение приходует qty один раз, повтор отклоняется.' },
  scenario: { h: 'Проверка задержки', lead: 'Считается на копии данных — склад не меняется. Эталон: IN-AIR-01 → 05.11 даёт ORD-003 и ORD-005 в риске.' },
  prod: { h: 'Производство', lead: 'BOM и план партии по горизонту 02–06.11. Сборка и тест по юнитам, перенос за 17:00 → 09:00 следующего дня.' },
  ai: { h: 'ИИ-аналитик', lead: 'Отвечает только по данным API. ID и цифры — из facts_used. Проверка IN-UNKNOWN — без галлюцинаций.' },
};

export default function App() {
  const [view, setView] = useState<View>('landing');
  const [tab, setTab] = useState<Tab>('dash');
  const [snap, setSnap] = useState<any>(null);
  const [ships, setShips] = useState<any[]>([]);
  const [mock, setMock] = useState(isMockMode());
  const [msg, setMsg] = useState('');
  const [fixture, setFixture] = useState<'simple' | 'extended'>('simple');

  const load = useCallback(async () => {
    try {
      const s = await fetchSnapshot();
      setSnap(s);
      try {
        const sh = await fetchShipments();
        setShips(sh);
      } catch { setShips(s?.shipments_expected || []); }
    } catch (e: any) {
      setMsg('Не удалось загрузить snapshot: ' + e.message);
    }
  }, []);

  useEffect(() => {
    load();
    return onMockMode(setMock);
  }, [load]);

  async function changeFixture(f: 'simple' | 'extended') {
    setFixture(f);
    setMsg('');
    try {
      await adminReset(f);
      await load();
    } catch (e: any) {
      setMsg('Reset: ' + e.message);
    }
  }

  function enter(t: Tab) {
    setTab(t);
    setView('app');
    window.scrollTo({ top: 0 });
  }

  function selectTab(t: Tab) {
    setTab(t);
    window.scrollTo({ top: 0 });
  }

  const air = snap?.stock?.find((s: any) => s.sku === 'FG-AIR');
  const plus = snap?.stock?.find((s: any) => s.sku === 'FG-PLUS');
  const atRisk = snap?.kpi?.at_risk || 0;
  const activeCount = snap?.kpi?.active_orders ?? 0;
  const sec = SECTION[tab];

  const counts: Record<Tab, number | null> = useMemo(() => ({
    dash: null,
    orders: activeCount || null,
    ships: snap?.kpi?.expected_shipments ?? null,
    scenario: atRisk > 0 ? atRisk : null,
    prod: null,
    ai: null,
  }), [activeCount, snap, atRisk]);

  if (view === 'landing') {
    return <Landing snap={snap} mock={mock} onEnter={enter} />;
  }

  return (
    <div className="work-app">
      {/* Единственная верхняя панель приложения — все глобальные действия только здесь */}
      <header className="work-top">
        <button className="work-back" onClick={() => setView('landing')} title="Вернуться на визитку">
          ← Визитка
        </button>
        <div className="work-brand">
          <div className="fc-logo" style={{ width: 26, height: 26, fontSize: 14 }}>F</div>
          <span><b>Sensorika Twin</b> · консоль</span>
        </div>
        <div className="work-top-right">
          <span className="work-live" title={snap ? fmtDate(snap.now) : ''}>
            <span className={mock ? 'fc-dot mock' : 'fc-dot'} />
            {mock ? 'мок' : 'live'} · {snap ? fmtDate(snap.now) : '—'}
          </span>
          <button className="work-btn" onClick={load}>Обновить</button>
          <select
            className="work-select"
            value={fixture}
            onChange={(e) => changeFixture(e.target.value as 'simple' | 'extended')}
            title="Набор данных"
          >
            <option value="simple">simple</option>
            <option value="extended">extended</option>
          </select>
        </div>
      </header>

      <div className="work-layout">
        {/* Единственная навигация — боковая, без дублей в контенте */}
        <aside className="work-side">
          <nav className="work-nav">
            {NAV.map((n) => (
              <button
                key={n.id}
                className={tab === n.id ? 'work-nav-btn active' : 'work-nav-btn'}
                onClick={() => selectTab(n.id)}
              >
                <span className="work-nav-main">
                  <span className="work-nav-label">{n.label}</span>
                  <span className="work-nav-hint">{n.hint}</span>
                </span>
                {counts[n.id] != null && (
                  <span className={n.id === 'scenario' && atRisk > 0 ? 'work-count risk' : 'work-count'}>
                    {counts[n.id]}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div className="work-side-foot">
            <div className="work-mini">
              Air <b>{air?.on_hand ?? '—'}</b> · своб. <b>{air?.free ?? '—'}</b>
            </div>
            <div className="work-mini">
              Plus <b>{plus?.on_hand ?? '—'}</b> · своб. <b>{plus?.free ?? '—'}</b>
            </div>
            <div className="work-mini muted">free = on_hand − резерв · what-if на копии · повторное списание запрещено</div>
          </div>
        </aside>

        {/* Контент — один раздел за раз, без маркетинговых блоков */}
        <main className="work-main">
          {mock && (
            <div className="mock-banner">
              <span>▲</span> Мок-режим: backend :8000 недоступен, цифры из локального seed. Поднимите API для live.
            </div>
          )}
          {msg && <div className="info">{msg}</div>}

          <div className="work-head">
            <h1>{sec.h}</h1>
            <p>{sec.lead}</p>
          </div>

          <div className="work-card" key={tab}>
            {tab === 'dash' && <Dashboard snapshot={snap} shipmentsAll={ships} />}
            {tab === 'orders' && <Orders snapshot={snap} onChange={load} />}
            {tab === 'ships' && <Shipments snapshot={snap} shipmentsAll={ships} onChange={load} />}
            {tab === 'scenario' && <Scenario snapshot={snap} />}
            {tab === 'prod' && <Production />}
            {tab === 'ai' && <AiChat />}
          </div>

          <div className="work-foot">Sensorika Twin · учебное время 02.11 09:00 МСК · Swagger :8000/docs</div>
        </main>
      </div>

      {/* Нижняя таб-панель — только на мобильных, вместо боковой навигации */}
      <nav className="work-tabbar" aria-label="Разделы приложения">
        {TABBAR.map((n) => (
          <button
            key={n.id}
            className={tab === n.id ? 'work-tab active' : 'work-tab'}
            onClick={() => selectTab(n.id)}
            aria-current={tab === n.id ? 'page' : undefined}
          >
            <span className="work-tab-label">{n.label}</span>
            {counts[n.id] != null && (
              <span className={n.id === 'scenario' && atRisk > 0 ? 'work-tab-count risk' : 'work-tab-count'}>
                {counts[n.id]}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}

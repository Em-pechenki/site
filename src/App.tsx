import { useCallback, useEffect, useState } from 'react';
import { snapshot as fetchSnapshot, shipments as fetchShipments, isMockMode, onMockMode, setApiOverride, clearApiOverride, getApiOverride } from './api';
import { useT, tr, getLang } from './i18n';
import { Prefs } from './components/Badges';
import NavIcon from './components/NavIcon';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Shipments from './pages/Shipments';
import Staff from './pages/Staff';
import Scenario from './pages/Scenario';
import Production from './pages/Production';
import AiChat from './components/AiChat';
import Landing from './pages/Landing';
import Gid from './pages/Gid';
import { fmtDate } from './format';

type Tab = 'dash' | 'orders' | 'ships' | 'staff' | 'scenario' | 'prod' | 'consult';
type View = 'landing' | 'app' | 'gid';

export default function App() {
  const t = useT();
  const [view, setView] = useState<View>(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('gid') ? 'gid' : 'landing');
  const [tab, setTab] = useState<Tab>('orders');
  const [snap, setSnap] = useState<any>(null);
  const [ships, setShips] = useState<any[]>([]);
  const [mock, setMock] = useState(isMockMode());
  const [msg, setMsg] = useState('');
  const [navCollapsed, setNavCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('yabloki-nav-collapsed') === '1';
    } catch {
      return false;
    }
  });

  function toggleNav() {
    setNavCollapsed((v) => {
      try {
        localStorage.setItem('yabloki-nav-collapsed', v ? '0' : '1');
      } catch { /* noop */ }
      return !v;
    });
  }

  const NAV: { id: Tab; label: string; hint: string }[] = [
    { id: 'dash', label: t('nav_dash'), hint: t('nav_dash_hint') },
    { id: 'orders', label: t('nav_orders'), hint: t('nav_orders_hint') },
    { id: 'ships', label: t('nav_ships'), hint: t('nav_ships_hint') },
    { id: 'staff', label: t('nav_staff'), hint: t('nav_staff_hint') },
    { id: 'scenario', label: t('nav_scenario'), hint: t('nav_scenario_hint') },
    { id: 'prod', label: t('nav_prod'), hint: t('nav_prod_hint') },
    { id: 'consult', label: t('nav_consult'), hint: t('nav_consult_hint') },
  ];

  /* Короткие подписи для нижней таб-панели на мобильных */
  const TABBAR: { id: Tab; label: string }[] = [
    { id: 'dash', label: t('tab_dash') },
    { id: 'orders', label: t('tab_orders') },
    { id: 'ships', label: t('tab_ships') },
    { id: 'staff', label: t('tab_staff') },
    { id: 'scenario', label: t('tab_scenario') },
    { id: 'prod', label: t('tab_prod') },
    { id: 'consult', label: t('tab_consult') },
  ];

  const SECTION: Record<Tab, { h: string; lead: string }> = {
    dash: { h: t('sec_dash_h'), lead: t('sec_dash_lead') },
    orders: { h: t('sec_orders_h'), lead: t('sec_orders_lead') },
    ships: { h: t('sec_ships_h'), lead: t('sec_ships_lead') },
    staff: { h: t('sec_staff_h'), lead: t('sec_staff_lead') },
    scenario: { h: t('sec_scenario_h'), lead: t('sec_scenario_lead') },
    prod: { h: t('sec_prod_h'), lead: t('sec_prod_lead') },
    consult: { h: t('sec_consult_h'), lead: t('sec_consult_lead') },
  };

  const load = useCallback(async () => {
    try {
      const s = await fetchSnapshot();
      setSnap(s);
      try {
        const sh = await fetchShipments();
        setShips(sh);
      } catch { setShips(s?.shipments_expected || []); }
    } catch (e: any) {
      // язык берём в момент вызова — колбэк стабилен, рефетч-цикла нет
      setMsg(tr(getLang(), 'snapshot_err') + e.message);
    }
  }, []);

  useEffect(() => {
    load();
    return onMockMode(setMock);
  }, [load]);

  function enter(tt: Tab) {
    setTab(tt);
    setView('app');
    window.scrollTo({ top: 0 });
  }

  function selectTab(tt: Tab) {
    setTab(tt);
    window.scrollTo({ top: 0 });
  }

  const sec = SECTION[tab];

  const [consultOpen, setConsultOpen] = useState(false);

  const consultFab = (
    <>
      <button className="consult-fab" onClick={() => setConsultOpen(true)} title={t('ask_consultant')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
      </button>
      {consultOpen && (
        <div className="modal-overlay" onClick={() => setConsultOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <b>{t('consultant_title')}</b>
              <button className="ghost small" onClick={() => setConsultOpen(false)}>{t('close')}</button>
            </div>
            <AiChat persona="consultant" compact />
          </div>
        </div>
      )}
    </>
  );

  if (view === 'landing') {
    return (<><Landing snap={snap} mock={mock} onEnter={enter} onGuide={() => setView('gid')} />{consultFab}</>);
  }

  if (view === 'gid') {
    return (<><Gid onBack={() => setView('landing')} onEnter={enter} />{consultFab}</>);
  }

  return (
    <div className={navCollapsed ? 'work-app nav-collapsed' : 'work-app'}>
      {/* Единственная верхняя панель приложения — все глобальные действия только здесь */}
      <header className="work-top">
        <button className="work-back" onClick={() => setView('landing')} title={t('back_home')}>
          {t('back_home')}
        </button>
        <div className="work-brand">
          <img className="fc-logo-img sm" src="./yabloki-logo.png" alt="ЯблокИИ" />
          <span><b>Яблок<span className="ii">ИИ</span></b> · {t('console')}</span>
        </div>
        <div className="work-top-right">
          <span className="work-live" title={snap ? fmtDate(snap.now) : ''}>
            <span className={mock ? 'fc-dot mock' : 'fc-dot'} />
            {mock ? t('demo') : t('online')} · {snap ? fmtDate(snap.now) : '—'}
          </span>
          <Prefs />
        </div>
      </header>

      <div className="work-layout">
        {/* Единственная навигация — боковая, без дублей в контенте */}
        <aside className="work-side">
          <div className="work-nav-collapse-row">
            <button
              className="work-nav-collapse"
              onClick={toggleNav}
              title={navCollapsed ? t('nav_expand') : t('nav_collapse')}
              aria-label={navCollapsed ? t('nav_expand') : t('nav_collapse')}
              aria-expanded={!navCollapsed}
            >
              <NavIcon id={navCollapsed ? 'expand' : 'collapse'} />
            </button>
          </div>
          <nav className="work-nav">
            {NAV.map((n) => (
              <button
                key={n.id}
                className={tab === n.id ? 'work-nav-btn active' : 'work-nav-btn'}
                onClick={() => selectTab(n.id)}
                title={n.label}
              >
                <span className="work-nav-ic"><NavIcon id={n.id} /></span>
                <span className="work-nav-main">
                  <span className="work-nav-label">{n.label}</span>
                  <span className="work-nav-hint">{n.hint}</span>
                </span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Контент — один раздел за раз, без маркетинговых блоков */}
        <main className="work-main">
          {mock && (
            <div className="mock-banner">
              <span>▲</span>
              <span style={{ flex: 1 }}>
                {t('demo_banner')}
              </span>
              <button
                className="ghost small"
                title={t('prompt_server')}
                onClick={() => {
                  const cur = getApiOverride() || 'http://';
                  const v = window.prompt(t('prompt_server'), cur);
                  if (v === null) return;
                  if (!v.trim()) { clearApiOverride(); load(); return; }
                  setApiOverride(v);
                  load();
                }}
              >
                {t('connect_server')}
              </button>
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
            {tab === 'staff' && <Staff snapshot={snap} />}
            {tab === 'scenario' && <Scenario snapshot={snap} />}
            {tab === 'prod' && <Production snapshot={snap} />}
            {/* Чат смонтирован всегда: история не теряется при переключении */}
            <div style={{ display: tab === 'consult' ? undefined : 'none' }}>
              <AiChat persona="consultant" />
            </div>
          </div>
        </main>
      </div>

      {/* Нижняя таб-панель — только на мобильных, вместо боковой навигации */}
      <nav className="work-tabbar" aria-label={t('sections_label')}>
        {TABBAR.map((n) => (
          <button
            key={n.id}
            className={tab === n.id ? 'work-tab active' : 'work-tab'}
            onClick={() => selectTab(n.id)}
            aria-current={tab === n.id ? 'page' : undefined}
          >
            <span className="work-tab-ic"><NavIcon id={n.id} /></span>
            <span className="work-tab-label">{n.label}</span>
          </button>
        ))}
      </nav>
      {consultFab}
    </div>
  );
}

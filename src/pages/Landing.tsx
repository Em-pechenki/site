import { fmtDate } from '../format';

export type LandingTab = 'dash' | 'orders' | 'ships' | 'scenario' | 'prod' | 'ai';

export default function Landing({
  snap,
  mock,
  onEnter,
}: {
  snap: any;
  mock: boolean;
  onEnter: (tab: LandingTab) => void;
}) {
  const air = snap?.stock?.find((s: any) => s.sku === 'FG-AIR');
  const plus = snap?.stock?.find((s: any) => s.sku === 'FG-PLUS');
  const atRisk = snap?.kpi?.at_risk ?? 0;
  const active = snap?.kpi?.active_orders ?? '—';

  return (
    <div className="fc-app">
      {/* Тонкая служебная полоса — только один раз, только на визитке */}
      <div className="fc-topbar">
        <div className="fc-topbar-inner">
          <span><span className="t-ok">●</span> Минцифры · аккредитовано с 2014</span>
          <span className="t-sep">/</span>
          <span>ISO 9001</span>
          <span className="fc-topbar-right">
            <span>since 2008</span>
            <span>учебное время 02.11 09:00 МСК</span>
          </span>
        </div>
      </div>

      <header className="fc-header">
        <div className="fc-header-inner">
          <div className="fc-brand">
            <div className="fc-logo">F</div>
            <div className="fc-brand-name"><b>FIRECODE</b><span>since 2008</span></div>
          </div>
          <span className="fc-x">×</span>
          <div className="fc-product"><b>Sensorika Twin</b> · двойник склада</div>
          <div className="fc-header-right">
            <a className="fc-phone" href="tel:+74991305177">+7 (499) 130-51-77</a>
            <button className="btn-primary" style={{ padding: '9px 20px' }} onClick={() => onEnter('dash')}>
              Открыть приложение
            </button>
          </div>
        </div>
      </header>

      {/* HERO — единственное красивое место */}
      <section className="fc-hero">
        <div className="fc-hero-orb o1" />
        <div className="fc-hero-orb o2" />
        <div className="fc-hero-inner">
          <div>
            <div className="fc-eyebrow"><i />Firecode × Сенсорика · цифровой двойник</div>
            <h1>Складской <em>интеллект</em> <span className="grad">Сенсорики</span></h1>
            <p className="fc-hero-lead">
              Учебная модель предприятия: <b>Air</b> — температура и влажность,
              <b> Air Plus</b> — дополнительно CO₂. Остатки, резервы, поставки,
              риски опозданий и объяснение ИИ — по фактам API.
            </p>
            <div className="fc-hero-cta">
              <button className="btn-indigo" onClick={() => onEnter('dash')}>Открыть приложение ›</button>
              <button className="btn-ghost" onClick={() => onEnter('scenario')}>Демо: задержка IN-AIR-01</button>
            </div>
            <div className="fc-hero-pills">
              <span className="fc-hero-pill" style={{ cursor: 'default' }}>FG-AIR · FG-PLUS</span>
              <span className="fc-hero-pill" style={{ cursor: 'default' }}>free = on_hand − резерв</span>
              <span className="fc-hero-pill" style={{ cursor: 'default' }}>what-if на копии</span>
            </div>
          </div>

          {/* Живая витрина — только цифры, без действий */}
          <div className="fc-hero-card">
            <div className="fc-hero-card-top">
              <span className="d r" /><span className="d y" /><span className="d g" />
              <span className="t">sensorika-twin · live</span>
              <span className="live"><span className={mock ? 'fc-dot mock' : 'fc-dot'} />{mock ? 'мок-данные' : 'live-api :8000'}</span>
            </div>
            <div className="fc-hero-card-body">
              <div className="fc-hero-kpis">
                <div className="fc-hero-kpi">
                  <div className="k">Air · FG-AIR</div>
                  <div className="v">{air?.on_hand ?? '—'}<small> шт</small></div>
                  <div className="s">свободно {air?.free ?? '—'} · резерв {air?.reserved ?? '—'}</div>
                </div>
                <div className="fc-hero-kpi">
                  <div className="k">Plus · FG-PLUS</div>
                  <div className="v">{plus?.on_hand ?? '—'}<small> шт</small></div>
                  <div className="s">свободно {plus?.free ?? '—'} · резерв {plus?.reserved ?? '—'}</div>
                </div>
                <div className="fc-hero-kpi">
                  <div className="k">Активные заказы</div>
                  <div className="v">{active}</div>
                  <div className="s">в пути {snap?.kpi?.expected_shipments ?? '—'} поставок</div>
                </div>
                <div className={atRisk > 0 ? 'fc-hero-kpi alert' : 'fc-hero-kpi'}>
                  <div className="k">В риске</div>
                  <div className="v">{atRisk}</div>
                  <div className="s">{atRisk > 0 ? 'смотрите сценарий' : 'все в срок'}</div>
                </div>
              </div>
              <div className="fc-hero-card-foot" style={{ border: 'none', padding: '4px 2px 0' }}>
                <span className="ok">●</span>
                <span>{snap ? fmtDate(snap.now) + ' МСК · данные API' : 'загрузка…'}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="fc-body">
        {/* Что умеет — 3 карточки, каждая ведёт в свой раздел приложения */}
        <section className="fc-section" style={{ paddingTop: 44 }}>
          <div className="fc-section-head">
            <div className="fc-section-head-main">
              <div className="fc-section-label">Возможности</div>
              <h2>Что умеет <em>двойник</em></h2>
              <p>Три контура для ежедневной работы. Вся работа — внутри приложения, здесь только обзор.</p>
            </div>
          </div>
          <div className="fc-plans">
            <div className="fc-plan">
              <div className="fc-plan-top">Контур · Склад и заказы</div>
              <h3>Остатки <em>и готовность</em></h3>
              <div className="price">Air 18 / Plus 8 <small>· свободно 12 / 3</small></div>
              <ul>
                <li>Физический и свободный остаток</li>
                <li>Резерв и отгрузка без дублей</li>
                <li>Нехватка и риск опоздания</li>
              </ul>
              <button className="btn-ghost" onClick={() => onEnter('dash')}>Открыть склад</button>
            </div>
            <div className="fc-plan hot">
              <div className="fc-plan-top">Решение · хит демо</div>
              <h3>Проверка <em>задержки</em></h3>
              <div className="price">IN-AIR-01 → 05.11 <small>· на копии данных</small></div>
              <ul>
                <li>Было / стало по готовности</li>
                <li>Угрозы ORD-003 · ORD-005</li>
                <li>Склад при этом не меняется</li>
              </ul>
              <button className="btn-indigo" onClick={() => onEnter('scenario')}>Проверить задержку ›</button>
            </div>
            <div className="fc-plan">
              <div className="fc-plan-top">Решение · ИИ и цех</div>
              <h3>Аналитик <em>и производство</em></h3>
              <div className="price">NEUROCORP + BOM <small>· по фактам API</small></div>
              <ul>
                <li>ИИ отвечает с facts_used</li>
                <li>Партия 8 Plus и дефицит CO₂</li>
                <li>Gantt 02–06.11</li>
              </ul>
              <button className="btn-ghost" onClick={() => onEnter('ai')}>Спросить ИИ</button>
            </div>
          </div>
        </section>

        {/* Демо за 3 минуты — короткий сценарий для жюри */}
        <section className="fc-section">
          <div className="fc-section-head">
            <div className="fc-section-head-main">
              <div className="fc-section-label">Демо · 3 минуты</div>
              <h2>Путь <em>от остатка до решения</em></h2>
            </div>
            <div className="fc-section-side">
              <button className="btn-indigo" onClick={() => onEnter('dash')}>Начать демо ›</button>
            </div>
          </div>
          <div className="fc-path fc-path-3">
            {[
              { n: '01', t: 'Склад', d: 'Air 18 (свободно 12), Plus 8 (свободно 3)', tab: 'dash' as LandingTab },
              { n: '02', t: 'Задержка', d: 'IN-AIR-01 → 05.11: ORD-003 и ORD-005 в риске', tab: 'scenario' as LandingTab },
              { n: '03', t: 'ИИ-объяснение', d: 'Причины по facts: ID заказов и цифры', tab: 'ai' as LandingTab },
            ].map((p) => (
              <button key={p.n} className="fc-path-step" onClick={() => onEnter(p.tab)}>
                <span className="fc-path-num">{p.n}</span>
                <b>{p.t}</b>
                <span className="d">{p.d}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Доверие — одна строка */}
        <section className="fc-section" style={{ paddingBottom: 8 }}>
          <div className="fc-trust-big">
            <div className="fc-trust-hero">
              <div className="t">Аккредитовано</div>
              <b>Минцифры России</b>
              <span>В реестре аккредитованных ИТ-компаний — с 17.07.2014.</span>
            </div>
            <div className="fc-trust-hero">
              <div className="t">Сертифицировано</div>
              <b>ISO 9001</b>
              <span>Менеджмент качества, NDA, постоплата, замена по SLA.</span>
            </div>
          </div>
        </section>
      </div>

      <footer className="fc-footer">
        <div className="fc-footer-inner" style={{ paddingTop: 32 }}>
          <div className="fc-footer-top">
            <div>
              <div className="fc-brand">
                <div className="fc-logo">F</div>
                <div className="fc-brand-name"><b>FIRECODE</b><span>since 2008</span></div>
              </div>
              <p>Sensorika Twin — учебный двойник склада: Air и Air Plus, заказы, поставки, what-if и производство.</p>
            </div>
            <div className="fc-footer-contacts">
              <a href="tel:+74991305177">+7 (499) 130-51-77</a>
              <a href="mailto:info@firecode.ru">info@firecode.ru</a>
              <span>Ростов-на-Дону · СПб · Самара · Ульяновск</span>
            </div>
          </div>
          <div className="fc-footer-bottom">
            <span>© 2008–2026 Firecode × Сенсорика</span>
            <span><button className="link" onClick={() => onEnter('dash')}>Открыть приложение →</button></span>
          </div>
        </div>
      </footer>
    </div>
  );
}

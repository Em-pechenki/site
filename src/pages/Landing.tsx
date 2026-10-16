import { fmtDate } from '../format';
import { useT } from '../i18n';
import { Prefs } from '../components/Badges';
import FirecodeLogo from '../components/FirecodeLogo';

export type LandingTab = 'dash' | 'orders' | 'ships' | 'staff' | 'scenario' | 'prod' | 'consult';

export default function Landing({
  snap,
  mock,
  onEnter,
  onGuide,
}: {
  snap: any;
  mock: boolean;
  onEnter: (tab: LandingTab) => void;
  onGuide: () => void;
}) {
  const t = useT();
  const air = snap?.stock?.find((s: any) => s.sku === 'FG-AIR');
  const plus = snap?.stock?.find((s: any) => s.sku === 'FG-PLUS');
  const atRisk = snap?.kpi?.at_risk ?? 0;
  const active = snap?.kpi?.active_orders ?? '—';

  return (
    <div className="fc-app">
      {/* Тонкая служебная полоса — только один раз, только на визитке */}
      <div className="fc-topbar">
        <div className="fc-topbar-inner">
          <span><span className="t-ok">●</span> {t('l_topbar')}</span>
          <span className="t-sep">/</span>
          <span>ISO 9001</span>
        </div>
      </div>

      <header className="fc-header">
        <div className="fc-header-inner">
          <div className="fc-brand">
            <FirecodeLogo />
          </div>
          <span className="fc-x">×</span>
          <div className="fc-brand">
            <img className="fc-logo-img" src="./yabloki-logo.png" alt="ЯблокИИ" />
            <div className="fc-brand-name"><b>Яблок<span className="ii big">ИИ</span></b></div>
          </div>
          <div className="fc-header-right">
            <a className="fc-phone" href="tel:+74991305177">+7 (499) 130-51-77</a>
            <Prefs compact />
          </div>
        </div>
      </header>

      {/* HERO — единственное красивое место */}
      <section className="fc-hero">
        <div className="fc-hero-orb o1" />
        <div className="fc-hero-orb o2" />
        <div className="fc-hero-inner">
          <div>
            <div className="fc-eyebrow"><i />{t('l_eyebrow')}</div>
            <h1>{t('l_hero_h1a')} <em>{t('l_hero_h1b')}</em> <span className="grad">ЯблокИИ</span></h1>
            <p className="fc-hero-lead">
              {t('l_hero_lead')}
            </p>
            <div className="fc-hero-cta">
              <button className="btn-indigo" onClick={() => onEnter('orders')}>{t('l_open')}</button>
            </div>
          </div>

          {/* Живая витрина — только цифры, без действий */}
          <div className="fc-hero-card">
            <div className="fc-hero-card-top">
              <span className="d r" /><span className="d y" /><span className="d g" />
              <span className="t">firecode × yabloki</span>
              <span className="live"><span className={mock ? 'fc-dot mock' : 'fc-dot'} />{mock ? t('l_demo') : t('l_server')}</span>
            </div>
            <div className="fc-hero-card-body">
              <div className="fc-hero-kpis">
                <div className="fc-hero-kpi">
                  <div className="k">air · <span style={{ whiteSpace: 'nowrap' }}>FG-AIR</span></div>
                  <div className="v">{air?.on_hand ?? '—'}<small> {t('l_pcs')}</small></div>
                  <div className="s">{t('l_free')} {air?.free ?? '—'} · {t('l_book')} {air?.reserved ?? '—'}</div>
                </div>
                <div className="fc-hero-kpi">
                  <div className="k">air plus · <span style={{ whiteSpace: 'nowrap' }}>FG-PLUS</span></div>
                  <div className="v">{plus?.on_hand ?? '—'}<small> {t('l_pcs')}</small></div>
                  <div className="s">{t('l_free')} {plus?.free ?? '—'} · {t('l_book')} {plus?.reserved ?? '—'}</div>
                </div>
                <div className="fc-hero-kpi">
                  <div className="k">{t('l_kpi_active')}</div>
                  <div className="v">{active}</div>
                  <div className="s">{t('l_in_transit_n', { n: snap?.kpi?.expected_shipments ?? '—' })}</div>
                </div>
                <div className={atRisk > 0 ? 'fc-hero-kpi alert' : 'fc-hero-kpi'}>
                  <div className="k">{t('l_kpi_risks')}</div>
                  <div className="v">{atRisk}</div>
                  <div className="s">{atRisk > 0 ? t('l_see_delay') : t('l_all_ok')}</div>
                </div>
              </div>
              <div className="fc-hero-card-foot" style={{ border: 'none', padding: '4px 2px 0' }}>
                <span className="ok">●</span>
                <span>{snap ? t('l_hero_card_live', { date: fmtDate(snap.now) }) : `${t('loading')}`}</span>
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
              <div className="fc-section-label">{t('l_cap_label')}</div>
              <h2>{t('l_cap_h')} <em>{t('l_cap_h_em')}</em></h2>
              <p>{t('l_cap_lead')}</p>
            </div>
          </div>
          <div className="fc-plans">
            <div className="fc-plan as-tab" role="button" tabIndex={0} onClick={() => onEnter('dash')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onEnter('dash'); }}>
              <h3>{t('l_plan1_h')} <em>{t('l_plan1_h_em')}</em></h3>
              <div className="price">{t('l_plan1_p')} <small>{t('l_plan1_p_sub')}</small></div>
              <ul>
                <li>{t('l_plan1_li1')}</li>
                <li>{t('l_plan1_li2')}</li>
                <li>{t('l_plan1_li3')}</li>
              </ul>
            </div>
            <div className="fc-plan hot as-tab" role="button" tabIndex={0} onClick={() => onEnter('scenario')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onEnter('scenario'); }}>
              <h3>{t('l_plan2_h')} <em>{t('l_plan2_h_em')}</em></h3>
              <div className="price">{t('l_plan2_p')} <small>{t('l_plan2_p_sub')}</small></div>
              <ul>
                <li>{t('l_plan2_li1')}</li>
                <li>{t('l_plan2_li2')}</li>
                <li>{t('l_plan2_li3')}</li>
              </ul>
            </div>
            <div className="fc-plan as-tab" role="button" tabIndex={0} onClick={() => onEnter('consult')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onEnter('consult'); }}>
              <h3>{t('l_plan3_h')} <em>{t('l_plan3_h_em')}</em></h3>
              <div className="price">{t('l_plan3_p')} <small>{t('l_plan3_p_sub')}</small></div>
              <ul>
                <li>{t('l_plan3_li1')}</li>
                <li>{t('l_plan3_li2')}</li>
                <li>{t('l_plan3_li3')}</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Доверие — одна строка */}
        <section className="fc-section" style={{ paddingBottom: 8 }}>
          <div className="fc-trust-big">
            <div className="fc-trust-hero">
              <div className="t">{t('l_trust1_t')}</div>
              <b>{t('l_trust1_b')}</b>
              <span>{t('l_trust1_s')}</span>
            </div>
            <div className="fc-trust-hero">
              <div className="t">{t('l_trust2_t')}</div>
              <b>{t('l_trust2_b')}</b>
              <span>{t('l_trust2_s')}</span>
            </div>
          </div>
        </section>
      </div>

      <footer className="fc-footer">
        <div className="fc-footer-inner" style={{ paddingTop: 32 }}>
          <div className="fc-footer-top">
            <div>
              <div className="fc-brand">
                <FirecodeLogo />
              </div>
              <p>{t('l_foot_p')}</p>
            </div>
            <div className="fc-footer-contacts">
              <a href="tel:+74991305177">+7 (499) 130-51-77</a>
              <a href="mailto:info@firecode.ru">info@firecode.ru</a>
              <span>Ростов-на-Дону · СПб · Самара · Ульяновск</span>
            </div>
          </div>
          <div className="fc-footer-bottom">
            <span>© 2008–2026 Firecode × ЯблокИИ</span>
            <span>
              <button className="link" onClick={onGuide}>{t('l_guide')}</button>
              {' · '}
              <button className="link" onClick={() => onEnter('orders')}>{t('l_open_link')}</button>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

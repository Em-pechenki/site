import { useT } from '../i18n';

export default function Gid({
  onBack,
  onEnter,
}: {
  onBack: () => void;
  onEnter: (tab: any) => void;
}) {
  const t = useT();
  const steps: { n: string; t: string; d: string; tab: any; btn: string }[] = [
    { n: '00', t: t('g1t'), tab: 'dash', btn: t('g1b'), d: t('g1d') },
    { n: '01', t: t('g2t'), tab: 'orders', btn: t('g2b'), d: t('g2d') },
    { n: '02', t: t('g3t'), tab: 'scenario', btn: t('g3b'), d: t('g3d') },
    { n: '03', t: t('g4t'), tab: 'consult', btn: t('g4b'), d: t('g4d') },
    { n: '04', t: t('g5t'), tab: 'prod', btn: t('g5b'), d: t('g5d') },
  ];

  return (
    <div className="fc-app">
      <div className="fc-body">
        <section className="fc-section" style={{ paddingTop: 32 }}>
          <button className="btn-ghost" onClick={onBack} style={{ marginBottom: 18 }}>{t('g_back')}</button>
          <div className="fc-section-label">{t('g_label')}</div>
          <h2 style={{ margin: '0 0 10px', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 600, letterSpacing: '-0.02em' }}>
            {t('g_h1a')} <em style={{ fontStyle: 'normal', color: 'var(--primary-soft)' }}>{t('g_h1b')}</em>
          </h2>
          <p style={{ color: 'var(--muted-fg)', maxWidth: 640, fontWeight: 300 }}>
            {t('g_lead')}
          </p>
          <div className="fc-plans" style={{ marginTop: 24 }}>
            {steps.map((s) => (
              <div key={s.n} className="fc-plan as-tab" role="button" tabIndex={0}
                onClick={() => onEnter(s.tab)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onEnter(s.tab); }}>
                <div className="fc-path-num">{s.n}</div>
                <h3>{s.t}</h3>
                <p style={{ color: 'var(--muted-fg)', fontSize: 13.5, fontWeight: 300 }}>{s.d}</p>
                <span className="fc-link-more">{s.btn} <span className="arr">→</span></span>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3><span className="n">✦</span> {t('g_how_h')}</h3>
            <div className="muted">
              {t('g_how_t')}
            </div>
          </div>

          <div className="card" style={{ marginTop: 16, textAlign: 'center' }}>
            <h3><span className="n">✦</span> {t('g_share_h')}</h3>
            <div className="muted">{t('g_share_t')}</div>
            <img src="./qr-gid.png" alt="QR" style={{ width: 200, height: 200, marginTop: 12, borderRadius: 12 }} />
          </div>
        </section>
      </div>
    </div>
  );
}

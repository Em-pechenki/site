import { useLang, tr, setLang, type Lang } from '../i18n';
import { useTheme, toggleTheme } from '../theme';

export function RiskBadge({ atRisk, shortage }: { atRisk?: boolean; shortage?: number }) {
  const lang = useLang();
  if ((shortage || 0) > 0)
    return <span className="badge badge-red">{tr(lang, 'bg_short', { n: shortage || 0 })}</span>;
  if (atRisk) return <span className="badge badge-red">{tr(lang, 'bg_late')}</span>;
  return <span className="badge badge-green">{tr(lang, 'bg_ontime')}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const lang = useLang();
  if (status === 'active') return <span className="badge badge-blue">{tr(lang, 'bg_open')}</span>;
  if (status === 'shipped') return <span className="badge badge-gray">{tr(lang, 'bg_shipped')}</span>;
  return <span className="badge badge-gray">{tr(lang, 'bg_cancelled')}</span>;
}

export function ShipBadge({ status }: { status: string }) {
  const lang = useLang();
  if (status === 'expected') return <span className="badge badge-blue">{tr(lang, 'bg_transit')}</span>;
  return <span className="badge badge-gray">{tr(lang, 'bg_received')}</span>;
}

/** Переключатели темы и языка — один компонент для всех шапок. */
export function Prefs({ compact = false }: { compact?: boolean }) {
  const lang: Lang = useLang();
  const theme = useTheme();
  return (
    <span className={compact ? 'prefs prefs-compact' : 'prefs'}>
      <span className="prefs-seg" role="group" aria-label="Language / Язык">
        <button
          className={lang === 'ru' ? 'prefs-seg-btn active' : 'prefs-seg-btn'}
          onClick={() => setLang('ru')}
          title="Русский"
        >
          RU
        </button>
        <button
          className={lang === 'en' ? 'prefs-seg-btn active' : 'prefs-seg-btn'}
          onClick={() => setLang('en')}
          title="English"
        >
          EN
        </button>
      </span>
      <button
        className="prefs-theme"
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Светлая тема / Light theme' : 'Тёмная тема / Dark theme'}
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      >
        {theme === 'dark' ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" /></svg>
        )}
      </button>
    </span>
  );
}

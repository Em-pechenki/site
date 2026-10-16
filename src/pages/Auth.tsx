import { useState } from 'react';
import { demoAdminLogin, login, register } from '../api';
import { setAuth } from '../auth';
import { useT } from '../i18n';

export default function Auth({ onDone }: { onDone: () => void }) {
  const t = useT();
  const [mode, setMode] = useState<'login' | 'reg'>('reg');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const res =
        mode === 'reg'
          ? await register(name.trim(), email.trim(), pwd)
          : await login(email.trim(), pwd);
      setAuth(res.token, res.user);
      onDone();
    } catch (e: any) {
      setErr(e.message + (e.hint ? ` — ${e.hint}` : ''));
    } finally {
      setBusy(false);
    }
  }

  async function demo() {
    setErr('');
    setBusy(true);
    try {
      const res = await demoAdminLogin();
      setAuth(res.token, res.user);
      onDone();
    } catch (e: any) {
      setErr(e.message + (e.hint ? ` — ${e.hint}` : ''));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fc-app">
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="fc-eyebrow">
            <i />
            Firecode × ЯблокИИ
          </div>
          <h1>{mode === 'reg' ? t('a_h_reg') : t('a_h_login')}</h1>
          <p className="muted">{t('a_lead')}</p>

          <div className="auth-tabs" role="tablist">
            <button
              className={mode === 'login' ? 'auth-tab active' : 'auth-tab'}
              onClick={() => setMode('login')}
              role="tab"
              aria-selected={mode === 'login'}
            >
              {t('a_login_tab')}
            </button>
            <button
              className={mode === 'reg' ? 'auth-tab active' : 'auth-tab'}
              onClick={() => setMode('reg')}
              role="tab"
              aria-selected={mode === 'reg'}
            >
              {t('a_reg_tab')}
            </button>
          </div>

          <form onSubmit={submit} className="auth-form">
            {mode === 'reg' && (
              <label>
                {t('a_name')}
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('a_name_ph')}
                  autoComplete="name"
                />
              </label>
            )}
            <label>
              {t('a_email')}
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('a_email_ph')}
                autoComplete="email"
                inputMode="email"
              />
            </label>
            <label>
              {t('a_pwd')}
              <input
                type="password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                placeholder={t('a_pwd_ph')}
                autoComplete={mode === 'reg' ? 'new-password' : 'current-password'}
              />
            </label>
            {err && <div className="error">{err}</div>}
            <button className="btn-indigo auth-submit" disabled={busy} type="submit">
              {mode === 'reg' ? t('a_go_reg') : t('a_go_login')}
            </button>
          </form>

          <div className="auth-divider">
            <span>{t('a_or')}</span>
          </div>

          <button className="auth-demo" onClick={demo} disabled={busy} type="button">
            {t('a_demo')}
          </button>
          <p className="auth-demo-hint">{t('a_demo_hint')}</p>
        </div>
      </div>
    </div>
  );
}

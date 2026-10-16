import { useEffect, useRef, useState } from 'react';
import { aiAsk } from '../api';
import { useT, useLang } from '../i18n';

type Msg = { role: 'user' | 'ai'; text: string };

const HIST_KEY = (persona: string) => `yabloki-chat-${persona}-v1`;
const HIST_LIMIT = 50;

function loadHistory(persona: string): Msg[] {
  try {
    const txt = localStorage.getItem(HIST_KEY(persona));
    if (!txt) return [];
    const arr = JSON.parse(txt);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((m: any) => m && (m.role === 'user' || m.role === 'ai') && typeof m.text === 'string')
      .slice(-HIST_LIMIT);
  } catch {
    return [];
  }
}

function saveHistory(persona: string, msgs: Msg[]) {
  try {
    localStorage.setItem(HIST_KEY(persona), JSON.stringify(msgs.slice(-HIST_LIMIT)));
  } catch { /* переполнен — историю не сохраняем */ }
}

export default function AiChat({
  persona = 'analyst',
  compact = false,
}: {
  persona?: 'analyst' | 'consultant';
  compact?: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const isConsult = persona === 'consultant';
  const CHIPS = isConsult
    ? [t('ai_chip_c1'), t('ai_chip_c2'), t('ai_chip_c3'), t('ai_chip_c4')]
    : [t('ai_chip_a1'), t('ai_chip_a2'), t('ai_chip_a3'), t('ai_chip_a4')];
  const [q, setQ] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>(() => loadHistory(persona));
  const [facts, setFacts] = useState<any>(null);
  const [via, setVia] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [showFacts, setShowFacts] = useState(false);
  const histRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = histRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, loading]);

  useEffect(() => {
    saveHistory(persona, msgs);
  }, [msgs, persona]);

  async function ask(question: string) {
    const qq = question.trim();
    if (!qq || loading) return;
    setLoading(true);
    setErr('');
    const history = msgs.slice(-6).map((m) => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.text,
    }));
    setMsgs((prev) => [...prev, { role: 'user', text: qq }]);
    setQ('');
    try {
      const r = await aiAsk(qq, undefined, persona, history, lang);
      setMsgs((prev) => [...prev, { role: 'ai', text: r.answer || '' }]);
      setFacts(r.facts_used || null);
      setVia(r.via || '');
    } catch (e: any) {
      setErr(e.message + (e.hint ? ' — ' + e.hint : ''));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={(compact ? 'ai-chat compact' : 'ai-chat') + (isConsult ? ' is-consult' : '') + (msgs.length ? ' has-history' : '')}>
      <div className="fc-section-label" style={{ marginBottom: 10 }}>
        {isConsult ? t('ai_label_c') : t('ai_label_a')}
      </div>
      <h3>{isConsult ? t('ai_h_c') : t('ai_h_a')}</h3>
      <div className="muted">
        {isConsult ? t('ai_lead_c') : t('ai_lead_a')}
      </div>
      <div className="chips">
        {CHIPS.map((c) => (
          <button key={c} className="chip" onClick={() => ask(c)}>
            {c}
          </button>
        ))}
      </div>
      {msgs.length > 0 && (
        <div className="ai-history" ref={histRef}>
          {msgs.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'msg msg-user' : 'msg msg-ai'}>
              <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
            </div>
          ))}
          {loading && <div className="msg msg-ai msg-typing">{t('ai_thinking')}</div>}
        </div>
      )}
      <div className="ai-row">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('ai_ph')}
          onKeyDown={(e) => { if (e.key === 'Enter') ask(q); }}
        />
        <button onClick={() => ask(q)} disabled={loading}>{loading ? t('ai_thinking') : t('ai_ask')}</button>
      </div>
      {err && <div className="error">{err}</div>}
      {msgs.length > 0 && (
        <div>
          <button className="link" onClick={() => setMsgs([])}>{t('ai_clear')}</button>
        </div>
      )}
      {persona !== 'consultant' && facts && (
        <div className="facts">
          <button className="link" onClick={() => setShowFacts(!showFacts)}>
            {showFacts ? t('ai_facts_hide') : t('ai_facts_show')}
          </button>
          {showFacts && <pre>{JSON.stringify(facts, null, 2)}</pre>}
        </div>
      )}
      {via && (
        <div className="via-line">
          {via === 'ai' ? t('ai_via_ai') : t('ai_via_rules')}
        </div>
      )}
    </div>
  );
}

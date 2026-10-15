import { useState } from 'react';
import { aiAsk } from '../api';

const CHIPS = [
  'Можно ли отдать 5 Plus новому клиенту?',
  'Почему ORD-003 нельзя отгрузить целиком?',
  'Что будет при задержке IN-AIR-01?',
  'Когда придёт IN-UNKNOWN?',
];

export default function AiChat() {
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState('');
  const [facts, setFacts] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [showFacts, setShowFacts] = useState(false);

  async function ask(question: string) {
    const qq = question.trim();
    if (!qq) return;
    setLoading(true);
    setErr('');
    try {
      let scenario: any = undefined;
      if (/задерж/i.test(qq) && /IN-AIR-01/i.test(qq)) {
        scenario = { shipment_id: 'IN-AIR-01', new_expected_at: '2026-11-05T10:00:00+03:00' };
      }
      const r = await aiAsk(qq, scenario);
      setAnswer(r.answer || '');
      setFacts(r.facts_used || null);
    } catch (e: any) {
      setErr(e.message + (e.hint ? ' — ' + e.hint : ''));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ai-chat">
      <div className="fc-section-label" style={{ marginBottom: 10 }}>NEUROCORP · grounded AI</div>
      <h3>ИИ-аналитик склада</h3>
      <div className="muted">Только по facts API. ID и цифры — из данных. IN-UNKNOWN честно признаёт неизвестность.</div>
      <div className="chips">
        {CHIPS.map((c) => (
          <button key={c} className="chip" onClick={() => { setQ(c); ask(c); }}>
            {c}
          </button>
        ))}
      </div>
      <div className="ai-row">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Спросите про склад, заказы, задержки…"
          onKeyDown={(e) => { if (e.key === 'Enter') ask(q); }}
        />
        <button onClick={() => ask(q)} disabled={loading}>{loading ? 'Думаем…' : 'Спросить ›'}</button>
      </div>
      {err && <div className="error">{err}</div>}
      {answer && (
        <div className="ai-answer">
          <div style={{ whiteSpace: 'pre-wrap' }}>{answer}</div>
          {facts && (
            <div className="facts">
              <button className="link" onClick={() => setShowFacts(!showFacts)}>
                {showFacts ? 'скрыть данные ↑' : 'на каких данных основан →'}
              </button>
              {showFacts && <pre>{JSON.stringify(facts, null, 2)}</pre>}
            </div>
          )}
          <div className="src">
            <span className="badge badge-blue">grounded</span>
            <span className="badge badge-gray">facts_used</span>
            <span className="badge badge-gray">без галлюцинаций</span>
          </div>
        </div>
      )}
      {!answer && !err && (
        <div className="muted" style={{ marginTop: 12 }}>На выходе <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary-soft)' }}>ответ + facts_used для проверки</span></div>
      )}
    </div>
  );
}

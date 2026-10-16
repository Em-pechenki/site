// Прямой вызов нейросети из браузера.
// Нужен там, где backend недоступен: статичный хостинг (GitHub Pages) не умеет
// держать сервер, поэтому сайт обращается к провайдеру сам.
//
// ⚠️ ВНИМАНИЕ. Ключ ниже попадает в публичную сборку сайта: любой, кто откроет
// исходники страницы, сможет его прочитать и потратить лимит токенов.
// Чтобы ключа не было в git — задайте секреты репозитория
// (Settings → Secrets and variables → Actions → Secrets):
//   VITE_DUNGEON_KEY, VITE_DUNGEON_BASE_URL, VITE_DUNGEON_MODEL
// тогда значения по умолчанию ниже будут перекрыты при сборке.
// Ключ у провайдера стоит периодически менять.

const DEFAULT_BASE_URL = 'https://31-76-100-137.sslip.io/v1';
const DEFAULT_KEY = 'sk-g6E8uwLF3eN-YcbR1-tWig';
const DEFAULT_MODEL = 'gpt-6-astra';

const BASE_URL = ((import.meta.env.VITE_DUNGEON_BASE_URL as string) || DEFAULT_BASE_URL).replace(/\/+$/, '');
const API_KEY = (import.meta.env.VITE_DUNGEON_KEY as string) || DEFAULT_KEY;
const MODEL = (import.meta.env.VITE_DUNGEON_MODEL as string) || DEFAULT_MODEL;
const MAX_TOKENS = 350;

const SYSTEM_PROMPT =
  'Ты — аналитик склада «ЯблокИИ». Отвечай ТОЛЬКО по разделу Данные. ' +
  'Не выдумывай ID, числа, даты. Нет записи — скажи «такой записи нет». ' +
  'Называй товар, всего/свободно/бронь и вывод. Отвечай по-русски, коротко, ' +
  'полными предложениями: ответ одним числом запрещён. ' +
  'Пиши обычным текстом, без markdown: никаких **, #, таблиц и звёздочек.';

const CONSULT_PROMPT =
  'Ты — дружелюбный консультант склада «ЯблокИИ». Объясняй простыми словами: ' +
  'что в наличии, что делать. Опирайся ТОЛЬКО на раздел Данные, не выдумывай числа. ' +
  'Нет записи — скажи «такой записи нет». Отвечай по-русски, коротко, тепло, ' +
  'полными предложениями. Пиши обычным текстом, без markdown: никаких **, # и звёздочек.';

const SYSTEM_PROMPT_EN =
  'You are the YablokII warehouse analyst. Answer ONLY from the Data section. ' +
  'Never invent IDs, numbers or dates. No record — say "no such record". ' +
  'Name the product, on-hand/free/reserved figures and the conclusion. Answer in English, briefly, ' +
  'in full sentences: a bare number is forbidden. ' +
  'Write plain text, no markdown: no **, #, tables or asterisks.';

const CONSULT_PROMPT_EN =
  'You are the friendly YablokII warehouse advisor. Explain in plain words: ' +
  'what is in stock, what to do. Rely ONLY on the Data section, never invent numbers. ' +
  'No record — say "no such record". Answer in English, briefly, warmly, ' +
  'in full sentences. Write plain text, no markdown: no **, # or asterisks.';

export const LLM_ENABLED = Boolean(API_KEY);

export type ChatRole = 'system' | 'user' | 'assistant';
export interface ChatMsg { role: ChatRole; content: string }

export function systemPrompt(
  persona: 'analyst' | 'consultant' = 'analyst',
  lang: 'ru' | 'en' = 'ru',
): string {
  return lang === 'en'
    ? (persona === 'consultant' ? CONSULT_PROMPT_EN : SYSTEM_PROMPT_EN)
    : (persona === 'consultant' ? CONSULT_PROMPT : SYSTEM_PROMPT);
}

/** Одна реплика с моделью своими сообщениями — нужно для цикла инструментов. */
export async function chatComplete(
  messages: ChatMsg[],
  timeoutMs = 60000,
): Promise<string | null> {
  if (!API_KEY) return null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(BASE_URL + '/chat/completions', {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + API_KEY,
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          temperature: 0.2,
          max_tokens: MAX_TOKENS,
        }),
      });
      if (r.ok) {
        const d = await r.json();
        const text = String(d?.choices?.[0]?.message?.content || '').trim();
        if (text) return text;
      }
    } catch {
      // сеть/таймаут — попробуем ещё раз
    } finally {
      clearTimeout(timer);
    }
    if (attempt === 0) await new Promise((res) => setTimeout(res, 1000));
  }
  return null;
}

/** Спросить модель. Возвращает текст ответа или null, если модель недоступна. */
export async function askLlm(
  question: string,
  data: unknown,
  persona: 'analyst' | 'consultant' = 'analyst',
  history: { role: string; content: string }[] = [],
  timeoutMs = 60000,
  lang: 'ru' | 'en' = 'ru',
): Promise<string | null> {
  const messages: ChatMsg[] = [{ role: 'system', content: systemPrompt(persona, lang) }];
  for (const h of (history || []).slice(-6)) {
    if (h && (h.role === 'user' || h.role === 'assistant') && h.content) {
      messages.push({ role: h.role, content: String(h.content).slice(0, 300) });
    }
  }
  messages.push({
    role: 'user',
    content: 'Данные:\n' + JSON.stringify(data) + '\n\nВопрос: ' + question,
  });
  return chatComplete(messages, timeoutMs);
}

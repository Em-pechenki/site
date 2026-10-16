// Состояние авторизации: токен + пользователь в localStorage, подписка для UI.
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at?: string;
}

const LS_TOKEN = 'yabloki-auth-token';
const LS_USER = 'yabloki-auth-user';

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((cb) => cb());
}

export function onAuth(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(LS_TOKEN);
  } catch {
    return null;
  }
}

export function getUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(LS_USER);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function setAuth(token: string, user: AuthUser) {
  try {
    localStorage.setItem(LS_TOKEN, token);
    localStorage.setItem(LS_USER, JSON.stringify(user));
  } catch {
    /* noop */
  }
  emit();
}

export function clearAuth() {
  try {
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_USER);
  } catch {
    /* noop */
  }
  emit();
}

export function isAuthed(): boolean {
  return !!getToken();
}

export function isAdmin(): boolean {
  return getUser()?.role === 'admin';
}

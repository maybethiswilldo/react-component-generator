import type { GeneratedComponent, Provider } from '../types';

export const MAX_HISTORY = 20;

export const STORAGE_KEYS = {
  apiKey: 'rcg:apiKey',
  provider: 'rcg:provider',
  history: 'rcg:history',
  components: 'rcg:components',
} as const;

export function readStorage<T>(key: string, parse: (raw: unknown) => T, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return fallback;
    return parse(JSON.parse(stored));
  } catch {
    return fallback;
  }
}

export function writeStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 용량 초과·저장소 비활성화 시 메모리 상태만 유지한다.
  }
}

export function parseString(raw: unknown): string {
  return typeof raw === 'string' ? raw : '';
}

export function parseProvider(raw: unknown): Provider {
  return raw === 'anthropic' || raw === 'google' ? raw : 'google';
}

export function parseHistory(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : [];
}

export function addToHistory(history: string[], prompt: string): string[] {
  return [prompt, ...history.filter((item) => item !== prompt)].slice(0, MAX_HISTORY);
}

export function parseComponents(raw: unknown): GeneratedComponent[] {
  if (!Array.isArray(raw)) return [];
  const result: GeneratedComponent[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const { id, prompt, code, createdAt } = item as Record<string, unknown>;
    if (typeof id !== 'string' || typeof prompt !== 'string' || typeof code !== 'string') continue;
    if (typeof createdAt !== 'string') continue;
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) continue;
    result.push({ id, prompt, code, createdAt: date });
  }
  return result;
}

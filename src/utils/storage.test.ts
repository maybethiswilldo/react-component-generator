import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_HISTORY,
  addToHistory,
  parseComponents,
  parseHistory,
  parseProvider,
  readStorage,
  writeStorage,
} from './storage';

describe('readStorage / writeStorage', () => {
  beforeEach(() => localStorage.clear());

  it('저장한 값을 같은 키로 다시 읽는다', () => {
    writeStorage('k', { a: 1 });
    expect(readStorage('k', (v) => v, null)).toEqual({ a: 1 });
  });

  it('값이 없으면 fallback을 반환한다', () => {
    expect(readStorage('none', (v) => v, 'fb')).toBe('fb');
  });

  it('JSON이 깨져 있으면 fallback을 반환한다', () => {
    localStorage.setItem('bad', '{oops');
    expect(readStorage('bad', (v) => v, 'fb')).toBe('fb');
  });
});

describe('parseProvider', () => {
  it('알려진 provider는 그대로 반환한다', () => {
    expect(parseProvider('anthropic')).toBe('anthropic');
  });

  it('알 수 없는 값은 google로 되돌린다', () => {
    expect(parseProvider('openai')).toBe('google');
  });
});

describe('parseHistory', () => {
  it('문자열이 아닌 항목은 걸러낸다', () => {
    expect(parseHistory(['a', 1, null, 'b'])).toEqual(['a', 'b']);
  });

  it('배열이 아니면 빈 배열을 반환한다', () => {
    expect(parseHistory('x')).toEqual([]);
  });
});

describe('addToHistory', () => {
  it('새 프롬프트를 맨 앞에 추가한다', () => {
    expect(addToHistory(['a'], 'b')).toEqual(['b', 'a']);
  });

  it('중복 프롬프트는 맨 앞으로 옮기고 하나만 남긴다', () => {
    expect(addToHistory(['a', 'b'], 'b')).toEqual(['b', 'a']);
  });

  it('최대 개수를 넘으면 오래된 항목을 버린다', () => {
    const full = Array.from({ length: MAX_HISTORY }, (_, i) => `p${i}`);
    const next = addToHistory(full, 'new');
    expect(next).toHaveLength(MAX_HISTORY);
    expect(next[0]).toBe('new');
  });
});

describe('parseComponents', () => {
  it('createdAt 문자열을 Date로 복원한다', () => {
    const iso = '2026-01-01T00:00:00.000Z';
    const [c] = parseComponents([{ id: '1', prompt: 'p', code: 'c', createdAt: iso }]);
    expect(c.createdAt).toBeInstanceOf(Date);
    expect(c.createdAt.toISOString()).toBe(iso);
  });

  it('필드가 잘못된 항목은 걸러낸다', () => {
    const iso = '2026-01-01T00:00:00.000Z';
    const result = parseComponents([
      { id: '1', prompt: 'p', code: 'c', createdAt: iso },
      { id: 2, prompt: 'p', code: 'c', createdAt: iso },
      { id: '3', prompt: 'p', code: 'c', createdAt: 'not-a-date' },
    ]);
    expect(result.map((c) => c.id)).toEqual(['1']);
  });

  it('배열이 아니면 빈 배열을 반환한다', () => {
    expect(parseComponents({})).toEqual([]);
  });
});

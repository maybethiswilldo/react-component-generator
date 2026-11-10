import { describe, it, expect } from 'vitest';
import { validatePrompt, MAX_PROMPT_LENGTH } from './validatePrompt';

describe('validatePrompt', () => {
  it('501자 프롬프트는 에러 메시지와 함께 거부한다', () => {
    const result = validatePrompt('a'.repeat(MAX_PROMPT_LENGTH + 1));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('500');
  });

  it('앞뒤 공백을 제외한 길이가 500자면 허용한다', () => {
    const result = validatePrompt(`  ${'a'.repeat(MAX_PROMPT_LENGTH)}  `);
    expect(result.valid).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import {
  toErrorBody,
  toStreamErrorMessage,
  OVERLOAD_MESSAGE,
  RATE_LIMIT_MESSAGE,
  TRUNCATED_MESSAGE,
  BLOCKED_MESSAGE,
  EMPTY_MESSAGE,
  INCOMPLETE_MESSAGE,
  GENERIC_STREAM_ERROR,
} from './errors';

describe('toErrorBody', () => {
  it('Gemini 503 에러는 503 과부하 안내로 매핑한다', () => {
    expect(toErrorBody('Gemini API error: 503')).toEqual({ error: OVERLOAD_MESSAGE, status: 503 });
  });

  it('Claude 429 에러는 429 안내로 매핑한다', () => {
    expect(toErrorBody('Claude API error: 429')).toEqual({ error: RATE_LIMIT_MESSAGE, status: 429 });
  });

  it('503이 더 긴 숫자의 일부이면 매핑하지 않는다', () => {
    expect(toErrorBody('Gemini API error: 5031')).toEqual({
      error: 'Gemini API error: 5031',
      status: 500,
    });
  });

  it('그 밖의 메시지는 500과 원문으로 반환한다', () => {
    expect(toErrorBody('Claude API error: 401')).toEqual({
      error: 'Claude API error: 401',
      status: 500,
    });
  });
});

describe('toStreamErrorMessage', () => {
  it('503 에러는 과부하 안내로 바꾼다', () => {
    expect(toStreamErrorMessage('Gemini API error: 503')).toBe(OVERLOAD_MESSAGE);
  });

  it('429 에러는 요청 과다 안내로 바꾼다', () => {
    expect(toStreamErrorMessage('Claude API error: 429')).toBe(RATE_LIMIT_MESSAGE);
  });

  it.each([TRUNCATED_MESSAGE, BLOCKED_MESSAGE, EMPTY_MESSAGE, INCOMPLETE_MESSAGE])(
    '허용된 안내 문구는 그대로 통과시킨다: %s',
    (message) => {
      expect(toStreamErrorMessage(message)).toBe(message);
    },
  );

  it('JSON 파싱 에러 원문은 고정 문구로 가린다', () => {
    expect(toStreamErrorMessage('JSON Parse error: Unexpected identifier "<html>"')).toBe(
      GENERIC_STREAM_ERROR,
    );
  });

  it('네트워크 에러 원문은 고정 문구로 가린다', () => {
    expect(toStreamErrorMessage('fetch failed: ECONNRESET')).toBe(GENERIC_STREAM_ERROR);
  });
});

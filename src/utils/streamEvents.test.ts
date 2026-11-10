import { describe, it, expect } from 'vitest';
import { applyStreamEvent, finalCodeOf, initialStreamState } from './streamEvents';

describe('applyStreamEvent', () => {
  it('delta 텍스트를 코드에 이어 붙인다', () => {
    const state = applyStreamEvent(
      applyStreamEvent(initialStreamState, { type: 'delta', text: 'const ' }),
      { type: 'delta', text: 'A' },
    );
    expect(state.code).toBe('const A');
  });

  it('done 이벤트의 코드를 최종 코드로 저장한다', () => {
    const state = applyStreamEvent(initialStreamState, { type: 'done', code: 'final' });
    expect(state.finalCode).toBe('final');
  });

  it('error 이벤트는 서버가 보낸 메시지로 예외를 던진다', () => {
    expect(() => applyStreamEvent(initialStreamState, { type: 'error', error: '실패' })).toThrow(
      '실패',
    );
  });

  it('알 수 없는 type은 상태를 바꾸지 않는다', () => {
    const state = applyStreamEvent(initialStreamState, { type: 'heartbeat' });
    expect(state).toEqual(initialStreamState);
  });

  it('code가 문자열이 아닌 done 이벤트는 무시한다', () => {
    const state = applyStreamEvent(initialStreamState, { type: 'done' });
    expect(state.finalCode).toBeNull();
  });

  it('text가 문자열이 아닌 delta 이벤트는 무시한다', () => {
    const state = applyStreamEvent(initialStreamState, { type: 'delta', text: 1 });
    expect(state).toEqual(initialStreamState);
  });

  it('객체가 아닌 값은 무시한다', () => {
    expect(applyStreamEvent(initialStreamState, null)).toEqual(initialStreamState);
  });
});

describe('finalCodeOf', () => {
  it('done을 받았으면 최종 코드를 반환한다', () => {
    expect(finalCodeOf({ code: 'partial', finalCode: 'final' })).toBe('final');
  });

  it('done 없이 끝났으면 끊김 안내 예외를 던진다', () => {
    expect(() => finalCodeOf({ code: 'partial', finalCode: null })).toThrow(
      '응답이 중간에 끊겼습니다. 다시 시도해주세요.',
    );
  });
});

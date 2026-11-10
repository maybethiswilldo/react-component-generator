// 서버가 보내는 스트림 이벤트(delta/done/error)를 누적 상태로 반영하는 순수 함수들.

export interface StreamState {
  code: string;
  finalCode: string | null;
}

export const initialStreamState: StreamState = { code: '', finalCode: null };

export function applyStreamEvent(state: StreamState, event: unknown): StreamState {
  if (typeof event !== 'object' || event === null) return state;
  const { type, text, code, error } = event as Record<string, unknown>;

  if (type === 'delta' && typeof text === 'string') {
    return { ...state, code: state.code + text };
  }
  if (type === 'done' && typeof code === 'string') {
    return { ...state, finalCode: code };
  }
  if (type === 'error') {
    throw new Error(typeof error === 'string' ? error : '생성 중 오류가 발생했습니다. 다시 시도해주세요.');
  }
  return state;
}

/** done 이벤트를 받지 못하고 스트림이 끝났다면 예외를 던진다. */
export function finalCodeOf(state: StreamState): string {
  if (state.finalCode === null) {
    throw new Error('응답이 중간에 끊겼습니다. 다시 시도해주세요.');
  }
  return state.finalCode;
}

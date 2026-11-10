// 프로바이더 SSE 스트림을 파싱하고 클라이언트로 보낼 이벤트를 만드는 순수 함수들.
// 부수효과(Bun.serve 등)가 없어 단위 테스트가 가능하다.
import {
  BLOCKED_MESSAGE,
  EMPTY_MESSAGE,
  INCOMPLETE_MESSAGE,
  TRUNCATED_MESSAGE,
  toStreamErrorMessage,
} from './errors';
import { ensureRenderCall, stripCodeFences } from './generator';

export interface Delta {
  text: string;
  truncated: boolean;
  finished: boolean;
}

export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; code: string }
  | { type: 'error'; error: string };

/** SSE 텍스트 청크를 받아 완성된 이벤트의 `data:` 페이로드 목록을 반환한다. 미완성 이벤트는 버퍼에 보관한다. */
export function createSseParser(): ((chunk: string) => string[]) & { flush: () => string[] } {
  let buffer = '';

  const dataOf = (event: string): string =>
    event
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');

  const parse = (chunk: string): string[] => {
    buffer += chunk;
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() ?? '';
    return events.map(dataOf).filter(Boolean);
  };

  return Object.assign(parse, {
    flush: (): string[] => {
      const rest = dataOf(buffer);
      buffer = '';
      return rest ? [rest] : [];
    },
  });
}

/** Anthropic 스트림 이벤트에서 텍스트 델타와 종료 여부를 꺼낸다. error 이벤트는 예외로 던진다. */
export function anthropicDelta(payload: string): Delta {
  const event = JSON.parse(payload) as {
    type?: string;
    delta?: { type?: string; text?: string };
  };
  if (event.type === 'error') {
    throw new Error('Claude stream error');
  }
  const isText = event.type === 'content_block_delta' && event.delta?.type === 'text_delta';
  return {
    text: isText ? (event.delta?.text ?? '') : '',
    truncated: false,
    finished: event.type === 'message_stop',
  };
}

/** Google 스트림 청크에서 텍스트, MAX_TOKENS 잘림, 종료 여부를 꺼낸다. 에러·비정상 종료는 예외로 던진다. */
export function googleDelta(payload: string): Delta {
  const chunk = JSON.parse(payload) as {
    error?: unknown;
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
  };
  if (chunk.error) {
    throw new Error('Gemini stream error');
  }

  const candidate = chunk.candidates?.[0];
  const reason = candidate?.finishReason;
  if (reason && reason !== 'STOP' && reason !== 'MAX_TOKENS') {
    throw new Error(BLOCKED_MESSAGE);
  }
  return {
    text: candidate?.content?.parts?.map((part) => part.text ?? '').join('') ?? '',
    truncated: reason === 'MAX_TOKENS',
    finished: reason === 'STOP',
  };
}

/** 클라이언트로 보내는 NDJSON 한 줄. */
export function encodeEvent(event: unknown): string {
  return `${JSON.stringify(event)}\n`;
}

/** 바이트 청크 스트림을 SSE로 파싱해 델타를 차례로 내보낸다. */
export async function* readDeltas(
  chunks: AsyncIterable<Uint8Array>,
  extract: (payload: string) => Delta,
): AsyncGenerator<Delta> {
  const parse = createSseParser();
  const decoder = new TextDecoder();

  for await (const chunk of chunks) {
    for (const payload of parse(decoder.decode(chunk, { stream: true }))) {
      yield extract(payload);
    }
  }
  for (const payload of [...parse(decoder.decode()), ...parse.flush()]) {
    yield extract(payload);
  }
}

/** 델타 스트림을 클라이언트 이벤트(delta → done | error)로 변환한다. 항상 done 또는 error 하나로 끝난다. */
export async function* generateEvents(
  deltas: AsyncIterable<Delta>,
  provider: 'anthropic' | 'google',
): AsyncGenerator<StreamEvent> {
  let full = '';
  let finished = false;

  try {
    for await (const delta of deltas) {
      if (delta.text) {
        full += delta.text;
        yield { type: 'delta', text: delta.text };
      }
      // MAX_TOKENS 잘림 감지는 Google 경로에만 있다 (Anthropic은 의도적으로 제외).
      if (provider === 'google' && delta.truncated) {
        yield { type: 'error', error: TRUNCATED_MESSAGE };
        return;
      }
      if (delta.finished) finished = true;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    yield { type: 'error', error: toStreamErrorMessage(message) };
    return;
  }

  if (!full.trim()) {
    yield { type: 'error', error: EMPTY_MESSAGE };
  } else if (!finished) {
    yield { type: 'error', error: INCOMPLETE_MESSAGE };
  } else {
    yield { type: 'done', code: ensureRenderCall(stripCodeFences(full)) };
  }
}

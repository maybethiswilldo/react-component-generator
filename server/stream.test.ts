import { describe, it, expect } from 'vitest';
import {
  createSseParser,
  anthropicDelta,
  googleDelta,
  encodeEvent,
  readDeltas,
  generateEvents,
  type Delta,
} from './stream';
import {
  TRUNCATED_MESSAGE,
  BLOCKED_MESSAGE,
  EMPTY_MESSAGE,
  INCOMPLETE_MESSAGE,
  GENERIC_STREAM_ERROR,
  OVERLOAD_MESSAGE,
} from './errors';

describe('createSseParser', () => {
  it('완성된 이벤트의 data 페이로드를 반환한다', () => {
    const parse = createSseParser();
    expect(parse('data: {"a":1}\n\n')).toEqual(['{"a":1}']);
  });

  it('여러 이벤트가 한 청크에 들어와도 모두 반환한다', () => {
    const parse = createSseParser();
    expect(parse('data: one\n\ndata: two\n\n')).toEqual(['one', 'two']);
  });

  it('청크 경계에서 잘린 이벤트는 다음 청크와 합쳐 반환한다', () => {
    const parse = createSseParser();
    expect(parse('data: {"te')).toEqual([]);
    expect(parse('xt":"hi"}\n\n')).toEqual(['{"text":"hi"}']);
  });

  it('CRLF 줄바꿈도 처리한다', () => {
    const parse = createSseParser();
    expect(parse('data: x\r\n\r\n')).toEqual(['x']);
  });

  it('event: 줄 등 data가 아닌 줄은 무시한다', () => {
    const parse = createSseParser();
    expect(parse('event: content_block_delta\ndata: y\n\n')).toEqual(['y']);
  });

  it('여러 줄의 data는 개행으로 이어 하나의 페이로드로 반환한다', () => {
    const parse = createSseParser();
    expect(parse('data: a\ndata: b\n\n')).toEqual(['a\nb']);
  });

  it('개행 없이 끝난 마지막 이벤트는 flush로 꺼낼 수 있다', () => {
    const parse = createSseParser();
    expect(parse('data: x')).toEqual([]);
    expect(parse.flush()).toEqual(['x']);
  });
});

describe('anthropicDelta', () => {
  it('content_block_delta의 text_delta에서 텍스트를 꺼낸다', () => {
    const payload = JSON.stringify({
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: 'const A' },
    });
    expect(anthropicDelta(payload)).toEqual({ text: 'const A', truncated: false, finished: false });
  });

  it('텍스트 델타가 아닌 이벤트는 빈 텍스트를 반환한다', () => {
    expect(anthropicDelta(JSON.stringify({ type: 'message_start' }))).toEqual({
      text: '',
      truncated: false,
      finished: false,
    });
  });

  it('message_stop 이벤트는 종료로 표시한다', () => {
    expect(anthropicDelta(JSON.stringify({ type: 'message_stop' })).finished).toBe(true);
  });

  it('error 이벤트는 예외를 던진다', () => {
    const payload = JSON.stringify({ type: 'error', error: { type: 'overloaded_error' } });
    expect(() => anthropicDelta(payload)).toThrow();
  });
});

describe('googleDelta', () => {
  it('candidates의 parts 텍스트를 이어 붙여 반환한다', () => {
    const payload = JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'foo' }, { text: 'bar' }] } }],
    });
    expect(googleDelta(payload)).toEqual({ text: 'foobar', truncated: false, finished: false });
  });

  it('finishReason이 MAX_TOKENS면 truncated를 true로 표시한다', () => {
    const payload = JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'x' }] }, finishReason: 'MAX_TOKENS' }],
    });
    expect(googleDelta(payload)).toEqual({ text: 'x', truncated: true, finished: false });
  });

  it('finishReason이 STOP이면 종료로 표시한다', () => {
    const payload = JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'x' }] }, finishReason: 'STOP' }],
    });
    expect(googleDelta(payload)).toEqual({ text: 'x', truncated: false, finished: true });
  });

  it('SAFETY 같은 비정상 finishReason은 중단 안내 예외를 던진다', () => {
    const payload = JSON.stringify({ candidates: [{ finishReason: 'SAFETY' }] });
    expect(() => googleDelta(payload)).toThrow(BLOCKED_MESSAGE);
  });

  it('error 페이로드는 예외를 던진다', () => {
    const payload = JSON.stringify({ error: { code: 503, message: 'overloaded' } });
    expect(() => googleDelta(payload)).toThrow();
  });

  it('candidates가 없으면 빈 텍스트를 반환한다', () => {
    expect(googleDelta('{}')).toEqual({ text: '', truncated: false, finished: false });
  });
});

describe('encodeEvent', () => {
  it('JSON 한 줄과 개행으로 인코딩한다', () => {
    expect(encodeEvent({ type: 'delta', text: 'a' })).toBe('{"type":"delta","text":"a"}\n');
  });
});

async function* chunksOf(...parts: Uint8Array[]): AsyncGenerator<Uint8Array> {
  for (const part of parts) yield part;
}

const textExtract = (payload: string): Delta => ({ text: payload, truncated: false, finished: false });

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterable) items.push(item);
  return items;
}

describe('readDeltas', () => {
  it('청크 경계에서 쪼개진 멀티바이트 문자를 깨뜨리지 않는다', async () => {
    const bytes = new TextEncoder().encode('data: 한\n\n');
    const split = bytes.indexOf(0xed) + 1; // '한'(3바이트)의 첫 바이트 직후에서 자른다
    const deltas = await collect(
      readDeltas(chunksOf(bytes.slice(0, split), bytes.slice(split)), textExtract),
    );
    expect(deltas.map((d) => d.text)).toEqual(['한']);
  });

  it('개행 없이 끝난 마지막 이벤트도 전달한다', async () => {
    const bytes = new TextEncoder().encode('data: last');
    const deltas = await collect(readDeltas(chunksOf(bytes), textExtract));
    expect(deltas.map((d) => d.text)).toEqual(['last']);
  });
});

async function* deltasOf(...items: Array<Delta | Error>): AsyncGenerator<Delta> {
  for (const item of items) {
    if (item instanceof Error) throw item;
    yield item;
  }
}

const text = (value: string): Delta => ({ text: value, truncated: false, finished: false });
const end: Delta = { text: '', truncated: false, finished: true };

describe('generateEvents', () => {
  it('텍스트를 delta 이벤트로 순서대로 내보낸다', async () => {
    const events = await collect(generateEvents(deltasOf(text('const A'), text(' = 1;'), end), 'anthropic'));
    expect(events.slice(0, 2)).toEqual([
      { type: 'delta', text: 'const A' },
      { type: 'delta', text: ' = 1;' },
    ]);
  });

  it('마지막에 코드펜스를 제거하고 render를 보장한 done을 내보낸다', async () => {
    const events = await collect(
      generateEvents(deltasOf(text('```jsx\nconst Card = () => null;\n```'), end), 'anthropic'),
    );
    expect(events.at(-1)).toEqual({
      type: 'done',
      code: 'const Card = () => null;\n\nrender(<Card />);',
    });
  });

  it('Google에서 잘리면 안내 문구의 error로 끝낸다', async () => {
    const truncated: Delta = { text: 'x', truncated: true, finished: false };
    const events = await collect(generateEvents(deltasOf(truncated), 'google'));
    expect(events.at(-1)).toEqual({ type: 'error', error: TRUNCATED_MESSAGE });
  });

  it('Anthropic에서는 truncated 표시를 오류로 보지 않는다', async () => {
    const truncated: Delta = { text: 'const A = 1;', truncated: true, finished: true };
    const events = await collect(generateEvents(deltasOf(truncated), 'anthropic'));
    expect(events.at(-1)?.type).toBe('done');
  });

  it('텍스트가 없으면 빈 코드 안내의 error로 끝낸다', async () => {
    const events = await collect(generateEvents(deltasOf(end), 'google'));
    expect(events).toEqual([{ type: 'error', error: EMPTY_MESSAGE }]);
  });

  it('종료 신호 없이 끝나면 done 대신 error로 끝낸다', async () => {
    const events = await collect(generateEvents(deltasOf(text('const A = 1;')), 'google'));
    expect(events.at(-1)).toEqual({ type: 'error', error: INCOMPLETE_MESSAGE });
  });

  it('업스트림 예외 원문은 고정 문구로 가려 error로 끝낸다', async () => {
    const events = await collect(
      generateEvents(deltasOf(text('const'), new SyntaxError('JSON Parse error: <html>')), 'google'),
    );
    expect(events.at(-1)).toEqual({ type: 'error', error: GENERIC_STREAM_ERROR });
  });

  it('상태 코드가 담긴 예외는 안내 문구로 바꿔 error로 끝낸다', async () => {
    const events = await collect(
      generateEvents(deltasOf(new Error('Gemini API error: 503')), 'google'),
    );
    expect(events).toEqual([{ type: 'error', error: OVERLOAD_MESSAGE }]);
  });

  it('error 이후에는 done을 내보내지 않는다', async () => {
    const events = await collect(
      generateEvents(deltasOf(text('const'), new Error('boom')), 'anthropic'),
    );
    expect(events.some((e) => e.type === 'done')).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { createSseParser, anthropicDelta, googleDelta, encodeEvent } from './stream';

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
});

describe('anthropicDelta', () => {
  it('content_block_delta의 text_delta에서 텍스트를 꺼낸다', () => {
    const payload = JSON.stringify({
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: 'const A' },
    });
    expect(anthropicDelta(payload)).toBe('const A');
  });

  it('텍스트 델타가 아닌 이벤트는 빈 문자열을 반환한다', () => {
    expect(anthropicDelta(JSON.stringify({ type: 'message_start' }))).toBe('');
  });
});

describe('googleDelta', () => {
  it('candidates의 parts 텍스트를 이어 붙여 반환한다', () => {
    const payload = JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'foo' }, { text: 'bar' }] } }],
    });
    expect(googleDelta(payload)).toEqual({ text: 'foobar', truncated: false });
  });

  it('finishReason이 MAX_TOKENS면 truncated를 true로 표시한다', () => {
    const payload = JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'x' }] }, finishReason: 'MAX_TOKENS' }],
    });
    expect(googleDelta(payload)).toEqual({ text: 'x', truncated: true });
  });

  it('candidates가 없으면 빈 텍스트를 반환한다', () => {
    expect(googleDelta('{}')).toEqual({ text: '', truncated: false });
  });
});

describe('encodeEvent', () => {
  it('JSON 한 줄과 개행으로 인코딩한다', () => {
    expect(encodeEvent({ type: 'delta', text: 'a' })).toBe('{"type":"delta","text":"a"}\n');
  });
});

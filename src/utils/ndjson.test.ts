import { describe, it, expect } from 'vitest';
import { createNdjsonParser } from './ndjson';

describe('createNdjsonParser', () => {
  it('완성된 줄을 JSON 객체로 반환한다', () => {
    const parse = createNdjsonParser();
    expect(parse('{"type":"delta","text":"a"}\n')).toEqual([{ type: 'delta', text: 'a' }]);
  });

  it('한 청크의 여러 줄을 모두 반환한다', () => {
    const parse = createNdjsonParser();
    expect(parse('{"n":1}\n{"n":2}\n')).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it('청크 경계에서 잘린 줄은 다음 청크와 합쳐 반환한다', () => {
    const parse = createNdjsonParser();
    expect(parse('{"n":')).toEqual([]);
    expect(parse('1}\n')).toEqual([{ n: 1 }]);
  });

  it('깨진 JSON 줄은 건너뛰고 나머지 줄은 반환한다', () => {
    const parse = createNdjsonParser();
    expect(parse('{"n":1}\n<html>oops\n{"n":2}\n')).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it('빈 줄은 무시한다', () => {
    const parse = createNdjsonParser();
    expect(parse('\n{"n":1}\n\n')).toEqual([{ n: 1 }]);
  });
});

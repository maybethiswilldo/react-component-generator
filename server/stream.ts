// 프로바이더 SSE 스트림을 파싱하고 클라이언트로 보낼 이벤트를 인코딩하는 순수 함수들.
// 부수효과(Bun.serve 등)가 없어 단위 테스트가 가능하다.

/** SSE 텍스트 청크를 받아 완성된 이벤트의 `data:` 페이로드 목록을 반환한다. 미완성 이벤트는 버퍼에 보관한다. */
export function createSseParser(): (chunk: string) => string[] {
  let buffer = '';

  return (chunk) => {
    buffer += chunk;
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() ?? '';

    const payloads: string[] = [];
    for (const event of events) {
      const data = event
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (data) payloads.push(data);
    }
    return payloads;
  };
}

/** Anthropic 스트림 이벤트에서 텍스트 델타를 꺼낸다. 텍스트 이벤트가 아니면 빈 문자열. */
export function anthropicDelta(payload: string): string {
  const event = JSON.parse(payload) as {
    type?: string;
    delta?: { type?: string; text?: string };
  };
  if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
    return event.delta.text ?? '';
  }
  return '';
}

/** Google 스트림 청크에서 텍스트와 MAX_TOKENS 잘림 여부를 꺼낸다. */
export function googleDelta(payload: string): { text: string; truncated: boolean } {
  const chunk = JSON.parse(payload) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
  };
  const candidate = chunk.candidates?.[0];
  return {
    text: candidate?.content?.parts?.map((part) => part.text ?? '').join('') ?? '',
    truncated: candidate?.finishReason === 'MAX_TOKENS',
  };
}

/** 클라이언트로 보내는 NDJSON 한 줄. */
export function encodeEvent(event: unknown): string {
  return `${JSON.stringify(event)}\n`;
}

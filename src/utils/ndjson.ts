// 서버가 보내는 NDJSON 스트림 청크를 줄 단위 JSON 객체로 파싱한다. 미완성 줄은 버퍼에 보관한다.
// 깨진 줄은 예외 메시지가 사용자에게 노출되지 않도록 건너뛴다.
export function createNdjsonParser(): (chunk: string) => unknown[] {
  let buffer = '';

  return (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    const events: unknown[] = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        events.push(JSON.parse(line));
      } catch {
        // 깨진 줄은 무시한다.
      }
    }
    return events;
  };
}

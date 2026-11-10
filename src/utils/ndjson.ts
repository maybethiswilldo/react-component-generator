// 서버가 보내는 NDJSON 스트림 청크를 줄 단위 JSON 객체로 파싱한다. 미완성 줄은 버퍼에 보관한다.
export function createNdjsonParser(): (chunk: string) => unknown[] {
  let buffer = '';

  return (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    return lines.filter((line) => line.trim()).map((line) => JSON.parse(line));
  };
}

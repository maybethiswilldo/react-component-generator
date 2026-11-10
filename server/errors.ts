export const OVERLOAD_MESSAGE = 'API 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.';
export const RATE_LIMIT_MESSAGE = '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
export const TRUNCATED_MESSAGE = '생성된 코드가 너무 길어 잘렸습니다. 더 간단한 컴포넌트를 요청해주세요.';
export const BLOCKED_MESSAGE = '모델이 응답을 중단했습니다. 요청 내용을 바꿔 다시 시도해주세요.';
export const EMPTY_MESSAGE = '생성된 코드가 비어 있습니다. 다시 시도해주세요.';
export const INCOMPLETE_MESSAGE = '응답이 완료되기 전에 끊겼습니다. 다시 시도해주세요.';
export const GENERIC_STREAM_ERROR = '생성 중 오류가 발생했습니다. 다시 시도해주세요.';

// 스트림 도중에는 아래 문구만 클라이언트에 그대로 노출한다. 그 외 예외 원문(JSON 파싱 에러, 네트워크 에러 등)은 가린다.
const SAFE_STREAM_MESSAGES = new Set([
  TRUNCATED_MESSAGE,
  BLOCKED_MESSAGE,
  EMPTY_MESSAGE,
  INCOMPLETE_MESSAGE,
]);

// 상태 코드가 더 긴 숫자의 일부(예: 5031)인 경우는 제외한다.
function hasStatus(message: string, status: number): boolean {
  return new RegExp(`(?<!\\d)${status}(?!\\d)`).test(message);
}

export function toErrorBody(message: string): { error: string; status: number } {
  if (hasStatus(message, 503)) return { error: OVERLOAD_MESSAGE, status: 503 };
  if (hasStatus(message, 429)) return { error: RATE_LIMIT_MESSAGE, status: 429 };
  return { error: message, status: 500 };
}

export function toStreamErrorMessage(message: string): string {
  if (SAFE_STREAM_MESSAGES.has(message)) return message;
  const { error, status } = toErrorBody(message);
  return status === 500 ? GENERIC_STREAM_ERROR : error;
}

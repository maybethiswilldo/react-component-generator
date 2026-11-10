import { useEffect, useRef } from 'react';

interface StreamingCardProps {
  prompt: string;
  code: string;
}

// 생성 중인 코드를 코드 탭 형태로 실시간 표시한다. 완료되면 App이 이 카드를 내리고,
// 새로 마운트되는 ComponentCard가 기본값인 미리보기 탭으로 열린다.
export function StreamingCard({ prompt, code }: StreamingCardProps) {
  const blockRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const block = blockRef.current;
    if (block) block.scrollTop = block.scrollHeight;
  }, [code]);

  return (
    <div className="window component-card streaming-card" role="status" aria-label="컴포넌트 생성 중">
      <div className="win-bar">
        <span className="win-title">생성 중...</span>
      </div>
      <div className="card-header">
        <p className="card-prompt">{prompt}</p>
      </div>
      <div className="card-tabs" role="tablist">
        <button role="tab" aria-selected={false} className="tab" disabled>
          미리보기
        </button>
        <button role="tab" aria-selected={true} className="tab tab--active">
          코드
        </button>
      </div>
      <div className="card-content">
        <div className="loading-bar" aria-hidden="true" />
        <pre ref={blockRef} className="code-block code-block--streaming">
          <code>{code || '응답을 기다리는 중...'}</code>
        </pre>
      </div>
    </div>
  );
}

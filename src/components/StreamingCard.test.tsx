import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StreamingCard } from './StreamingCard';

describe('StreamingCard', () => {
  it('코드 탭이 선택된 상태로 표시된다', () => {
    render(<StreamingCard prompt="버튼" code="const A" />);
    expect(screen.getByRole('tab', { name: '코드' })).toHaveAttribute('aria-selected', 'true');
  });

  it('미리보기 탭은 비활성화된다', () => {
    render(<StreamingCard prompt="버튼" code="const A" />);
    expect(screen.getByRole('tab', { name: '미리보기' })).toBeDisabled();
  });

  it('지금까지 스트리밍된 코드를 보여준다', () => {
    render(<StreamingCard prompt="버튼" code="const Button = () => {" />);
    expect(screen.getByText('const Button = () => {')).toBeInTheDocument();
  });

  it('아직 코드가 없으면 대기 문구를 보여준다', () => {
    render(<StreamingCard prompt="버튼" code="" />);
    expect(screen.getByText('응답을 기다리는 중...')).toBeInTheDocument();
  });

  it('요청한 프롬프트를 보여준다', () => {
    render(<StreamingCard prompt="파란 버튼 만들어줘" code="" />);
    expect(screen.getByText('파란 버튼 만들어줘')).toBeInTheDocument();
  });
});

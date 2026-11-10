import { useState, useEffect } from 'react';
import { PromptInput } from './components/PromptInput';
import { ComponentCard } from './components/ComponentCard';
import { useComponentGenerator } from './hooks/useComponentGenerator';
import { useLocalStorageState } from './hooks/useLocalStorageState';
import {
  STORAGE_KEYS,
  addToHistory,
  parseHistory,
  parseProvider,
  parseString,
} from './utils/storage';
import type { Provider } from './types';
import './App.css';

const PROVIDER_CONFIG = {
  anthropic: { label: 'Anthropic', placeholder: 'sk-ant-...' },
  google: { label: 'Google', placeholder: 'AIza...' },
} as const;

function App() {
  const [apiKey, setApiKey] = useLocalStorageState(STORAGE_KEYS.apiKey, parseString, '');
  const [showKey, setShowKey] = useState(false);
  const [provider, setProvider] = useLocalStorageState<Provider>(
    STORAGE_KEYS.provider,
    parseProvider,
    'google',
  );
  const [history, setHistory] = useLocalStorageState(STORAGE_KEYS.history, parseHistory, []);
  const [envKeys, setEnvKeys] = useState<Record<Provider, boolean>>({
    anthropic: false,
    google: false,
  });
  const { components, isLoading, error, generate, removeComponent, clearAll } =
    useComponentGenerator();

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => setEnvKeys(data.envKeys))
      .catch(() => {});
  }, []);

  const hasEnvKey = envKeys[provider];

  const handleGenerate = (prompt: string) => {
    if (!apiKey.trim() && !hasEnvKey) {
      alert(`${PROVIDER_CONFIG[provider].label} API 키를 입력하거나 .env에 설정해주세요.`);
      return;
    }
    setHistory((prev) => addToHistory(prev, prompt));
    generate(prompt, apiKey || undefined, provider);
  };

  const handleProviderChange = (newProvider: Provider) => {
    setProvider(newProvider);
    setApiKey('');
  };

  const activeProvider = PROVIDER_CONFIG[provider].label;

  return (
    <div className="app">
      <header className="menubar">
        <div className="menubar-brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>React 컴포넌트 생성기</span>
        </div>
        <dl className="menubar-status" aria-label="현재 작업 상태">
          <div>
            <dt>Provider</dt>
            <dd>{activeProvider}</dd>
          </div>
          <div>
            <dt>컴포넌트</dt>
            <dd>{components.length}개</dd>
          </div>
        </dl>
      </header>

      <div className="hero">
        <h1>프롬프트로 만드는 UI 워크벤치</h1>
        <p>만들고 싶은 화면을 글로 적으면, React 컴포넌트가 창으로 열립니다.</p>
        <div className="stripe" aria-hidden="true" />
      </div>

      <main className="workspace">
        <section className="window composer-panel" aria-label="컴포넌트 생성">
          <div className="win-bar">
            <h2 className="win-title">새 컴포넌트</h2>
          </div>
          <div className="win-body">
            <PromptInput onGenerate={handleGenerate} isLoading={isLoading} history={history} />
          </div>
        </section>

        <aside className="window settings-panel" aria-label="실행 설정">
          <div className="win-bar">
            <h2 className="win-title">실행 설정</h2>
          </div>
          <div className="win-body">
            <div className="provider-select">
              <label htmlFor="provider">Provider</label>
              <select
                id="provider"
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value as Provider)}
              >
                {Object.entries(PROVIDER_CONFIG).map(([key, { label }]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="api-key-input">
              <label htmlFor="api-key">API Key</label>
              <div className="api-key-field">
                <input
                  id="api-key"
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    hasEnvKey
                      ? '서버 키 사용 중 (직접 입력으로 덮어쓰기 가능)'
                      : PROVIDER_CONFIG[provider].placeholder
                  }
                />
                <button
                  className="btn-toggle-key"
                  onClick={() => setShowKey(!showKey)}
                  type="button"
                >
                  {showKey ? '숨기기' : '보기'}
                </button>
              </div>
              <p className={`key-status ${hasEnvKey ? 'key-status--ready' : ''}`}>
                {hasEnvKey ? '.env 키가 연결되어 있습니다.' : '직접 입력하거나 서버 환경변수를 설정하세요.'}
              </p>
            </div>
          </div>
        </aside>
      </main>

      {error && (
        <div className="error-banner" role="alert">
          <span className="error-icon" aria-hidden="true">!</span>
          <p>{error}</p>
        </div>
      )}

      <section className="results-section">
        {components.length > 0 && (
          <div className="results-header">
            <h2>생성된 컴포넌트</h2>
            <button className="btn-clear" onClick={clearAll}>
              전체 삭제
            </button>
          </div>
        )}

        {components.length === 0 && !isLoading && (
          <div className="window empty-state">
            <div className="win-bar">
              <h2 className="win-title">아직 비어 있습니다</h2>
            </div>
            <div className="empty-body">
              <div className="empty-preview" aria-hidden="true">
                <div className="empty-window">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="empty-canvas">
                  <div className="empty-card empty-card--primary" />
                  <div className="empty-card" />
                  <div className="empty-card empty-card--wide" />
                </div>
              </div>
              <div className="empty-copy">
                <h3>새 컴포넌트를 생성해보세요.</h3>
                <p>위 입력창에 화면을 설명하거나, 예시 목록에서 하나를 골라 시작하세요.</p>
              </div>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="window loading-card" role="status">
            <div className="win-bar">
              <h2 className="win-title">생성 중</h2>
            </div>
            <div className="loading-body">
              <p>컴포넌트를 생성하고 있습니다...</p>
              <div className="loading-bar" aria-hidden="true" />
            </div>
          </div>
        )}

        <div className="results-grid">
          {components.map((component) => (
            <ComponentCard
              key={component.id}
              component={component}
              onRemove={removeComponent}
              onRegenerate={handleGenerate}
              isLoading={isLoading}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

export default App;

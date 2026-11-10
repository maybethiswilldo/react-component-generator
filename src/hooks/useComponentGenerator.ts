import { useState, useCallback } from 'react';
import type { GeneratedComponent, Provider } from '../types';
import { STORAGE_KEYS, parseComponents } from '../utils/storage';
import { createNdjsonParser } from '../utils/ndjson';
import { applyStreamEvent, finalCodeOf, initialStreamState } from '../utils/streamEvents';
import { useLocalStorageState } from './useLocalStorageState';

interface UseComponentGeneratorReturn {
  components: GeneratedComponent[];
  isLoading: boolean;
  error: string | null;
  streaming: { prompt: string; code: string } | null;
  generate: (prompt: string, apiKey: string | undefined, provider: Provider) => Promise<void>;
  removeComponent: (id: string) => void;
  clearAll: () => void;
}

export function useComponentGenerator(): UseComponentGeneratorReturn {
  const [components, setComponents] = useLocalStorageState<GeneratedComponent[]>(
    STORAGE_KEYS.components,
    parseComponents,
    [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 생성 중에만 값이 있고(누적 코드), 아니면 null.
  const [streaming, setStreaming] = useState<{ prompt: string; code: string } | null>(null);

  const generate = useCallback(async (prompt: string, apiKey: string | undefined, provider: Provider) => {
    setIsLoading(true);
    setError(null);
    setStreaming({ prompt, code: '' });

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ...(apiKey && { apiKey }), provider }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to generate component');
      }

      const parse = createNdjsonParser();
      const decoder = new TextDecoder();
      const reader = res.body.getReader();
      let state = initialStreamState;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        for (const event of parse(decoder.decode(value, { stream: true }))) {
          state = applyStreamEvent(state, event);
        }
        const { code } = state;
        setStreaming((prev) => prev && { ...prev, code });
      }

      const newComponent: GeneratedComponent = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        prompt,
        code: finalCodeOf(state),
        createdAt: new Date(),
      };

      setComponents((prev) => [newComponent, ...prev]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setIsLoading(false);
      setStreaming(null);
    }
  }, [setComponents]);

  const removeComponent = useCallback((id: string) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
  }, [setComponents]);

  const clearAll = useCallback(() => {
    setComponents([]);
  }, [setComponents]);

  return { components, isLoading, error, streaming, generate, removeComponent, clearAll };
}

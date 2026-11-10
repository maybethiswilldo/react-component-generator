import { useState, useEffect } from 'react';
import { readStorage, writeStorage } from '../utils/storage';

export function useLocalStorageState<T>(
  key: string,
  parse: (raw: unknown) => T,
  fallback: T,
) {
  const [value, setValue] = useState<T>(() => readStorage(key, parse, fallback));

  useEffect(() => {
    writeStorage(key, value);
  }, [key, value]);

  return [value, setValue] as const;
}

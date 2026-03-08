import { Howl } from 'howler';
import React, { createContext, useCallback, useRef } from 'react';

type AudioCacheContextType = {
  get: (src: string) => Howl | undefined;
  set: (src: string, howl: Howl) => void;
  remove: (src: string) => void;
  clear: () => void;
};

export const AudioCacheContext = createContext<AudioCacheContextType>({
  get: () => undefined,
  set: () => {},
  remove: () => {},
  clear: () => {},
});

export function AudioCacheProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const cacheRef = useRef<Map<string, Howl>>(new Map());

  const get = useCallback(
    (src: string) => cacheRef.current.get(src),
    [],
  );
  const set = useCallback(
    (src: string, howl: Howl) => cacheRef.current.set(src, howl),
    [],
  );
  const remove = useCallback((src: string) => {
    cacheRef.current.delete(src);
  }, []);
  const clear = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  return (
    <AudioCacheContext.Provider value={{ get, set, remove, clear }}>
      {children}
    </AudioCacheContext.Provider>
  );
}

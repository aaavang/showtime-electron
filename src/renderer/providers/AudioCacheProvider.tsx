import React, { createContext, useCallback, useMemo, useRef } from 'react';

type AudioCacheContextType = {
  get: (src: string) => AudioBuffer | undefined;
  set: (src: string, buffer: AudioBuffer) => void;
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
  const cacheRef = useRef<Map<string, AudioBuffer>>(new Map());

  const get = useCallback((src: string) => cacheRef.current.get(src), []);
  const set = useCallback(
    (src: string, buffer: AudioBuffer) => cacheRef.current.set(src, buffer),
    [],
  );
  const remove = useCallback((src: string) => {
    cacheRef.current.delete(src);
  }, []);
  const clear = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  const value = useMemo(
    () => ({ get, set, remove, clear }),
    [get, set, remove, clear],
  );

  return (
    <AudioCacheContext.Provider value={value}>
      {children}
    </AudioCacheContext.Provider>
  );
}

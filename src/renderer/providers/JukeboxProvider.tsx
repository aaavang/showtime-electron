import React, { createContext } from 'react';
import { useJukebox } from '../hooks/useJukebox';

export const JukeboxContext = createContext(
  {} as ReturnType<typeof useJukebox>,
);

export function JukeboxProvider({ children }: { children: React.ReactNode }) {
  const jukebox = useJukebox();

  return (
    <JukeboxContext.Provider value={jukebox}>
      {children}
    </JukeboxContext.Provider>
  );
}

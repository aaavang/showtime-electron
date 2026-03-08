import { useContext, useEffect, useRef } from 'react';
import { Song } from '../database';
import { AudioCacheContext } from '../providers/AudioCacheProvider';
import { UserSettingsContext } from '../providers/UserSettingsProvider';
import { useSongPathEncoder } from './useSongPathEncoder';

export function useAudioPreloader(songs: Song[]) {
  const [userSettings] = useContext(UserSettingsContext);
  const songPathEncoder = useSongPathEncoder();
  const audioCache = useContext(AudioCacheContext);
  const localSrcsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!userSettings.preloadAudio) {
      for (const src of localSrcsRef.current) {
        audioCache.remove(src);
      }
      localSrcsRef.current.clear();
      return undefined;
    }

    const currentSrcs = new Set(songs.map((s) => songPathEncoder(s)));

    // Remove songs no longer in the list
    for (const src of localSrcsRef.current) {
      if (!currentSrcs.has(src)) {
        audioCache.remove(src);
        localSrcsRef.current.delete(src);
      }
    }

    // Preload new songs via IPC
    const unsubscribes: Array<() => void> = [];
    for (const song of songs) {
      const src = songPathEncoder(song);
      if (!audioCache.get(src)) {
        localSrcsRef.current.add(src);
        let unsubscribe: (() => void) | undefined;
        const handler = async (event: any) => {
          if (event.src !== src) return;
          unsubscribe?.();
          if (event.error) return;
          try {
            const ctx = new window.AudioContext();
            const audioBuffer = await ctx.decodeAudioData(event.buffer);
            audioCache.set(src, audioBuffer);
          } catch {
            // Silently skip failed preloads
          }
        };
        unsubscribe = window.electron.ipcRenderer.on('readAudioFile', handler);
        unsubscribes.push(unsubscribe);
        window.electron.ipcRenderer.sendMessage('readAudioFile', src);
      }
    }

    const srcsToCleanup = localSrcsRef.current;
    const unsubs = unsubscribes;
    return () => {
      for (const unsub of unsubs) {
        unsub();
      }
      for (const src of srcsToCleanup) {
        audioCache.remove(src);
      }
      srcsToCleanup.clear();
    };
  }, [songs, userSettings.preloadAudio, audioCache, songPathEncoder]);
}

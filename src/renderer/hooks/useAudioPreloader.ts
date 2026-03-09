import { useContext, useEffect, useRef } from 'react';
import { Song } from '../database';
import { AudioCacheContext } from '../providers/AudioCacheProvider';
import { UserSettingsContext } from '../providers/UserSettingsProvider';
import { useSongPathEncoder } from './useSongPathEncoder';

let sharedAudioContext: AudioContext | null = null;
function getAudioContext() {
  if (!sharedAudioContext) {
    sharedAudioContext = new window.AudioContext();
  }
  return sharedAudioContext;
}

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

    // Remove only songs no longer in the list
    for (const src of localSrcsRef.current) {
      if (!currentSrcs.has(src)) {
        audioCache.remove(src);
        localSrcsRef.current.delete(src);
      }
    }

    // Find songs that need preloading (not already cached)
    const toPreload = songs.filter((song) => {
      const src = songPathEncoder(song);
      return !audioCache.get(src);
    });

    let cancelled = false;

    const preloadSequentially = async () => {
      for (const song of toPreload) {
        if (cancelled) break;
        const src = songPathEncoder(song);
        if (audioCache.get(src)) continue;

        localSrcsRef.current.add(src);

        try {
          const buffer = await new Promise<ArrayBuffer | null>((resolve) => {
            const unsubscribe = window.electron.ipcRenderer.on(
              'readAudioFile',
              (event: any) => {
                if (event.src !== src) return;
                unsubscribe();
                if (event.error) resolve(null);
                else resolve(event.buffer);
              },
            );
            window.electron.ipcRenderer.sendMessage('readAudioFile', src);
          });

          if (cancelled || !buffer) continue;

          const audioBuffer = await getAudioContext().decodeAudioData(buffer);
          if (!cancelled) {
            audioCache.set(src, audioBuffer);
          }
        } catch {
          // Silently skip failed preloads
        }
      }
    };

    preloadSequentially();

    return () => {
      cancelled = true;
    };
  }, [songs, userSettings.preloadAudio, audioCache, songPathEncoder]);

  // Cleanup only on unmount — remove all locally tracked srcs
  useEffect(() => {
    const srcs = localSrcsRef.current;
    return () => {
      for (const src of srcs) {
        audioCache.remove(src);
      }
      srcs.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

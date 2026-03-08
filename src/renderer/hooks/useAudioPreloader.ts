import { Howl } from 'howler';
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
      // Setting disabled — unload everything we preloaded
      for (const src of localSrcsRef.current) {
        const howl = audioCache.get(src);
        if (howl) {
          howl.unload();
          audioCache.remove(src);
        }
      }
      localSrcsRef.current.clear();
      return undefined;
    }

    const currentSrcs = new Set(songs.map((s) => songPathEncoder(s)));

    // Remove songs no longer in the list
    for (const src of localSrcsRef.current) {
      if (!currentSrcs.has(src)) {
        const howl = audioCache.get(src);
        if (howl) {
          howl.unload();
          audioCache.remove(src);
        }
        localSrcsRef.current.delete(src);
      }
    }

    // Preload new songs
    for (const song of songs) {
      const src = songPathEncoder(song);
      if (!audioCache.get(src)) {
        const howl = new Howl({
          src: [src],
          html5: userSettings.useHTML5Audio,
          preload: true,
        });
        audioCache.set(src, howl);
        localSrcsRef.current.add(src);
      }
    }

    return () => {
      // Cleanup on unmount
      for (const src of localSrcsRef.current) {
        const howl = audioCache.get(src);
        if (howl) {
          howl.unload();
          audioCache.remove(src);
        }
      }
      localSrcsRef.current.clear();
    };
  }, [songs, userSettings.preloadAudio, userSettings.useHTML5Audio]);
}

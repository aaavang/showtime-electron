import { Howl } from 'howler';
import { useContext, useEffect, useRef } from 'react';
import { Song } from '../database';
import { UserSettingsContext } from '../providers/UserSettingsProvider';
import { useSongPathEncoder } from './useSongPathEncoder';

export function useAudioPreloader(songs: Song[]) {
  const [userSettings] = useContext(UserSettingsContext);
  const songPathEncoder = useSongPathEncoder();
  const cacheRef = useRef<Map<number, Howl>>(new Map());

  useEffect(() => {
    if (!userSettings.preloadAudio) {
      // Setting disabled — unload everything
      cacheRef.current.forEach((howl) => howl.unload());
      cacheRef.current.clear();
      return;
    }

    const currentIds = new Set(songs.map((s) => s.id));
    const cache = cacheRef.current;

    // Remove songs no longer in the list
    for (const [id, howl] of cache) {
      if (!currentIds.has(id)) {
        howl.unload();
        cache.delete(id);
      }
    }

    // Preload new songs
    for (const song of songs) {
      if (!cache.has(song.id)) {
        const howl = new Howl({
          src: [songPathEncoder(song)],
          html5: userSettings.useHTML5Audio,
          preload: true,
        });
        cache.set(song.id, howl);
      }
    }

    return () => {
      // Cleanup on unmount
      cache.forEach((howl) => howl.unload());
      cache.clear();
    };
  }, [songs, userSettings.preloadAudio, userSettings.useHTML5Audio]);
}

import { useCallback, useContext } from 'react';
import { Song } from '../database';
import { UserSettingsContext } from '../providers/UserSettingsProvider';

export const useSongPathEncoder = () => {
  const [userSettings] = useContext(UserSettingsContext);

  return useCallback(
    (song: Song) => {
      if (userSettings.isWindows) {
        return windowsFilePathToShowtimeUri(song.path);
      }
      return encodeURI(`showtime://${song.path}`);
    },
    [userSettings.isWindows],
  );
};

function windowsFilePathToShowtimeUri(filePath: string) {
  // Replace backslashes with forward slashes
  const pathWithForwardSlashes = filePath.replace(/\\/g, '/');

  // Extract the drive letter (e.g., "C:") and keep it unencoded
  const driveLetterMatch = pathWithForwardSlashes.match(/^([a-zA-Z]:)/);
  const driveLetter = driveLetterMatch ? driveLetterMatch[0] : '';

  // Get the rest of the path
  const restOfPath = pathWithForwardSlashes.slice(driveLetter.length);

  // Encode the rest of the path
  const encodedRestOfPath = encodeURIComponent(restOfPath)
    .replace(/%5C/g, '/') // Replace encoded backslashes with forward slashes
    .replace(/%3A/g, ':') // Ensure colons are decoded back to original
    .replace(/%2F/g, '/'); // Ensure forward slashes are decoded back to original

  // Construct the full file URL
  return `showtime:///${driveLetter}${encodedRestOfPath}`;
}

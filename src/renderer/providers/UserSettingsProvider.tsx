import React, { createContext, useEffect, useMemo } from 'react';
import { useLocalStorage } from 'react-use';

export type UserSettings = {
  enableFineGrainAutoplay: boolean;
  useHTML5Audio: boolean;
  isWindows: boolean;
};

const defaultUserSettings = {
  enableFineGrainAutoplay: false,
  useHTML5Audio: false,
  isWindows: true,
};

export const UserSettingsContext = createContext([
  defaultUserSettings,
  (_settings: UserSettings) => {},
] as [UserSettings, (settings: UserSettings) => void]);

export function UserSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [userSettings, setUserSettings] = useLocalStorage(
    'userSettings',
    defaultUserSettings,
  );

  useEffect(() => {
    window.electron.ipcRenderer.once('getPlatform', (...args: unknown[]) => {
      const platform = args[0] as string;
      if (platform === 'win32') {
        setUserSettings({
          ...userSettings,
          isWindows: true,
        } as UserSettings);
      } else {
        setUserSettings({
          ...userSettings,
          isWindows: false,
        } as UserSettings);
      }
    });

    window.electron.ipcRenderer.sendMessage('getPlatform');
  }, []);

  const contextValue = useMemo(
    () =>
      [userSettings!, setUserSettings] as [
        UserSettings,
        (settings: UserSettings) => void,
      ],
    [userSettings, setUserSettings],
  );

  return (
    <UserSettingsContext.Provider value={contextValue}>
      {children}
    </UserSettingsContext.Provider>
  );
}

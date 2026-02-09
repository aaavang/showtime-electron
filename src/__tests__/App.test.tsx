import '@testing-library/jest-dom';
import React from 'react';
import { render } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import App from '../renderer/App';
import { JukeboxContext } from '../renderer/providers/JukeboxProvider';
import { UserSettingsContext } from '../renderer/providers/UserSettingsProvider';

// Mock window.electron (preload API)
beforeAll(() => {
  (window as any).electron = {
    ipcRenderer: {
      sendMessage: jest.fn(),
      on: jest.fn(() => jest.fn()),
      once: jest.fn(),
    },
  };
});

// Mock database to avoid auto-open error in jsdom
jest.mock('../renderer/database', () => ({
  database: {
    songs: { toArray: jest.fn().mockResolvedValue([]), hook: jest.fn(() => jest.fn()) },
    dances: { toArray: jest.fn().mockResolvedValue([]), hook: jest.fn(() => jest.fn()) },
    danceVariants: { toArray: jest.fn().mockResolvedValue([]), hook: jest.fn(() => jest.fn()) },
    playlists: { toArray: jest.fn().mockResolvedValue([]), hook: jest.fn(() => jest.fn()) },
    playlistDances: { toArray: jest.fn().mockResolvedValue([]), hook: jest.fn(() => jest.fn()) },
  },
}));

// Mock dexie-react-hooks to avoid live query issues
jest.mock('dexie-react-hooks', () => ({
  useLiveQuery: jest.fn(() => []),
}));

const mockJukeboxValue = {
  jukeboxState: { showJukebox: false },
  setJukeboxState: jest.fn(),
  Jukebox: () => null,
  initialFocusRef: { current: null },
};

const mockUserSettings = {
  enableFineGrainAutoplay: false,
  useHTML5Audio: false,
  isWindows: false,
};

describe('App', () => {
  it('should render', () => {
    expect(
      render(
        <ChakraProvider>
          <UserSettingsContext.Provider
            value={[mockUserSettings, jest.fn()]}
          >
            <JukeboxContext.Provider value={mockJukeboxValue}>
              <App />
            </JukeboxContext.Provider>
          </UserSettingsContext.Provider>
        </ChakraProvider>,
      ),
    ).toBeTruthy();
  });
});

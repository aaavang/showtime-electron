/* eslint-disable @typescript-eslint/no-explicit-any */

// Mocks must be declared before imports
import { dialog, net } from 'electron';
import fs from 'fs';
import { setupIPC } from '../../main/setupIPC';

const handlers: Record<string, (...args: any[]) => any> = {};

jest.mock('electron', () => ({
  ipcMain: {
    on: jest.fn((channel: string, handler: any) => {
      handlers[channel] = handler;
    }),
  },
  dialog: {
    showOpenDialogSync: jest.fn(),
    showSaveDialogSync: jest.fn(),
  },
  net: {
    fetch: jest.fn(),
  },
}));

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    existsSync: jest.fn(),
    promises: {
      readdir: jest.fn(),
      stat: jest.fn(),
    },
  };
});

jest.mock('node:os', () => ({
  platform: jest.fn(() => 'darwin'),
}));

function makeEvent() {
  return { reply: jest.fn() } as any;
}

beforeAll(() => {
  setupIPC();
});

describe('readAudioFile', () => {
  it('rejects non-string arg with error', async () => {
    const event = makeEvent();
    await handlers.readAudioFile(event, 123);
    expect(event.reply).toHaveBeenCalledWith('readAudioFile', {
      error: 'Invalid audio file path',
    });
  });

  it('rejects arg not starting with showtime://', async () => {
    const event = makeEvent();
    await handlers.readAudioFile(event, '/some/path.mp3');
    expect(event.reply).toHaveBeenCalledWith('readAudioFile', {
      error: 'Invalid audio file path',
    });
  });

  it('valid path: normalizes and calls net.fetch, replies with buffer', async () => {
    const fakeBuffer = new ArrayBuffer(8);
    (net.fetch as jest.Mock).mockResolvedValue({
      arrayBuffer: () => Promise.resolve(fakeBuffer),
    });
    const event = makeEvent();
    await handlers.readAudioFile(event, 'showtime:///home/user/song.mp3');
    expect(net.fetch).toHaveBeenCalled();
    const fetchArg = (net.fetch as jest.Mock).mock.calls.at(-1)[0] as string;
    expect(fetchArg.startsWith('file://')).toBe(true);
    expect(event.reply).toHaveBeenCalledWith('readAudioFile', {
      buffer: fakeBuffer,
    });
  });

  it('fetch failure: replies with error string', async () => {
    (net.fetch as jest.Mock).mockRejectedValue(new Error('network error'));
    const event = makeEvent();
    await handlers.readAudioFile(event, 'showtime:///home/user/song.mp3');
    expect(event.reply).toHaveBeenCalledWith('readAudioFile', {
      error: expect.stringContaining('network error'),
    });
  });
});

describe('getAudioFilesInDirectory', () => {
  it('dialog cancelled → replies with empty array', async () => {
    (dialog.showOpenDialogSync as jest.Mock).mockReturnValue(undefined);
    const event = makeEvent();
    await handlers.getAudioFilesInDirectory(event, undefined);
    expect(event.reply).toHaveBeenCalledWith('getAudioFilesInDirectory', []);
  });

  it('flat directory: finds .mp3 and .wav, ignores .txt', async () => {
    (dialog.showOpenDialogSync as jest.Mock).mockReturnValue(['/music']);
    (fs.promises.readdir as jest.Mock).mockResolvedValue([
      'song.mp3',
      'track.wav',
      'notes.txt',
    ]);
    (fs.promises.stat as jest.Mock).mockResolvedValue({
      isDirectory: () => false,
    });

    const event = makeEvent();
    await handlers.getAudioFilesInDirectory(event, undefined);
    const files = event.reply.mock.calls[0][1] as string[];
    expect(files).toContain('/music/song.mp3');
    expect(files).toContain('/music/track.wav');
    expect(files).not.toContain('/music/notes.txt');
  });

  it('recurses into subdirectories', async () => {
    (dialog.showOpenDialogSync as jest.Mock).mockReturnValue(['/music']);

    (fs.promises.readdir as jest.Mock)
      .mockResolvedValueOnce(['subdir', 'root.mp3'])
      .mockResolvedValueOnce(['nested.flac']);

    (fs.promises.stat as jest.Mock)
      .mockResolvedValueOnce({ isDirectory: () => true })
      .mockResolvedValueOnce({ isDirectory: () => false })
      .mockResolvedValueOnce({ isDirectory: () => false });

    const event = makeEvent();
    await handlers.getAudioFilesInDirectory(event, undefined);
    const files = event.reply.mock.calls[0][1] as string[];
    expect(files).toContain('/music/root.mp3');
    expect(files).toContain('/music/subdir/nested.flac');
  });

  it('stops at maxDepth (depth > 10 returns [])', async () => {
    // Build a chain of 12 nested dirs — depth 0..11
    (dialog.showOpenDialogSync as jest.Mock).mockReturnValue(['/music']);

    let callCount = 0;
    (fs.promises.readdir as jest.Mock).mockImplementation(() => {
      callCount++;
      // Every directory contains one subdir and one audio file
      return Promise.resolve(['sub', 'a.mp3']);
    });
    (fs.promises.stat as jest.Mock).mockImplementation((filePath: string) => {
      if (filePath.endsWith('.mp3'))
        return Promise.resolve({ isDirectory: () => false });
      return Promise.resolve({ isDirectory: () => true });
    });

    const event = makeEvent();
    await handlers.getAudioFilesInDirectory(event, undefined);
    const files = event.reply.mock.calls[0][1] as string[];
    // depth 0..10 => 11 dirs visited, so 11 mp3 files found, depth 11 returns []
    expect(files.length).toBe(11);
    // Recursion must stop — readdir called 12 times (depth 0–11), but depth 11 readdir
    // will still be called by the impl, yet the nested sub at depth 12 won't be entered.
    // Actual count: 12 readdir calls (0..11 inclusive), and depth > 10 check stops at depth 11
    // which means readdir is called for depth 0..10 = 11 times.
    expect(callCount).toBe(11);
  });

  it('extension filtering is case-sensitive', async () => {
    (dialog.showOpenDialogSync as jest.Mock).mockReturnValue(['/music']);
    (fs.promises.readdir as jest.Mock).mockResolvedValue([
      'song.MP3',
      'track.mp3',
    ]);
    (fs.promises.stat as jest.Mock).mockResolvedValue({
      isDirectory: () => false,
    });

    const event = makeEvent();
    await handlers.getAudioFilesInDirectory(event, undefined);
    const files = event.reply.mock.calls[0][1] as string[];
    expect(files).toContain('/music/track.mp3');
    expect(files).not.toContain('/music/song.MP3');
  });
});

describe('validateLibrary', () => {
  it('song with empty path → invalid', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    const event = makeEvent();
    await handlers.validateLibrary(event, {
      songs: [{ id: 1, title: 'A', path: '' }],
    });
    expect(event.reply).toHaveBeenCalledWith('validateLibrary', {
      invalidSongs: [{ id: 1, title: 'A', path: '' }],
    });
  });

  it('song with falsy path → invalid', async () => {
    const event = makeEvent();
    await handlers.validateLibrary(event, {
      songs: [{ id: 1, title: 'A', path: null as any }],
    });
    expect(event.reply).toHaveBeenCalledWith('validateLibrary', {
      invalidSongs: [{ id: 1, title: 'A', path: null }],
    });
  });

  it('song with nonexistent path → invalid', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    const event = makeEvent();
    await handlers.validateLibrary(event, {
      songs: [{ id: 1, title: 'A', path: '/missing.mp3' }],
    });
    expect(event.reply).toHaveBeenCalledWith('validateLibrary', {
      invalidSongs: [{ id: 1, title: 'A', path: '/missing.mp3' }],
    });
  });

  it('song with existing path → valid', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    const event = makeEvent();
    await handlers.validateLibrary(event, {
      songs: [{ id: 1, title: 'A', path: '/exists.mp3' }],
    });
    expect(event.reply).toHaveBeenCalledWith('validateLibrary', {
      invalidSongs: [],
    });
  });

  it('empty songs array → empty invalidSongs', async () => {
    const event = makeEvent();
    await handlers.validateLibrary(event, { songs: [] });
    expect(event.reply).toHaveBeenCalledWith('validateLibrary', {
      invalidSongs: [],
    });
  });
});

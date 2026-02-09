import { dialog, ipcMain, net } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'node:os';
import { Song } from '../renderer/database';

export const setupIPC = () => {
  ipcMain.on('getPlatform', async (event, _arg) => {
    event.reply('getPlatform', os.platform());
  });

  const audioFileExtensions: string[] = [
    'aac', // Advanced Audio Codec
    'aiff', // Audio Interchange File Format
    'alac', // Apple Lossless Audio Codec
    'amr', // Adaptive Multi-Rate
    'ape', // Monkey's Audio
    'dss', // Digital Speech Standard
    'flac', // Free Lossless Audio Codec
    'gsm', // Global System for Mobile Audio
    'm4a', // MPEG 4 Audio
    'm4b', // MPEG 4 Audio (audiobook)
    'm4p', // MPEG 4 Audio (protected)
    'mmf', // Yamaha Synthetic Music Mobile Application
    'mp3', // MPEG Audio Layer III
    'mpc', // Musepack
    'ogg', // Ogg Vorbis
    'oga', // Ogg Audio
    'opus', // Opus Audio Codec
    'ra', // Real Audio
    'rm', // Real Media
    'wav', // Waveform Audio
    'wma', // Windows Media Audio
    'wv', // WavPack
  ];

  ipcMain.on('selectAudioFile', async (event, _arg) => {
    try {
      const paths = dialog.showOpenDialogSync({
        message: 'Select an audio file',
        properties: ['openFile'],
        filters: [{ name: 'Audio Files', extensions: audioFileExtensions }],
      });
      event.reply('selectAudioFile', paths?.[0]);
    } catch (error) {
      event.reply('selectAudioFile', undefined);
    }
  });

  ipcMain.on('readAudioFile', async (event, arg) => {
    try {
      if (typeof arg !== 'string' || !arg.startsWith('showtime://')) {
        event.reply('readAudioFile', { error: 'Invalid audio file path' });
        return;
      }
      const filePath = path.normalize(arg.slice('showtime://'.length));
      const resp = await net.fetch(`file://${filePath}`);
      const buffer = await resp.arrayBuffer();
      event.reply('readAudioFile', { buffer });
    } catch (error) {
      event.reply('readAudioFile', { error: String(error) });
    }
  });

  ipcMain.on('getAudioFilesInDirectory', async (event, _arg) => {
    try {
      const paths = dialog.showOpenDialogSync({
        message: 'Select a directory',
        properties: ['openDirectory'],
      });

      if (!paths) {
        event.reply('getAudioFilesInDirectory', []);
        return;
      }

      const maxDepth = 10;

      const getAudioFiles = async (
        dir: string,
        depth: number,
      ): Promise<string[]> => {
        if (depth > maxDepth) return [];
        const files = await fs.promises.readdir(dir);
        const results: string[] = [];
        for (const file of files) {
          const filePath = `${dir}/${file}`;
          const stat = await fs.promises.stat(filePath);
          if (stat.isDirectory()) {
            results.push(...(await getAudioFiles(filePath, depth + 1)));
          } else {
            const extension = file.split('.').pop();
            if (audioFileExtensions.includes(extension!)) {
              results.push(filePath);
            }
          }
        }
        return results;
      };

      const audioFiles = await getAudioFiles(paths[0], 0);
      event.reply('getAudioFilesInDirectory', audioFiles);
    } catch (error) {
      event.reply('getAudioFilesInDirectory', []);
    }
  });

  ipcMain.on('exportPlaylist', async (event, arg) => {
    try {
      const { playlistTitle, xml } = arg;
      const savePath = dialog.showSaveDialogSync({
        message: 'Select file to export playlist to',
        defaultPath: `${playlistTitle ?? 'Playlist'}.xspf`,
        filters: [{ name: 'XSPF', extensions: ['xspf'] }],
      });

      if (savePath) {
        fs.writeFileSync(savePath, xml);
      }

      event.reply('exportPlaylist', { path: savePath });
    } catch (error) {
      event.reply('exportPlaylist', { error: String(error) });
    }
  });

  ipcMain.on('validateLibrary', async (event, arg) => {
    try {
      const { songs } = arg as { songs: Song[] };
      const invalidSongs: Song[] = [];
      for (const song of songs) {
        if (!song.path) {
          invalidSongs.push(song);
          continue;
        }
        if (!fs.existsSync(song.path)) {
          invalidSongs.push(song);
        }
      }
      event.reply('validateLibrary', { invalidSongs });
    } catch (error) {
      event.reply('validateLibrary', {
        invalidSongs: [],
        error: String(error),
      });
    }
  });
};

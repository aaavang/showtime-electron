import { app, dialog, ipcMain, net } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'node:os';
// eslint-disable-next-line import/no-extraneous-dependencies
import { Mp3Encoder } from '@breezystack/lamejs';
import { Song } from '../renderer/database';

export const setupIPC = () => {
  ipcMain.on('getAppPath', (event) => {
    event.returnValue = app.getAppPath();
  });

  ipcMain.on('getIsPackaged', (event) => {
    event.returnValue = app.isPackaged;
  });

  ipcMain.on('getPlatform', async (event) => {
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

  ipcMain.on('selectAudioFile', async (event) => {
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
        event.reply('readAudioFile', {
          src: arg,
          error: 'Invalid audio file path',
        });
        return;
      }
      const filePath = path.normalize(arg.slice('showtime://'.length));
      const resp = await net.fetch(`file://${filePath}`);
      const buffer = await resp.arrayBuffer();
      event.reply('readAudioFile', { src: arg, buffer });
    } catch (error) {
      event.reply('readAudioFile', { src: arg, error: String(error) });
    }
  });

  ipcMain.on('getAudioFilesInDirectory', async (event) => {
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

  ipcMain.on('exportDatabase', async (event, arg) => {
    try {
      const { json } = arg;
      const savePath = dialog.showSaveDialogSync({
        message: 'Export database dump',
        defaultPath: `showtime-backup.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });

      if (savePath) {
        fs.writeFileSync(savePath, json, 'utf-8');
        event.reply('exportDatabase', { path: savePath });
      } else {
        event.reply('exportDatabase', { cancelled: true });
      }
    } catch (error) {
      event.reply('exportDatabase', { error: String(error) });
    }
  });

  ipcMain.on('importDatabase', async (event) => {
    try {
      const paths = dialog.showOpenDialogSync({
        message: 'Select a database dump file',
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });

      if (!paths || paths.length === 0) {
        event.reply('importDatabase', { cancelled: true });
        return;
      }

      const content = fs.readFileSync(paths[0], 'utf-8');
      event.reply('importDatabase', { json: content });
    } catch (error) {
      event.reply('importDatabase', { error: String(error) });
    }
  });

  ipcMain.on('saveAudioFile', async (event, arg) => {
    try {
      const { defaultFileName, buffer, filePath } = arg;

      // Direct overwrite mode — skip save dialog
      if (filePath) {
        fs.writeFileSync(filePath, Buffer.from(buffer));
        event.reply('saveAudioFile', { path: filePath });
        return;
      }

      const savePath = dialog.showSaveDialogSync({
        message: 'Save audio file',
        defaultPath: defaultFileName ?? 'audio.wav',
        filters: [{ name: 'WAV Audio', extensions: ['wav'] }],
      });

      if (savePath) {
        fs.writeFileSync(savePath, Buffer.from(buffer));
        event.reply('saveAudioFile', { path: savePath });
      } else {
        event.reply('saveAudioFile', { cancelled: true });
      }
    } catch (error) {
      event.reply('saveAudioFile', { error: String(error) });
    }
  });

  ipcMain.on('encodeAndSaveAudio', async (event, arg) => {
    try {
      const {
        channelBuffers,
        sampleRate,
        numChannels,
        filePath,
        defaultFileName,
      } = arg as {
        channelBuffers: ArrayBuffer[];
        sampleRate: number;
        numChannels: number;
        filePath?: string;
        defaultFileName?: string;
      };

      // Reconstruct Float32Arrays from transferred ArrayBuffers
      const channels = channelBuffers.map(
        (buf: ArrayBuffer) => new Float32Array(buf),
      );

      // Convert float32 to int16 per channel
      const numSamples = channels[0].length;
      const int16Channels: Int16Array[] = channels.map((ch) => {
        const int16 = new Int16Array(numSamples);
        for (let i = 0; i < numSamples; i += 1) {
          const sample = Math.max(-1, Math.min(1, ch[i]));
          int16[i] = Math.round(sample * 0x7fff);
        }
        return int16;
      });

      // Encode MP3 at 192kbps
      const mp3Encoder = new Mp3Encoder(numChannels, sampleRate, 192);
      const mp3Parts: Uint8Array[] = [];

      // Encode in chunks of 1152 samples (LAME frame size)
      const chunkSize = 1152;
      for (let i = 0; i < numSamples; i += chunkSize) {
        const leftChunk = int16Channels[0].subarray(i, i + chunkSize);
        const rightChunk =
          numChannels > 1
            ? int16Channels[1].subarray(i, i + chunkSize)
            : leftChunk;
        const mp3buf = mp3Encoder.encodeBuffer(leftChunk, rightChunk);
        if (mp3buf.length > 0) {
          mp3Parts.push(mp3buf);
        }
      }

      const mp3End = mp3Encoder.flush();
      if (mp3End.length > 0) {
        mp3Parts.push(mp3End);
      }

      const totalLength = mp3Parts.reduce((acc, part) => acc + part.length, 0);
      const mp3Buffer = Buffer.alloc(totalLength);
      let writeOffset = 0;
      for (const part of mp3Parts) {
        mp3Buffer.set(part, writeOffset);
        writeOffset += part.length;
      }

      // Save
      let savePath = filePath ? filePath.replace(/\.\w+$/, '.mp3') : undefined;
      if (!savePath) {
        const baseName = (defaultFileName ?? 'audio').replace(/\.\w+$/, '');
        savePath =
          dialog.showSaveDialogSync({
            message: 'Save audio file',
            defaultPath: `${baseName}.mp3`,
            filters: [{ name: 'MP3 Audio', extensions: ['mp3'] }],
          }) || undefined;
      }

      if (savePath) {
        fs.writeFileSync(savePath, mp3Buffer);
        event.reply('encodeAndSaveAudio', { path: savePath });
      } else {
        event.reply('encodeAndSaveAudio', { cancelled: true });
      }
    } catch (error) {
      event.reply('encodeAndSaveAudio', { error: String(error) });
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

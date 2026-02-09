import { getFilename } from '../../renderer/utils/Filename';

describe('getFilename', () => {
  it('extracts filename from Unix path', () => {
    expect(getFilename('/home/user/song.mp3')).toBe('song');
  });

  it('extracts filename from Windows path', () => {
    expect(getFilename('C:\\Users\\song.mp3')).toBe('song');
  });

  it('handles multi-dot filenames', () => {
    expect(getFilename('archive.tar.gz')).toBe('archive.tar');
  });

  it('handles filename only (no directory)', () => {
    expect(getFilename('song.mp3')).toBe('song');
  });
});

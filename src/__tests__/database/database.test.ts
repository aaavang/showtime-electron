// jsdom environment lacks structuredClone; polyfill before fake-indexeddb uses it
if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = <T>(val: T): T =>
    JSON.parse(JSON.stringify(val));
}

import 'fake-indexeddb/auto';
import Dexie, { EntityTable } from 'dexie';

type Song = {
  id: number;
  title: string;
  path: string;
};

type Dance = {
  id: number;
  title: string;
};

type DanceVariant = {
  id: number;
  title: string;
  danceId: number;
  songId: number;
  defaultVariant: boolean;
};

function createTestDb() {
  const db = new Dexie('test-showtime-' + Math.random()) as Dexie & {
    songs: EntityTable<Song, 'id'>;
    dances: EntityTable<Dance, 'id'>;
    danceVariants: EntityTable<DanceVariant, 'id'>;
  };
  db.version(1).stores({
    songs: '++id, title, path',
    dances: '++id, title',
    danceVariants: '++id, title, danceId, songId',
  });
  return db;
}

describe('Song CRUD', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(async () => {
    db.close();
    await Dexie.delete(db.name);
  });

  it('add a song, retrieve by id', async () => {
    const id = await db.songs.add({
      title: 'My Song',
      path: '/music/song.mp3',
    } as Song);
    const song = await db.songs.get(id);
    expect(song).toBeDefined();
    expect(song!.title).toBe('My Song');
    expect(song!.path).toBe('/music/song.mp3');
  });

  it('update a song title', async () => {
    const id = await db.songs.add({
      title: 'Old Title',
      path: '/a.mp3',
    } as Song);
    await db.songs.update(id, { title: 'New Title' });
    const song = await db.songs.get(id);
    expect(song!.title).toBe('New Title');
  });

  it('delete a song by id', async () => {
    const id = await db.songs.add({
      title: 'Delete Me',
      path: '/b.mp3',
    } as Song);
    await db.songs.delete(id);
    const song = await db.songs.get(id);
    expect(song).toBeUndefined();
  });

  it('query songs by path with where().equals()', async () => {
    await db.songs.bulkAdd([
      { title: 'A', path: '/music/a.mp3' } as Song,
      { title: 'B', path: '/music/b.mp3' } as Song,
      { title: 'C', path: '/music/a.mp3' } as Song,
    ]);
    const results = await db.songs.where('path').equals('/music/a.mp3').toArray();
    expect(results.length).toBe(2);
    expect(results.every((s) => s.path === '/music/a.mp3')).toBe(true);
  });

  it('adding two songs with same path creates two entries', async () => {
    await db.songs.add({ title: 'A', path: '/dup.mp3' } as Song);
    await db.songs.add({ title: 'B', path: '/dup.mp3' } as Song);
    const all = await db.songs.toArray();
    expect(all.length).toBe(2);
  });
});

describe('Dance + DanceVariant', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(async () => {
    db.close();
    await Dexie.delete(db.name);
  });

  it('add a dance, retrieve by id', async () => {
    const id = await db.dances.add({ title: 'Waltz' } as Dance);
    const dance = await db.dances.get(id);
    expect(dance).toBeDefined();
    expect(dance!.title).toBe('Waltz');
  });

  it('add a variant linked to dance and song, query by danceId', async () => {
    const danceId = await db.dances.add({ title: 'Tango' } as Dance);
    const songId = await db.songs.add({
      title: 'Song',
      path: '/s.mp3',
    } as Song);
    await db.danceVariants.add({
      title: 'Variant A',
      danceId,
      songId,
      defaultVariant: true,
    } as DanceVariant);

    const variants = await db.danceVariants
      .where('danceId')
      .equals(danceId)
      .toArray();
    expect(variants.length).toBe(1);
    expect(variants[0].title).toBe('Variant A');
    expect(variants[0].songId).toBe(songId);
  });

  it('query default variant with where().equals().and()', async () => {
    const danceId = await db.dances.add({ title: 'Salsa' } as Dance);
    const songId = await db.songs.add({
      title: 'S',
      path: '/s.mp3',
    } as Song);
    await db.danceVariants.bulkAdd([
      {
        title: 'Default',
        danceId,
        songId,
        defaultVariant: true,
      } as DanceVariant,
      {
        title: 'Alt',
        danceId,
        songId,
        defaultVariant: false,
      } as DanceVariant,
    ]);

    const defaults = await db.danceVariants
      .where('danceId')
      .equals(danceId)
      .and((v) => v.defaultVariant)
      .toArray();
    expect(defaults.length).toBe(1);
    expect(defaults[0].title).toBe('Default');
  });

  it('cascade delete: delete variants by danceId then delete dance', async () => {
    const danceId = await db.dances.add({ title: 'Rumba' } as Dance);
    const songId = await db.songs.add({
      title: 'S',
      path: '/s.mp3',
    } as Song);
    await db.danceVariants.add({
      title: 'V',
      danceId,
      songId,
      defaultVariant: true,
    } as DanceVariant);

    await db.danceVariants.where('danceId').equals(danceId).delete();
    await db.dances.delete(danceId);

    const variants = await db.danceVariants
      .where('danceId')
      .equals(danceId)
      .toArray();
    expect(variants.length).toBe(0);
    const dance = await db.dances.get(danceId);
    expect(dance).toBeUndefined();
  });
});

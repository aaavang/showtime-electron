import { database, Song, Dance, DanceVariant, Playlist } from './database';

const SEED_SONGS: Omit<Song, 'id'>[] = [
  { title: 'Waltz of the Flowers', path: '/music/waltz-of-the-flowers.mp3' },
  { title: 'Blue Danube', path: '/music/blue-danube.mp3' },
  { title: 'Tango Por Una Cabeza', path: '/music/por-una-cabeza.mp3' },
  { title: 'La Cumparsita', path: '/music/la-cumparsita.mp3' },
  { title: 'Libertango', path: '/music/libertango.mp3' },
  { title: 'Sway', path: '/music/sway.mp3' },
  { title: 'Fly Me to the Moon', path: '/music/fly-me-to-the-moon.mp3' },
  { title: 'Mambo No. 5', path: '/music/mambo-no-5.mp3' },
  { title: 'Rumba Suite', path: '/music/rumba-suite.mp3' },
  { title: 'El Choclo', path: '/music/el-choclo.mp3' },
  { title: 'Espana Cani', path: '/music/espana-cani.mp3' },
  { title: 'Take the Lead', path: '/music/take-the-lead.mp3' },
];

const SEED_DANCES: Omit<Dance, 'id'>[] = [
  { title: 'Waltz' },
  { title: 'Tango' },
  { title: 'Foxtrot' },
  { title: 'Cha Cha' },
  { title: 'Rumba' },
  { title: 'Paso Doble' },
  { title: 'Samba' },
  { title: 'Jive' },
];

type VariantDef = {
  title: string;
  danceName: string;
  songTitle: string;
  defaultVariant: boolean;
};

const SEED_VARIANTS: VariantDef[] = [
  { title: 'Classic', danceName: 'Waltz', songTitle: 'Waltz of the Flowers', defaultVariant: true },
  { title: 'Blue Danube', danceName: 'Waltz', songTitle: 'Blue Danube', defaultVariant: false },
  { title: 'Classic', danceName: 'Tango', songTitle: 'Tango Por Una Cabeza', defaultVariant: true },
  { title: 'La Cumparsita', danceName: 'Tango', songTitle: 'La Cumparsita', defaultVariant: false },
  { title: 'Libertango', danceName: 'Tango', songTitle: 'Libertango', defaultVariant: false },
  { title: 'Classic', danceName: 'Foxtrot', songTitle: 'Fly Me to the Moon', defaultVariant: true },
  { title: 'Classic', danceName: 'Cha Cha', songTitle: 'Sway', defaultVariant: true },
  { title: 'Classic', danceName: 'Rumba', songTitle: 'Rumba Suite', defaultVariant: true },
  { title: 'Classic', danceName: 'Paso Doble', songTitle: 'Espana Cani', defaultVariant: true },
  { title: 'Classic', danceName: 'Samba', songTitle: 'Mambo No. 5', defaultVariant: true },
  { title: 'Classic', danceName: 'Jive', songTitle: 'Take the Lead', defaultVariant: true },
];

type PlaylistDef = {
  title: string;
  danceNames: string[];
};

const SEED_PLAYLISTS: PlaylistDef[] = [
  {
    title: 'Competition Night',
    danceNames: ['Waltz', 'Tango', 'Foxtrot', 'Cha Cha', 'Rumba'],
  },
  {
    title: 'Latin Showcase',
    danceNames: ['Cha Cha', 'Samba', 'Rumba', 'Paso Doble', 'Jive'],
  },
  {
    title: 'Quick Practice',
    danceNames: ['Waltz', 'Tango'],
  },
];

export async function seedDatabase(): Promise<void> {
  const songIds = await database.songs.bulkAdd(
    SEED_SONGS as Song[],
    { allKeys: true },
  );
  const songIdByTitle = new Map<string, number>();
  SEED_SONGS.forEach((s, i) => songIdByTitle.set(s.title, songIds[i]));

  const danceIds = await database.dances.bulkAdd(
    SEED_DANCES as Dance[],
    { allKeys: true },
  );
  const danceIdByTitle = new Map<string, number>();
  SEED_DANCES.forEach((d, i) => danceIdByTitle.set(d.title, danceIds[i]));

  const variants: Omit<DanceVariant, 'id'>[] = SEED_VARIANTS.map((v) => ({
    title: v.title,
    danceId: danceIdByTitle.get(v.danceName)!,
    songId: songIdByTitle.get(v.songTitle)!,
    defaultVariant: v.defaultVariant,
  }));
  const variantIds = await database.danceVariants.bulkAdd(
    variants as DanceVariant[],
    { allKeys: true },
  );

  // Build a map from dance name to its default variant id
  const defaultVariantByDance = new Map<string, number>();
  SEED_VARIANTS.forEach((v, i) => {
    if (v.defaultVariant) {
      defaultVariantByDance.set(v.danceName, variantIds[i]);
    }
  });

  for (const pl of SEED_PLAYLISTS) {
    const playlistId = await database.playlists.add({
      title: pl.title,
      tracksString: '',
    } as Playlist);

    const playlistDances = pl.danceNames.map((name, idx) => ({
      playlistId,
      danceVariantId: defaultVariantByDance.get(name)!,
      order: String(idx),
    }));
    await database.playlistDances.bulkAdd(playlistDances as any);
  }
}

export async function clearDatabase(): Promise<void> {
  await database.transaction(
    'rw',
    [database.playlistDances, database.playlists, database.danceVariants, database.dances, database.songs],
    async () => {
      await database.playlistDances.clear();
      await database.playlists.clear();
      await database.danceVariants.clear();
      await database.dances.clear();
      await database.songs.clear();
    },
  );
}

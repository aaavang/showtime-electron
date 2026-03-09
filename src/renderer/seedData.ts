import { database, Song, Dance, DanceVariant, Playlist } from './database';

function getTestTunesDir() {
  return `${window.electron.appPath}/test-tunes`;
}

function getSeedSongs(): Omit<Song, 'id'>[] {
  const dir = getTestTunesDir();
  return [
    { title: 'Track 1', path: `${dir}/track1.mp3` },
    { title: 'Track 2', path: `${dir}/track2.mp3` },
    { title: 'Track 3', path: `${dir}/track3.mp3` },
    {
      title: 'Hearty Irish Jig',
      path: `${dir}/alanajordan-hearty-irish-jig-251678.mp3`,
    },
    {
      title: 'Irish Dance Jig',
      path: `${dir}/alban_gogh-irish-dance-jig-199572.mp3`,
    },
    {
      title: 'Round of Fairies',
      path: `${dir}/alban_gogh-the-round-of-fairies-irish-harp-211192.mp3`,
    },
    {
      title: 'Naughty Princess',
      path: `${dir}/ebunny-naughty-princess-354024.mp3`,
    },
    { title: 'Irish Jig', path: `${dir}/musictown-irish-jig-99533.mp3` },
  ];
}

const SEED_DANCES: Omit<Dance, 'id'>[] = [
  { title: 'Waltz' },
  { title: 'Tango' },
  { title: 'Foxtrot' },
  { title: 'Cha Cha' },
  { title: 'Rumba' },
  { title: 'Jive' },
];

type VariantDef = {
  title: string;
  danceName: string;
  songTitle: string;
  defaultVariant: boolean;
};

const SEED_VARIANTS: VariantDef[] = [
  {
    title: 'Classic',
    danceName: 'Waltz',
    songTitle: 'Round of Fairies',
    defaultVariant: true,
  },
  {
    title: 'Alternate',
    danceName: 'Waltz',
    songTitle: 'Naughty Princess',
    defaultVariant: false,
  },
  {
    title: 'Classic',
    danceName: 'Tango',
    songTitle: 'Track 1',
    defaultVariant: true,
  },
  {
    title: 'Alternate',
    danceName: 'Tango',
    songTitle: 'Track 2',
    defaultVariant: false,
  },
  {
    title: 'Classic',
    danceName: 'Foxtrot',
    songTitle: 'Hearty Irish Jig',
    defaultVariant: true,
  },
  {
    title: 'Alternate',
    danceName: 'Foxtrot',
    songTitle: 'Track 3',
    defaultVariant: false,
  },
  {
    title: 'Classic',
    danceName: 'Cha Cha',
    songTitle: 'Irish Dance Jig',
    defaultVariant: true,
  },
  {
    title: 'Alternate',
    danceName: 'Cha Cha',
    songTitle: 'Irish Jig',
    defaultVariant: false,
  },
  {
    title: 'Classic',
    danceName: 'Rumba',
    songTitle: 'Naughty Princess',
    defaultVariant: true,
  },
  {
    title: 'Classic',
    danceName: 'Jive',
    songTitle: 'Irish Jig',
    defaultVariant: true,
  },
  {
    title: 'Alternate',
    danceName: 'Jive',
    songTitle: 'Hearty Irish Jig',
    defaultVariant: false,
  },
];

type PlaylistDef = {
  title: string;
  danceNames: string[];
};

const SEED_PLAYLISTS: PlaylistDef[] = [
  {
    title: 'Full Practice',
    danceNames: ['Waltz', 'Tango', 'Foxtrot', 'Cha Cha', 'Rumba', 'Jive'],
  },
  {
    title: 'Latin Showcase',
    danceNames: ['Cha Cha', 'Rumba', 'Jive'],
  },
  {
    title: 'Quick Practice',
    danceNames: ['Waltz', 'Tango'],
  },
  {
    title: 'Stress Test (36 tracks)',
    danceNames: Array.from({ length: 6 }, () => [
      'Waltz',
      'Tango',
      'Foxtrot',
      'Cha Cha',
      'Rumba',
      'Jive',
    ]).flat(),
  },
];

export async function seedDatabase(): Promise<void> {
  const seedSongs = getSeedSongs();
  const songIds = await database.songs.bulkAdd(seedSongs as Song[], {
    allKeys: true,
  });
  const songIdByTitle = new Map<string, number>();
  seedSongs.forEach((s, i) => songIdByTitle.set(s.title, songIds[i]));

  const danceIds = await database.dances.bulkAdd(SEED_DANCES as Dance[], {
    allKeys: true,
  });
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
    [
      database.playlistDances,
      database.playlists,
      database.danceVariants,
      database.dances,
      database.songs,
    ],
    async () => {
      await database.playlistDances.clear();
      await database.playlists.clear();
      await database.danceVariants.clear();
      await database.dances.clear();
      await database.songs.clear();
    },
  );
}

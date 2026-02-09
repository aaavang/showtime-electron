import Dexie, {EntityTable} from 'dexie';

export type Song = {
  id: number;
  title: string;
  path: string;
}

export type Dance = {
  id: number;
  title: string;
}

export type DanceVariant = {
  id: number;
  title: string;
  danceId: number;
  songId: number;
  defaultVariant: boolean;
}


export type Playlist = {
  id: number;
  title: string;
  tracksString: string;
}

export type PlaylistDance = {
  id: string;
  playlistId: number;
  danceVariantId: number;
  order: string;
}

export const database = new Dexie("showtime") as Dexie & {
  songs: EntityTable<Song, 'id'>,
  dances: EntityTable<Dance, 'id'>,
  danceVariants: EntityTable<DanceVariant, 'id'>,
  playlists: EntityTable<Playlist, 'id'>,
  playlistDances: EntityTable<PlaylistDance, 'id'>,
}

database.version(1).stores({
  songs: "++id, title, path",
  dances: "++id, title, defaultSongId",
  playlists: "++id, title",
  danceVariants: "++id, title, danceId, songId",
  playlistDances: "++id, playlistId, danceVariantId, order",
});

database.open().catch(function(error){
  console.error("ERROR: "+ error);
  alert("Failed to open database: " + error);
});

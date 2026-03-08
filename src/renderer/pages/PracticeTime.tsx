import { ChevronDownIcon, MenuButton } from '@chakra-ui/icons';
import {
  Box,
  Button,
  Checkbox,
  Flex,
  HStack,
  Menu,
  MenuItem,
  MenuList,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
  VStack,
} from '@chakra-ui/react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useLiveQuery } from 'dexie-react-hooks';
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';
import {
  MdCleaningServices,
  MdFileOpen,
  MdOutbound,
  MdSave,
} from 'react-icons/md';
import * as builder from 'xmlbuilder';
import { useClickAway, useKeyPressEvent } from 'react-use';
import { Page } from '../common/Page';
import { database, Playlist } from '../database';
import { useAudioPreloader } from '../hooks/useAudioPreloader';
import { useChangeVariantModal } from '../hooks/ChangeVariantModal';
import { useSavePlaylistModal } from '../hooks/SavePlaylistModal';
import {
  HydratedDanceVariant,
  useSelectDanceModal,
} from '../hooks/SelectDanceModal';
import { useSelectPlaylistModal } from '../hooks/SelectPlaylistModal';
import { JukeboxState } from '../hooks/useJukebox';
import { useSongPathEncoder } from '../hooks/useSongPathEncoder';
import { JukeboxContext } from '../providers/JukeboxProvider';
import { confirmAction } from '../utils/ConfirmAction';
import { UserSettingsContext } from '../providers/UserSettingsProvider';

export function PracticeTime() {
  const toast = useToast();
  const location = useLocation();
  const { jukeboxState, setJukeboxState } = useContext(JukeboxContext);
  const songPathEncoder = useSongPathEncoder();
  const [loaded, setLoaded] = useState(false);
  const [tracks, setTracks] = useState<HydratedDanceVariant[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [selectDanceModalDisclosure, SelectDanceModal] = useSelectDanceModal();
  const [savePlaylistModalDisclosure, SavePlaylistModal] =
    useSavePlaylistModal();
  const [selectPlaylistModalDisclosure, SelectPlaylistModal] =
    useSelectPlaylistModal();
  const [changeVariantDisclosure, changeVariantRef, ChangeVariantModal] =
    useChangeVariantModal();
  const [currentPlaylist, setCurrentPlaylist] = useState<Playlist | null>(null);
  const [showMode, setShowMode] = useState(false);
  const [userSettings] = useContext(UserSettingsContext);
  const [clickedRowNumber, setClickedRowNumber] = useState<number | null>(null);
  const tableRef = useRef(null);
  useClickAway(tableRef, () => {
    setClickedRowNumber(null);
  });

  const uniqueSongs = useMemo(() => {
    const seen = new Set<number>();
    return tracks
      .map((t) => t.song)
      .filter((s) => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });
  }, [tracks]);
  useAudioPreloader(uniqueSongs);

  const tracksRef = useRef(tracks);
  useEffect(() => {
    tracksRef.current = tracks;
    if (loaded) {
      localStorage.setItem('tracks', JSON.stringify(tracks));
    }
  }, [tracks, loaded]);

  useEffect(() => {
    if (loaded) {
      if (currentPlaylist) {
        localStorage.setItem('currentPlaylistId', String(currentPlaylist.id));
      } else {
        localStorage.removeItem('currentPlaylistId');
      }
    }
  }, [currentPlaylist, loaded]);

  useEffect(() => {
    const init = async () => {
      const routeState = location.state as { playlistId?: number } | null;
      if (routeState?.playlistId) {
        const playlist = await database.playlists.get(routeState.playlistId);
        if (playlist) {
          const hydrated = await hydratePlaylist(playlist);
          setTracks(hydrated);
          setCurrentPlaylist(playlist);
        }
        // Clear the state so refreshing doesn't re-load
        window.history.replaceState({}, '');
      } else {
        const storedTracks = localStorage.getItem('tracks');
        if (storedTracks) {
          setTracks(JSON.parse(storedTracks));
        }
        const storedPlaylistId = localStorage.getItem('currentPlaylistId');
        if (storedPlaylistId) {
          const playlist = await database.playlists.get(
            Number(storedPlaylistId),
          );
          if (playlist) {
            setCurrentPlaylist(playlist);
          }
        }
      }
      setLoaded(true);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const liveDances = useLiveQuery(() => database.dances.toArray());
  const liveSongs = useLiveQuery(() => database.songs.toArray());
  const liveVariants = useLiveQuery(() => database.danceVariants.toArray());

  useEffect(() => {
    if (!loaded || !liveDances || !liveSongs || !liveVariants) return;
    const { current } = tracksRef;
    if (current.length === 0) return;

    const danceMap = new Map(liveDances.map((d) => [d.id, d]));
    const songMap = new Map(liveSongs.map((s) => [s.id, s]));
    const variantMap = new Map(liveVariants.map((v) => [v.id, v]));

    let changed = false;
    const updated = current.map((track) => {
      const dance = danceMap.get(track.dance.id);
      const song = songMap.get(track.song.id);
      const variant = variantMap.get(track.danceVariant.id);
      if (!dance || !song || !variant) return track;

      if (
        dance.title !== track.dance.title ||
        song.title !== track.song.title ||
        song.path !== track.song.path ||
        variant.title !== track.danceVariant.title ||
        variant.songId !== track.danceVariant.songId
      ) {
        changed = true;
        return {
          ...track,
          dance,
          song: songMap.get(variant.songId) ?? song,
          danceVariant: variant,
        };
      }
      return track;
    });

    if (changed) {
      setTracks(updated);
    }
  }, [liveDances, liveSongs, liveVariants, loaded]);

  const currentTrackIndexRef = useRef(currentTrackIndex);
  useEffect(() => {
    currentTrackIndexRef.current = currentTrackIndex;
  }, [currentTrackIndex]);

  const columnHelper = createColumnHelper<HydratedDanceVariant>();

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'order',
        header: 'Order',
        cell: (info) => (
          <HStack>
            <Text>{info.row.index + 1}</Text>
            {/* {!showMode && <> */}
            {/*  <IconButton isDisabled={info.row.index === 0} aria-label={'move-up'} colorScheme={'gray'} variant={'ghost'} */}
            {/*              icon={<ArrowUpIcon />} size={'sm'} onClick={(e) => { */}
            {/*                e.stopPropagation(); */}
            {/*    moveSongUp(info.row.index); */}
            {/*  }} /> */}
            {/*  <IconButton isDisabled={info.row.index >= table.getRowModel().rows.length - 1} aria-label={'move-down'} */}
            {/*              colorScheme={'gray'} variant={'ghost'} icon={<ArrowDownIcon />} size={'sm'} */}
            {/*              onClick={(e) => { */}
            {/*                e.stopPropagation(); */}
            {/*                moveSongDown(info.row.index); */}
            {/*              }} /> */}
            {/* </>} */}
          </HStack>
        ),
      }),
      columnHelper.accessor('dance.title', {
        cell: (info) => info.getValue(),
        header: 'Dance',
      }),
      columnHelper.accessor('danceVariant.title', {
        cell: (info) => info.getValue(),
        header: 'Variant',
      }),
      columnHelper.accessor('song.title', {
        cell: (info) => info.getValue(),
        header: 'Song',
      }),
      columnHelper.accessor('autoplay', {
        cell: (info) => (
          <Checkbox
            isDisabled={showMode}
            isChecked={info.row.original.autoplay}
            onChange={() => {
              info.row.original.autoplay = !info.row.original.autoplay;
              setTracks(info.table.getRowModel().rows.map((r) => r.original));
            }}
          />
        ),
        header: 'Autoplay',
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: (info) => (
          <HStack gap="5px">
            <Button
              colorScheme="green"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                const newJukeboxState: JukeboxState = {
                  showMode,
                  closeOnEnd: true,
                  onEnd: onPlaylistEnd,
                  showJukebox: true,
                  dance: info.row.original.dance,
                  variant: info.row.original.danceVariant,
                  song: info.row.original.song,
                  currentTrackIndex: info.row.index,
                  playlist: info.table
                    .getRowModel()
                    .rows.map((r) => r.original),
                  autoplay: info.row.original.autoplay,
                };
                setJukeboxState(newJukeboxState);
                setCurrentTrackIndex(info.row.index);
                setClickedRowNumber(null);
              }}
            >
              Play
            </Button>
            {!showMode && (
              <Button
                variant="outline"
                colorScheme="yellow"
                onClick={(e) => {
                  e.stopPropagation();
                  changeVariantRef.current = {
                    track: info.row.original,
                    rowIndex: info.row.index,
                  };
                  changeVariantDisclosure.onOpen();
                }}
              >
                Change Variant
              </Button>
            )}
            {!showMode && (
              <Button
                colorScheme="red"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteRow(info.row.index);
                }}
              >
                Remove
              </Button>
            )}
          </HStack>
        ),
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showMode],
  );

  const table = useReactTable({
    columns,
    data: tracks,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange',
    columnResizeDirection: 'ltr',
    initialState: {
      columnVisibility: {
        autoplay: userSettings.enableFineGrainAutoplay,
      },
    },
  });

  const moveSongUp = (index: number) => {
    if (index <= 0) {
      return;
    }
    const newTracks = [...tracksRef.current];
    const track = newTracks.splice(index, 1)[0];
    newTracks.splice(index - 1, 0, track);
    setTracks(newTracks);
  };

  const moveSongDown = (index: number) => {
    if (index >= tracksRef.current.length - 1) {
      return;
    }
    const newTracks = [...tracksRef.current];
    const track = newTracks.splice(index, 1)[0];
    newTracks.splice(index + 1, 0, track);
    setTracks(newTracks);
  };

  const onPlaylistEnd = () => {
    toast({
      title: 'All done!',
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  const addTrack = (track: HydratedDanceVariant) => {
    setTracks([...tracks, track]);
  };

  const deleteRow = (index: number) => {
    setTracks([...tracksRef.current.filter((_, i) => i !== index)]);
  };

  const updateTrackVariant = (index: number, updated: HydratedDanceVariant) => {
    const newTracks = [...tracksRef.current];
    newTracks[index] = updated;
    setTracks(newTracks);
  };

  const savePlaylist = async (playlist: Playlist) => {
    playlist.tracksString = JSON.stringify(tracks);
    const id = await database.playlists.put(playlist);
    setCurrentPlaylist({ ...playlist, id });
    toast({
      title: `Playlist "${playlist.title}" saved`,
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  const quickSave = () => {
    if (!currentPlaylist) {
      savePlaylistModalDisclosure.onOpen();
      return;
    }
    confirmAction(`Overwrite "${currentPlaylist.title}"?`, () =>
      savePlaylist(currentPlaylist),
    )();
  };

  const hydratePlaylist = useCallback(
    async (playlist: Playlist): Promise<HydratedDanceVariant[]> => {
      if (playlist.tracksString) {
        return JSON.parse(playlist.tracksString);
      }
      // Playlist uses playlistDances table (e.g. seeded playlists)
      const playlistDances = await database.playlistDances
        .where('playlistId')
        .equals(playlist.id)
        .sortBy('order');

      const hydrated: HydratedDanceVariant[] = [];
      for (const pd of playlistDances) {
        const variant = await database.danceVariants.get(pd.danceVariantId);
        if (!variant) continue;
        const dance = await database.dances.get(variant.danceId);
        const song = await database.songs.get(variant.songId);
        if (!dance || !song) continue;
        hydrated.push({ dance, danceVariant: variant, song, autoplay: false });
      }
      return hydrated;
    },
    [],
  );

  const loadPlaylist = async (playlist: Playlist) => {
    const hydrated = await hydratePlaylist(playlist);
    setTracks(hydrated);
    setCurrentPlaylist(playlist);
  };

  const toggleShow = () => {
    const enteringShowMode = !showMode;
    setShowMode(enteringShowMode);
    setClickedRowNumber(null);

    if (enteringShowMode && tracks.length > 0) {
      const firstTrack = tracks[0];
      setCurrentTrackIndex(0);
      setJukeboxState({
        showMode: true,
        closeOnEnd: true,
        onEnd: onPlaylistEnd,
        showJukebox: true,
        dance: firstTrack.dance,
        variant: firstTrack.danceVariant,
        song: firstTrack.song,
        currentTrackIndex: 0,
        playlist: tracks,
        autoplay: firstTrack.autoplay,
      });
    } else if (!enteringShowMode) {
      setJukeboxState({ showJukebox: false });
    }
  };

  const exportPlaylist = () => {
    window.electron.ipcRenderer.once('exportPlaylist', (arg: any) => {
      if (arg.path) {
        toast({
          title: `Playlist exported to "${arg.path}"`,
          status: 'success',
          duration: 2000,
          isClosable: true,
        });
      }
    });

    const xmlObject = {
      playlist: {
        '@version': '1',
        '@xmlns': 'http://xspf.org/ns/0/',
        trackList: {
          track: tracks.map((track) => ({
            title: track.song.title,
            location: songPathEncoder(track.song).replace(
              'showtime://',
              'file://',
            ),
          })),
        },
      },
    };

    const xml = builder.create(xmlObject).end({ pretty: true });

    window.electron.ipcRenderer.sendMessage('exportPlaylist', {
      xml,
    });
  };

  const handleRowClick = (rowIndex: number) => {
    if (showMode) {
      return;
    }
    if (clickedRowNumber === rowIndex) {
      setClickedRowNumber(null);
    } else {
      setClickedRowNumber(rowIndex);
    }
  };

  useKeyPressEvent('ArrowUp', () => {
    if (
      clickedRowNumber !== null &&
      clickedRowNumber > 0 &&
      !jukeboxState.showJukebox &&
      !showMode
    ) {
      moveSongUp(clickedRowNumber);
      setClickedRowNumber(clickedRowNumber - 1);
    }
  });
  useKeyPressEvent('ArrowDown', () => {
    if (
      clickedRowNumber !== null &&
      clickedRowNumber < tracks.length - 1 &&
      !jukeboxState.showJukebox &&
      !showMode
    ) {
      moveSongDown(clickedRowNumber);
      setClickedRowNumber(clickedRowNumber + 1);
    }
  });
  useKeyPressEvent('Escape', () => {
    setClickedRowNumber(null);
  });

  return (
    <Page
      name={
        showMode
          ? 'Showtime!'
          : `Practice Time${currentPlaylist ? ` - ${currentPlaylist.title}` : ''}`
      }
    >
      <VStack height="100%" spacing={0} ref={tableRef}>
        <HStack w="100%" flexShrink={0} pb={2} justifyContent="space-between">
          <Flex flexGrow={1}>
            {!showMode && (
              <Button
                colorScheme="green"
                onClick={selectDanceModalDisclosure.onOpen}
              >
                + Add Dance
              </Button>
            )}
          </Flex>
          <>
            <Menu>
              <MenuButton as={Button} rightIcon={<ChevronDownIcon />}>
                Playlist Actions...
              </MenuButton>
              <MenuList>
                {!showMode && (
                  <MenuItem
                    icon={<MdFileOpen />}
                    onClick={selectPlaylistModalDisclosure.onOpen}
                  >
                    Load...
                  </MenuItem>
                )}
                {!showMode && (
                  <MenuItem icon={<MdSave />} onClick={quickSave}>
                    Save
                    {currentPlaylist ? ` "${currentPlaylist.title}"` : '...'}
                  </MenuItem>
                )}
                {!showMode && (
                  <MenuItem
                    icon={<MdSave />}
                    onClick={savePlaylistModalDisclosure.onOpen}
                  >
                    Save As...
                  </MenuItem>
                )}
                {!showMode && (
                  <MenuItem icon={<MdOutbound />} onClick={exportPlaylist}>
                    Export...
                  </MenuItem>
                )}
                {!showMode && (
                  <MenuItem
                    icon={<MdCleaningServices />}
                    onClick={() => {
                      setTracks([]);
                      setCurrentPlaylist(null);
                    }}
                  >
                    Clear
                  </MenuItem>
                )}
                {!showMode && (
                  <MenuItem
                    icon={<MdCleaningServices />}
                    onClick={() =>
                      setTracks(
                        tracks.map((t) => {
                          t.autoplay = false;
                          return t;
                        }),
                      )
                    }
                  >
                    Clear Autoplay
                  </MenuItem>
                )}
              </MenuList>
            </Menu>
            <Button
              colorScheme={showMode ? 'red' : 'purple'}
              onClick={toggleShow}
            >
              {showMode ? 'Stop Show' : 'Run Show!'}
            </Button>
          </>
        </HStack>
        <Box flex={1} overflowY="auto" width="100%">
          <Table variant="simple" width="100%">
            <Thead position="sticky" top={0} zIndex={1} bg="chakra-body-bg">
              {table.getHeaderGroups().map((headerGroup) => (
                <Tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    // see https://tanstack.com/table/v8/docs/api/core/column-def#meta to type this correctly
                    const { meta } = header.column.columnDef;
                    return (
                      <Th key={header.id} isNumeric={meta?.isNumeric}>
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                      </Th>
                    );
                  })}
                </Tr>
              ))}
            </Thead>
            <Tbody>
              {table.getRowModel().rows.map((row) => (
                <Tr
                  key={row.id}
                  onClick={() => handleRowClick(row.index)}
                  boxShadow={
                    clickedRowNumber === row.index
                      ? 'inset 0px 0px 0px 2px gray;'
                      : 'none'
                  }
                >
                  {row.getVisibleCells().map((cell) => {
                    // see https://tanstack.com/table/v8/docs/api/core/column-def#meta to type this correctly
                    const { meta } = cell.column.columnDef;
                    return (
                      <Td key={cell.id} isNumeric={meta?.isNumeric}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </Td>
                    );
                  })}
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      </VStack>
      <SelectDanceModal onSubmit={addTrack} />
      <SavePlaylistModal onSubmit={savePlaylist} />
      <SelectPlaylistModal onSubmit={loadPlaylist} />
      <ChangeVariantModal onSubmit={updateTrackVariant} />
    </Page>
  );
}

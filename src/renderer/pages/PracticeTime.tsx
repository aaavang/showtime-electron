import { ChevronDownIcon, MenuButton } from '@chakra-ui/icons';
import {
  Button,
  Checkbox,
  Flex,
  HStack,
  Menu,
  MenuGroup,
  MenuItem,
  MenuList,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
} from '@chakra-ui/react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
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
import { useSavePlaylistModal } from '../hooks/SavePlaylistModal';
import {
  HydratedDanceVariant,
  useSelectDanceModal,
} from '../hooks/SelectDanceModal';
import { useSelectPlaylistModal } from '../hooks/SelectPlaylistModal';
import { JukeboxState } from '../hooks/useJukebox';
import { useSongPathEncoder } from '../hooks/useSongPathEncoder';
import { JukeboxContext } from '../providers/JukeboxProvider';
import { UserSettingsContext } from '../providers/UserSettingsProvider';

export function PracticeTime() {
  const toast = useToast();
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
  const [showMode, setShowMode] = useState(false);
  const [userSettings] = useContext(UserSettingsContext);
  const [clickedRowNumber, setClickedRowNumber] = useState<number | null>(null);
  const tableRef = useRef(null);
  useClickAway(tableRef, () => {
    setClickedRowNumber(null);
  });

  const tracksRef = useRef(tracks);
  useEffect(() => {
    tracksRef.current = tracks;
    if (loaded) {
      localStorage.setItem('tracks', JSON.stringify(tracks));
    }
  }, [tracks]);

  useEffect(() => {
    const storedTracks = localStorage.getItem('tracks');
    if (storedTracks) {
      setTracks(JSON.parse(storedTracks));
    }
    setLoaded(true);
  }, []);

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

  const savePlaylist = async (playlist: Playlist) => {
    playlist.tracksString = JSON.stringify(tracks);
    await database.playlists.put(playlist);
  };

  const loadPlaylist = async (playlist: Playlist) => {
    const loadedTracks = JSON.parse(playlist.tracksString);
    setTracks(loadedTracks);
  };

  const toggleShow = () => {
    setShowMode(!showMode);
    setClickedRowNumber(null);
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
    <Page name={showMode ? 'Showtime!' : 'Practice Time'}>
      <TableContainer whiteSpace="wrap" width="100%" ref={tableRef}>
        <HStack justifyContent="space-between">
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
                  <MenuItem
                    icon={<MdSave />}
                    onClick={savePlaylistModalDisclosure.onOpen}
                  >
                    Save...
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
                    onClick={() => setTracks([])}
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
                <MenuGroup title="Showtime">
                  <MenuItem onClick={toggleShow}>
                    {showMode ? 'Stop show' : 'Run show!'}
                  </MenuItem>
                </MenuGroup>
              </MenuList>
            </Menu>
          </>
        </HStack>
        <Table variant="simple">
          <Thead>
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
      </TableContainer>
      <SelectDanceModal onSubmit={addTrack} />
      <SavePlaylistModal onSubmit={savePlaylist} />
      <SelectPlaylistModal onSubmit={loadPlaylist} />
    </Page>
  );
}

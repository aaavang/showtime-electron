import { TriangleDownIcon, TriangleUpIcon } from '@chakra-ui/icons';
import {
  Box,
  Button,
  Center,
  chakra,
  HStack,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  useToast,
  VStack,
} from '@chakra-ui/react';
import {
  ColumnFiltersState,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { useLiveQuery } from 'dexie-react-hooks';
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as builder from 'xmlbuilder';
import { DebouncedInput } from '../common/Filter';
import { Page } from '../common/Page';
import { TableControls } from '../common/TableControls';
import { database, Playlist } from '../database';
import { useSavePlaylistModal } from '../hooks/SavePlaylistModal';
import { HydratedDanceVariant } from '../hooks/SelectDanceModal';
import { useSongPathEncoder } from '../hooks/useSongPathEncoder';
import { confirmAction } from '../utils/ConfirmAction';

export function Playlists() {
  const navigate = useNavigate();
  const toast = useToast();
  const songPathEncoder = useSongPathEncoder();
  const playlists = useLiveQuery(() => database.playlists.toArray());
  const [savePlaylistModal, PlaylistModal] = useSavePlaylistModal();
  const [playlistToEdit, setPlaylistToEdit] = useState<Playlist | undefined>();

  const columnHelper = createColumnHelper<Playlist>();
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const columns = useMemo(
    () => [
      columnHelper.accessor('title', {
        cell: (info) => info.getValue(),
        header: 'Title',
        filterFn: 'includesString',
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: (info) => (
          <HStack gap="5px">
            <Button
              colorScheme="green"
              onClick={() => loadPlaylist(info.row.original)}
            >
              Load
            </Button>
            <Button
              colorScheme="blue"
              variant="outline"
              onClick={() => {
                setPlaylistToEdit(info.row.original);
                savePlaylistModal.onOpen();
              }}
            >
              Edit
            </Button>
            <Button
              colorScheme="red"
              variant="outline"
              onClick={confirmAction(
                `Delete playlist,  ${info.row.original.title}?`,
                () => deletePlaylist(info.row.original.id),
              )}
            >
              Delete
            </Button>
            <Button
              colorScheme="gray"
              variant="outline"
              onClick={() => exportPlaylist(info.row.original)}
            >
              Export...
            </Button>
          </HStack>
        ),
      }),
    ],
    [playlists],
  );

  const table = useReactTable({
    columns,
    data: playlists ?? [],
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(), // client side filtering
    getPaginationRowModel: getPaginationRowModel(),
    columnResizeMode: 'onChange',
    columnResizeDirection: 'ltr',
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
    },
  });

  const exportPlaylist = async (playlist: Playlist) => {
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

    const tracks: HydratedDanceVariant[] = JSON.parse(playlist.tracksString);

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
      playlistTitle: playlist.title,
      xml,
    });
  };

  const updatePlaylistTitle = async (playlist: Playlist) => {
    await database.playlists.update(playlist.id, {
      title: playlist.title,
    });
  };

  const deletePlaylist = async (playlistId: number) => {
    await database.playlists.delete(playlistId);
  };

  const loadPlaylist = async (playlist: Playlist) => {
    localStorage.setItem('tracks', playlist.tracksString);
    navigate('/');
    toast({
      title: 'Success',
      description: `Playlist loaded - ${playlist.title}`,
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  return (
    <Page name="Playlists">
      <VStack height="100%" spacing={0}>
        <HStack w="100%" flexShrink={0} pb={2}>
          <Box flex={1}>
            <Button
              colorScheme="green"
              onClick={() => {
                toast({
                  title: 'Taking you to Practice Time',
                  description: 'New playlists are created in Practice Time!',
                  status: 'info',
                  duration: 5000,
                  isClosable: true,
                });
                navigate('/');
              }}
            >
              + New Playlist
            </Button>
          </Box>
          <Center flex={1}>
            <DebouncedInput
              value={
                (table.getColumn('title')?.getFilterValue() ?? '') as string
              }
              onChange={(value) =>
                table.getColumn('title')?.setFilterValue(value)
              }
              placeholder="Search..."
              w="300px"
              textAlign="center"
            />
          </Center>
          <Box flex={1} />
        </HStack>
        <Box flex={1} overflowY="auto" width="100%">
          <Table variant="simple" width="100%">
            <Thead position="sticky" top={0} zIndex={1} bg="chakra-body-bg">
              {table.getHeaderGroups().map((headerGroup) => (
                <Tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const { meta } = header.column.columnDef;
                    return (
                      <Th
                        key={header.id}
                        onClick={header.column.getToggleSortingHandler()}
                        isNumeric={meta?.isNumeric}
                      >
                        <Box>
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}

                          <chakra.span pl="4">
                            {header.column.getIsSorted() ? (
                              header.column.getIsSorted() === 'desc' ? (
                                <TriangleDownIcon aria-label="sorted descending" />
                              ) : (
                                <TriangleUpIcon aria-label="sorted ascending" />
                              )
                            ) : null}
                          </chakra.span>
                        </Box>
                      </Th>
                    );
                  })}
                </Tr>
              ))}
            </Thead>
            <Tbody>
              {table.getRowModel().rows.map((row) => (
                <Tr key={row.id}>
                  {row.getVisibleCells().map((cell) => {
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
        <TableControls table={table} />
      </VStack>
      <PlaylistModal
        onSubmit={updatePlaylistTitle}
        initialValue={playlistToEdit}
      />
    </Page>
  );
}

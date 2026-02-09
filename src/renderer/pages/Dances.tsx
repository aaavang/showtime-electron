import {ChevronDownIcon, MenuButton, TriangleDownIcon, TriangleUpIcon} from '@chakra-ui/icons';
import {
  Box,
  Button,
  Center,
  chakra,
  HStack,
  Menu,
  MenuItem,
  MenuList,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  useToast,
  VStack
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
  useReactTable
} from '@tanstack/react-table';
import {useLiveQuery} from 'dexie-react-hooks';
import React, {useCallback, useContext, useMemo, useState} from 'react';
import {MdAppRegistration, MdDelete} from 'react-icons/md';
import {useNavigate} from 'react-router-dom';
import {DebouncedInput} from '../common/Filter';
import {Page} from '../common/Page';
import {TableControls} from '../common/TableControls';
import {Dance, DanceVariant, database} from '../database';
import {useDanceModal} from '../hooks/DanceModal';
import {JukeboxContext} from '../providers/JukeboxProvider';
import {confirmAction} from '../utils/ConfirmAction';

type NewDance = Dance & { songId: number }

export const Dances = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const dances = useLiveQuery(() => database.dances.toArray());

  const { setJukeboxState, Jukebox } = useContext(JukeboxContext);

  const [newDanceModal, DanceModal] = useDanceModal();

  const deleteDance = async (id: number) => {
    await database.danceVariants.where('danceId').equals(id).delete();

    await database.dances.delete(id);
    toast({
      title: 'Success',
      description: 'Dance deleted',
      status: 'success',
      duration: 2000,
      isClosable: true
    });
  };

  const columnHelper = createColumnHelper<Dance>();
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = useState<SortingState>([]);
  const columns = useMemo(() => [
    columnHelper.accessor('title', {
      cell: (info) => info.getValue(),
      header: 'Title',
      filterFn: 'includesString'
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: (info) => {
        return (
          <HStack gap="15px">
            <Button colorScheme={'green'} variant={'outline'}
                    onClick={async () => {
                      const variant = await database.danceVariants.where('danceId').equals(info.row.original.id).and(v => v.defaultVariant).first();
                      const song = await database.songs.get(variant!.songId);
                      setJukeboxState({
                        showJukebox: true,
                        dance: info.row.original,
                        variant,
                        song
                      });
                    }}>Play Default</Button>
            <Button colorScheme={'gray'} variant={'outline'}
                    onClick={() => navigate(`/dances/${info.row.original.id}`)}>Play Variant...</Button>
            <Menu>
              <MenuButton as={Button} rightIcon={<ChevronDownIcon />}>
                Actions
              </MenuButton>
              <MenuList>
                <MenuItem icon={<MdAppRegistration />}
                          onClick={() => navigate(`/dances/${info.row.original.id}`)}>Edit...</MenuItem>
                <MenuItem icon={<MdDelete />}
                          onClick={confirmAction(`Delete ${info.row.original.title}?`, () => deleteDance(info.row.original.id))}>Delete</MenuItem>
              </MenuList>
            </Menu>
          </HStack>
        );
      }
    })
  ], [dances]);

  const table = useReactTable(
    {
      columns,
      data: dances ?? [],
      getCoreRowModel: getCoreRowModel(),
      onSortingChange: setSorting,
      getFilteredRowModel: getFilteredRowModel(), //client side filtering
      getSortedRowModel: getSortedRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      columnResizeMode: 'onChange',
      columnResizeDirection: 'ltr',
      onColumnFiltersChange: setColumnFilters,
      state: {
        sorting,
        columnFilters
      }
    }
  );

  const saveDance = useCallback(async (newDance: Partial<NewDance>) => {
    if (!newDance.title) {
      toast({
        title: 'Error',
        description: 'Title is required',
        status: 'error',
        duration: 2000,
        isClosable: true
      });
      return;
    }

    const existingDance = dances?.find(d => d.title === newDance.title);
    if (!newDance.id && existingDance) {
      toast({
        title: 'Error',
        description: 'Dance already exists',
        status: 'error',
        duration: 2000,
        isClosable: true
      });
      return;
    }

    const newDanceId = await database.dances.put({
      title: newDance.title
    });

    const defaultVariant: Partial<DanceVariant> = {
      title: `Default Variant for ${newDance.title}`,
      danceId: newDanceId,
      songId: newDance.songId!,
      defaultVariant: true
    };

    await database.danceVariants.put(defaultVariant as DanceVariant);

    toast({
      title: 'Success',
      description: `${newDance.title} saved`,
      status: 'success',
      duration: 2000,
      isClosable: true
    });
  }, [dances, toast]);

  return (
    <Page name={'Dances'}>
      <VStack height={'100%'} spacing={0}>
        <HStack w={'100%'} flexShrink={0} pb={2}>
          <Box flex={1}>
            <Button colorScheme={'green'} onClick={newDanceModal.onOpen}>+ New Dance</Button>
          </Box>
          <Center flex={1}>
            <DebouncedInput
              value={(table.getColumn('title')?.getFilterValue() ?? '') as string}
              onChange={value => table.getColumn('title')?.setFilterValue(value)}
              placeholder="Search..."
              w={'300px'}
              textAlign={'center'}
            />
          </Center>
          <Box flex={1} />
        </HStack>
        <Box flex={1} overflowY={'auto'} width={'100%'}>
          <Table variant="simple" width={'100%'}>
            <Thead position={'sticky'} top={0} zIndex={1} bg={'chakra-body-bg'}>
              {table.getHeaderGroups().map((headerGroup) => (
                <Tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const meta: any = header.column.columnDef.meta;
                    return (
                      <Th
                        key={header.id}
                        onClick={header.column.getToggleSortingHandler()}
                        isNumeric={meta?.isNumeric}
                      >
                        <Box>
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
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
                    const meta: any = cell.column.columnDef.meta;
                    return (
                      <Td key={cell.id} isNumeric={meta?.isNumeric}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
      <DanceModal onSubmit={saveDance} />
    </Page>
  );
};

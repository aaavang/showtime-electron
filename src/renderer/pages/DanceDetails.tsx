import {ChevronDownIcon, MenuButton} from '@chakra-ui/icons';
import {
  Badge,
  Button,
  Heading,
  HStack,
  Menu,
  MenuItem,
  MenuList,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  useToast,
  VStack
} from '@chakra-ui/react';
import {useLiveQuery} from 'dexie-react-hooks';
import React, {useCallback, useContext, useState} from 'react';
import {MdAppRegistration, MdDelete, MdStar} from 'react-icons/md';
import {useParams} from 'react-router-dom';
import {Page} from '../common/Page';
import {DanceVariant, database} from '../database';
import {useDanceVariantModal} from '../hooks/DanceVariantModal';
import {JukeboxContext} from '../providers/JukeboxProvider';

export const DanceDetails = () => {
  const toast = useToast();
  const danceId = parseInt(useParams().danceId!);
  const dance = useLiveQuery(() => database.dances.get(danceId), [danceId]);
  const danceVariants = useLiveQuery(() => database.danceVariants.where('danceId').equals(danceId).toArray(), [danceId]);
  const variantSongs = useLiveQuery(() => database.songs.bulkGet(danceVariants?.map(v => v.songId) ?? []), [danceVariants]);

  const { setJukeboxState, Jukebox } = useContext(JukeboxContext);
  const [updatedVariant, setUpdatedVariant] = useState({} as Partial<DanceVariant>)

  const makeVariantDefault = async (variantId: number) => {
    await database.danceVariants.where('danceId').equals(danceId).and(v => v.defaultVariant).modify({ defaultVariant: false });
    await database.danceVariants.update(variantId, { defaultVariant: true });
  };

  const saveNewVariant = useCallback(async (newVariant: Partial<DanceVariant>) => {
    if (!newVariant.title) {
      toast({
        title: 'Error',
        description: 'Title is required',
        status: 'error',
        duration: 2000,
        isClosable: true
      });
      return;
    }
    if (!newVariant.songId) {
      toast({
        title: 'Error',
        description: 'Song is required',
        status: 'error',
        duration: 2000,
        isClosable: true
      });
      return;
    }

    // check if there is already a variant using this song
    const existingVariant = danceVariants?.find(v => v.songId === newVariant.songId && v.danceId === danceId);
    if (!newVariant.id && existingVariant) {
      toast({
        title: 'Error',
        description: `A variant with this song already exists - ${existingVariant.title}`,
        status: 'error',
        duration: 2000,
        isClosable: true
      });
      return;
    }

    const newVariantId = await database.danceVariants.put(
      {
        ...newVariant,
        danceId: danceId
      } as DanceVariant
    );

    if (newVariant.defaultVariant) {
      await makeVariantDefault(newVariantId);
    }
  }, []);

  const deleteVariant = async (id: number) => {
    const variant = danceVariants?.find(v => v.id === id)!;

    if (variant.defaultVariant) {
      toast({
        title: 'Error',
        description: 'Cannot delete default variant',
        status: 'error',
        duration: 2000,
        isClosable: true
      });
      return;
    }

    await database.danceVariants.delete(id);
  };

  const [newVariantModal, DanceVariantModal] = useDanceVariantModal();

  if (!dance) {
    return <></>;
  }

  return (
    <Page name={`${dance!.title} Details`}>
      <VStack justifyContent={'space-between'} height={'100%'}>
        <TableContainer width={'100%'}>
          <Heading as={'h2'}>Variants</Heading>
          <HStack gap={'5px'}>
            <Button colorScheme={'green'} onClick={() => {
              setUpdatedVariant({})
              newVariantModal.onOpen()
            }}>+ New Variant</Button>
          </HStack>
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Title</Th>
                <Th>Song</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {danceVariants?.map((variant) => (
                <Tr key={variant.id}>
                  <Td>{variant.defaultVariant && <Badge colorScheme={'green'}>DEFAULT</Badge>} {variant.title}</Td>
                  <Td>{variantSongs?.find(s => s?.id === variant.songId)?.title ?? 'UNKNOWN SONG'}</Td>
                  <Td>
                    <HStack gap={'15px'}>

                      <Button colorScheme={'green'} variant={'outline'} onClick={() => {
                        const song = variantSongs?.find(s => s?.id === variant.songId);
                        if (song) {
                          setJukeboxState({
                            closeOnEnd: true,
                            showJukebox: true,
                            song: song,
                            variant
                          });
                        }
                      }}>Play</Button>
                      <Menu>
                        <MenuButton as={Button} rightIcon={<ChevronDownIcon />}>
                          Actions
                        </MenuButton>
                        <MenuList>
                          {!variant.defaultVariant && <MenuItem icon={<MdStar />} onClick={() => makeVariantDefault(variant.id)}>Make
                            Default</MenuItem>}
                          <MenuItem icon={<MdAppRegistration />} onClick={() => {
                            setUpdatedVariant(variant);
                            newVariantModal.onOpen();
                          }}>Edit...</MenuItem>
                          <MenuItem icon={<MdDelete />} onClick={() => deleteVariant(variant.id)}>Delete</MenuItem>
                        </MenuList>
                      </Menu>
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      </VStack>
      <DanceVariantModal onSubmit={saveNewVariant} initialValue={updatedVariant} />
    </Page>
  );
};

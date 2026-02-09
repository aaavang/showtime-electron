import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  useDisclosure,
  useToast,
  VStack
} from '@chakra-ui/react';
import {useLiveQuery} from 'dexie-react-hooks';
import React, {useState} from 'react';
import AsyncSelect from 'react-select/async';
import {database} from '../database';
import {Option} from '../types/Option';

export type NewDance = {
  title: string;
  songId: number;
}

export type DanceModalProps = {
  onSubmit: (data: Partial<NewDance>) => void;
  disclosure: ReturnType<typeof useDisclosure>;
}

export type DanceModalHookProps = {
  onSubmit: (data: Partial<NewDance>) => void;
}

export const useDanceModal = (): [ReturnType<typeof useDisclosure>, (props: DanceModalHookProps) => React.ReactNode] => {
  const newDanceModal = useDisclosure()
  return [newDanceModal, ({ onSubmit }: DanceModalHookProps) => <DanceModal onSubmit={onSubmit} disclosure={newDanceModal} />]
}

const DanceModal: React.FC<DanceModalProps> = ({
                                                               onSubmit,
                                                               disclosure
                                                             }) => {
  const toast = useToast();
  const [newDance, setNewDance] = useState({} as Partial<NewDance>)
  const songs = useLiveQuery(() => database.songs.toArray())

  const currentOnClose = disclosure.onClose
  disclosure.onClose = () => {
    currentOnClose();
    setNewDance({})
  }

  const wrappedOnSubmit = async () => {
    const existingDance = await database.dances.where('title').equals(newDance.title!).first()
    if(existingDance) {
      toast({
        title: 'Dance already exists',
        description: 'A dance with that title already exists. Please choose another title.',
        status: 'error',
        duration: 2000,
        isClosable: true
      });
      return;
    }

    onSubmit(newDance);
    disclosure.onClose();
  }

  const loadSongOptions = async (inputValue: string): Promise<Option<number>[]> => {
    return songs?.filter(s => s.title.toLowerCase().includes(inputValue.toLowerCase())).map((song) => ({ value: song.id, label: song.title })) ?? [];
  }

  return (
    <Modal isOpen={disclosure.isOpen} onClose={disclosure.onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>New Dance</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack gap={'5px'}>
            <>
              <Text key={'title-label'}>Title</Text>
              <Input key={'title-input'} value={newDance.title ?? ''}
                     onChange={(e) => {
                       const newState = { ...newDance };
                       newState.title = e.target.value;
                       setNewDance(newState);
                     }} />
            </>
            <>
              <AsyncSelect styles={{
                container: (baseStyles, state) => ({
                  ...baseStyles,
                  width: '100%'
                }),
                option: (baseStyles, state) => ({
                  ...baseStyles,
                  color: 'black'
                })
              }} cacheOptions defaultOptions loadOptions={loadSongOptions} onChange={(option: any) => {
                setNewDance({
                  ...newDance,
                  songId: option.value
                })
              }} />
            </>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button colorScheme="blue" mr={3} onClick={() => wrappedOnSubmit()}>
            Save
          </Button>
          <Button variant="ghost" onClick={disclosure.onClose}>Cancel</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

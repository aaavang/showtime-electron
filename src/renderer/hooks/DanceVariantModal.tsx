import {
  Button,
  Checkbox,
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
  VStack
} from '@chakra-ui/react';
import {useLiveQuery} from 'dexie-react-hooks';
import React, {useState} from 'react';
import AsyncSelect from 'react-select/async';
import {DanceVariant, database} from '../database';
import {Option} from '../types/Option';

export type DanceVariantModalProps = {
  onSubmit: (data: Partial<DanceVariant>) => void;
  disclosure: ReturnType<typeof useDisclosure>;
  initialValue?: Partial<DanceVariant>;
}

export type DanceVariantModalHookProps = {
  onSubmit: (data: Partial<DanceVariant>) => void;
  initialValue?: Partial<DanceVariant>;
}

export const useDanceVariantModal = (): [ReturnType<typeof useDisclosure>, (props: DanceVariantModalHookProps) => React.ReactNode] => {
  const newVariantModal = useDisclosure()
  return [newVariantModal, ({ onSubmit, initialValue }: DanceVariantModalHookProps) => <DanceVariantModal initialValue={initialValue} onSubmit={onSubmit} disclosure={newVariantModal} />]
}

const DanceVariantModal: React.FC<DanceVariantModalProps> = ({
  onSubmit,
  disclosure,
  initialValue
}) => {
  const [newVariant, setNewVariant] = useState(initialValue ?? {} as Partial<DanceVariant>)
  const defaultSong = useLiveQuery(() => database.songs.get(newVariant.songId ?? -1), [newVariant.songId])
  const songs = useLiveQuery(() => database.songs.toArray())

  const currentOnClose = disclosure.onClose
  disclosure.onClose = () => {
    currentOnClose();
    setNewVariant({})
  }

  const wrappedOnSubmit = () => {
    if(newVariant.defaultVariant === undefined) {
      newVariant.defaultVariant = false
    }
    onSubmit(newVariant);
    setNewVariant({})
    disclosure.onClose();
  }

  const loadSongOptions = async (inputValue: string): Promise<Option<number>[]> => {
    return songs?.filter(s => s.title.toLowerCase().includes(inputValue.toLowerCase())).map((song) => ({ value: song.id, label: song.title })) ?? [];
  }

  return (
    <Modal isOpen={disclosure.isOpen} onClose={disclosure.onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>New Variant</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack gap={'5px'}>
            <>
              <Text key={'title-label'}>Title</Text>
              <Input key={'title-input'} value={newVariant.title ?? ''}
                     onChange={(e) => {
                       const newState = { ...newVariant };
                       newState.title = e.target.value;
                       setNewVariant(newState);
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
              }} cacheOptions defaultOptions defaultValue={newVariant.songId} defaultInputValue={defaultSong?.title} loadOptions={loadSongOptions} onChange={(option: any) => {
                setNewVariant({
                  ...newVariant,
                  songId: option.value
                })
              }} />
              <>
                <Text key={'default-label'}>Make default</Text>
                <Checkbox isChecked={newVariant.defaultVariant} onChange={(e) => {
                  setNewVariant({
                    ...newVariant,
                    defaultVariant: e.target.checked
                  })
                }} />
              </>
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

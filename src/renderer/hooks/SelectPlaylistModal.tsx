import {
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  useDisclosure,
  VStack,
} from '@chakra-ui/react';
import React, { useState } from 'react';
import AsyncSelect from 'react-select/async';
import { useLiveQuery } from 'dexie-react-hooks';
import { database, Playlist } from '../database';
import { Option } from '../types/Option';

export type SelectPlaylistModalProps = {
  onSubmit: (data: Playlist) => void;
  disclosure: ReturnType<typeof useDisclosure>;
};

export type SelectPlaylistModalHookProps = {
  onSubmit: (data: Playlist) => void;
};

export const useSelectPlaylistModal = (): [
  ReturnType<typeof useDisclosure>,
  (props: SelectPlaylistModalHookProps) => React.ReactNode,
] => {
  const savePlaylistModal = useDisclosure();
  return [
    savePlaylistModal,
    ({ onSubmit }: SelectPlaylistModalHookProps) => (
      <SelectPlaylistModal onSubmit={onSubmit} disclosure={savePlaylistModal} />
    ),
  ];
};

function SelectPlaylistModal({
  onSubmit,
  disclosure,
}: SelectPlaylistModalProps) {
  const [selectedPlaylist, setSelectedPlaylist] = useState(
    {} as Partial<Playlist>,
  );
  const playlists = useLiveQuery(() => database.playlists.toArray());

  const wrappedOnSubmit = async () => {
    onSubmit(selectedPlaylist as Playlist);
    disclosure.onClose();
  };

  const loadPlaylistOptions = async (
    inputValue: string,
  ): Promise<Option<Playlist>[]> => {
    return (
      playlists
        ?.filter((p) =>
          p.title.toLowerCase().includes(inputValue.toLowerCase()),
        )
        .map((playlist) => ({ value: playlist, label: playlist.title })) ?? []
    );
  };

  return (
    <Modal isOpen={disclosure.isOpen} onClose={disclosure.onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Select Playlist</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack gap="5px">
            <>
              <Text key="title-label">Title</Text>
              <AsyncSelect
                styles={{
                  container: (baseStyles) => ({
                    ...baseStyles,
                    width: '100%',
                  }),
                  option: (baseStyles) => ({
                    ...baseStyles,
                    color: 'black',
                  }),
                }}
                cacheOptions
                defaultOptions
                loadOptions={loadPlaylistOptions}
                onChange={(option: any) => {
                  setSelectedPlaylist(option.value);
                }}
              />
            </>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button colorScheme="blue" mr={3} onClick={() => wrappedOnSubmit()}>
            Save
          </Button>
          <Button variant="ghost" onClick={disclosure.onClose}>
            Cancel
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

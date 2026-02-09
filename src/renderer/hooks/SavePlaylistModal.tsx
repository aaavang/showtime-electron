import {
  Button,
  Heading,
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
  VStack,
} from '@chakra-ui/react';
import React, { useCallback, useState } from 'react';
import { database, Playlist } from '../database';
import { confirmAction } from '../utils/ConfirmAction';

export type SavePlaylistModalProps = {
  onSubmit: (data: Playlist) => void;
  disclosure: ReturnType<typeof useDisclosure>;
  initialValue?: Partial<Playlist>;
};

export type SavePlaylistModalHookProps = {
  onSubmit: (data: Playlist) => void;
  initialValue?: Partial<Playlist>;
};

export const useSavePlaylistModal = (): [
  ReturnType<typeof useDisclosure>,
  (props: SavePlaylistModalHookProps) => React.ReactNode,
] => {
  const savePlaylistModal = useDisclosure();
  return [
    savePlaylistModal,
    ({ onSubmit, initialValue }: SavePlaylistModalHookProps) => (
      <SavePlaylistModal
        onSubmit={onSubmit}
        initialValue={initialValue}
        disclosure={savePlaylistModal}
      />
    ),
  ];
};

function SavePlaylistModal({
  onSubmit,
  disclosure,
  initialValue,
}: SavePlaylistModalProps) {
  const [newPlaylist, setNewPlaylist] = useState(
    initialValue ?? ({} as Partial<Playlist>),
  );

  const wrappedOnSubmit = useCallback(async () => {
    const existingPlaylist = await database.playlists
      .where('title')
      .equalsIgnoreCase(newPlaylist.title!)
      .first();
    if (existingPlaylist) {
      console.log('existingPlaylist', existingPlaylist);
      confirmAction(
        `Playlist with title "${newPlaylist.title}", already exists. Overwrite?`,
        () => {
          onSubmit({ ...newPlaylist, id: existingPlaylist.id } as Playlist);
          disclosure.onClose();
        },
      )();
      return;
    }

    onSubmit(newPlaylist as Playlist);
    disclosure.onClose();
  }, [newPlaylist, onSubmit]);

  return (
    <Modal isOpen={disclosure.isOpen} onClose={disclosure.onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Save Playlist</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack gap="15px">
            <>
              <Heading as="h2" size="md" key="title-label">
                Title
              </Heading>
              <Input
                key="title-input"
                value={newPlaylist.title ?? ''}
                onChange={(e) => {
                  const newState = { ...newPlaylist };
                  newState.title = e.target.value;
                  setNewPlaylist(newState);
                }}
              />
            </>
            <>
              <Heading as="h2" size="md" key="track-label">
                Tracks
              </Heading>
              <Text key="track-msg">
                Edit a playlist&apos;s tracks by loading it and resaving it with
                the same name.
              </Text>
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

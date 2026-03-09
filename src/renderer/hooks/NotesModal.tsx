import {
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Textarea,
  useDisclosure,
} from '@chakra-ui/react';
import React, { useEffect, useState } from 'react';
import { HydratedDanceVariant } from './SelectDanceModal';

export type NotesModalProps = {
  onSubmit: (rowIndex: number, notes: string) => void;
  disclosure: ReturnType<typeof useDisclosure>;
  track: HydratedDanceVariant | null;
  rowIndex: number;
};

export type NotesModalHookProps = {
  onSubmit: (rowIndex: number, notes: string) => void;
};

export const useNotesModal = (): [
  ReturnType<typeof useDisclosure>,
  React.MutableRefObject<{
    track: HydratedDanceVariant | null;
    rowIndex: number;
  }>,
  (props: NotesModalHookProps) => React.ReactNode,
] => {
  const disclosure = useDisclosure();
  const ref = React.useRef<{
    track: HydratedDanceVariant | null;
    rowIndex: number;
  }>({
    track: null,
    rowIndex: -1,
  });
  return [
    disclosure,
    ref,
    ({ onSubmit }: NotesModalHookProps) => (
      <NotesModal
        onSubmit={onSubmit}
        disclosure={disclosure}
        track={ref.current.track}
        rowIndex={ref.current.rowIndex}
      />
    ),
  ];
};

const NotesModal: React.FC<NotesModalProps> = ({
  onSubmit,
  disclosure,
  track,
  rowIndex,
}) => {
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (disclosure.isOpen && track) {
      setNotes(track.notes ?? '');
    }
  }, [disclosure.isOpen, track]);

  const handleSubmit = () => {
    onSubmit(rowIndex, notes);
    disclosure.onClose();
  };

  if (!track) return null;

  return (
    <Modal isOpen={disclosure.isOpen} onClose={disclosure.onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          Notes - {track.dance.title} ({track.danceVariant.title})
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Enter notes for this track..."
            rows={6}
          />
        </ModalBody>
        <ModalFooter>
          <Button colorScheme="blue" mr={3} onClick={handleSubmit}>
            Save
          </Button>
          <Button variant="ghost" onClick={disclosure.onClose}>
            Cancel
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

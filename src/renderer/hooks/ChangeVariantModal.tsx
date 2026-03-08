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
import React, { useEffect, useState } from 'react';
import AsyncSelect from 'react-select/async';
import { DanceVariant, database } from '../database';
import { HydratedDanceVariant } from './SelectDanceModal';
import { Option } from '../types/Option';

export type ChangeVariantModalProps = {
  onSubmit: (rowIndex: number, updated: HydratedDanceVariant) => void;
  disclosure: ReturnType<typeof useDisclosure>;
  track: HydratedDanceVariant | null;
  rowIndex: number;
};

export type ChangeVariantHookProps = {
  onSubmit: (rowIndex: number, updated: HydratedDanceVariant) => void;
};

export const useChangeVariantModal = (): [
  ReturnType<typeof useDisclosure>,
  React.MutableRefObject<{ track: HydratedDanceVariant | null; rowIndex: number }>,
  (props: ChangeVariantHookProps) => React.ReactNode,
] => {
  const disclosure = useDisclosure();
  const ref = React.useRef<{ track: HydratedDanceVariant | null; rowIndex: number }>({
    track: null,
    rowIndex: -1,
  });
  return [
    disclosure,
    ref,
    ({ onSubmit }: ChangeVariantHookProps) => (
      <ChangeVariantModal
        onSubmit={onSubmit}
        disclosure={disclosure}
        track={ref.current.track}
        rowIndex={ref.current.rowIndex}
      />
    ),
  ];
};

const ChangeVariantModal: React.FC<ChangeVariantModalProps> = ({
  onSubmit,
  disclosure,
  track,
  rowIndex,
}) => {
  const [selectedVariant, setSelectedVariant] = useState<DanceVariant | null>(null);

  useEffect(() => {
    if (disclosure.isOpen && track) {
      setSelectedVariant(track.danceVariant);
    }
  }, [disclosure.isOpen, track]);

  const handleSubmit = async () => {
    if (!selectedVariant || !track) return;
    const song = await database.songs.get(selectedVariant.songId);
    if (!song) return;
    onSubmit(rowIndex, {
      ...track,
      danceVariant: selectedVariant,
      song,
    });
    disclosure.onClose();
  };

  const loadVariantOptions = async (
    inputValue: string,
  ): Promise<Option<DanceVariant>[]> => {
    if (!track) return [];
    const variants = await database.danceVariants
      .where('danceId')
      .equals(track.dance.id)
      .toArray();

    if (inputValue.length === 0) {
      return variants.map((v) => ({ value: v, label: v.title }));
    }
    return variants
      .filter((v) => v.title.toLowerCase().includes(inputValue.toLowerCase()))
      .map((v) => ({ value: v, label: v.title }));
  };

  if (!track) return null;

  return (
    <Modal isOpen={disclosure.isOpen} onClose={disclosure.onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Change Variant for {track.dance.title}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack gap="5px" width="100%">
            <Text>Select Variant</Text>
            <AsyncSelect
              key={track.dance.id}
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
              defaultInputValue={track.danceVariant.title}
              loadOptions={loadVariantOptions}
              onChange={(option: any) => {
                setSelectedVariant(option.value);
              }}
            />
          </VStack>
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

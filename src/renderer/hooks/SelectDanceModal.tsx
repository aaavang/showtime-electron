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
import { useLiveQuery } from 'dexie-react-hooks';
import React, { useState } from 'react';
import AsyncSelect from 'react-select/async';
import { Dance, DanceVariant, database, Song } from '../database';
import { Option } from '../types/Option';

export type SelectDanceModalProps = {
  onSubmit: (data: HydratedDanceVariant) => void;
  disclosure: ReturnType<typeof useDisclosure>;
};

export type SelectModalHookProps = {
  onSubmit: (data: HydratedDanceVariant) => void;
};

export type HydratedDanceVariant = {
  song: Song;
  dance: Dance;
  danceVariant: DanceVariant;
  autoplay: boolean;
};

export const useSelectDanceModal = (): [
  ReturnType<typeof useDisclosure>,
  (props: SelectModalHookProps) => React.ReactNode,
] => {
  const selectDanceModal = useDisclosure();
  return [
    selectDanceModal,
    ({ onSubmit }: SelectModalHookProps) => (
      <SelectDanceModal onSubmit={onSubmit} disclosure={selectDanceModal} />
    ),
  ];
};

const SelectDanceModal: React.FC<SelectDanceModalProps> = ({
  onSubmit,
  disclosure,
}) => {
  const [selectedHydratedDanceVariant, setSelectedHydratedDanceVariant] =
    useState({} as Partial<HydratedDanceVariant>);
  const dances = useLiveQuery(() => database.dances.toArray());

  const currentOnClose = disclosure.onClose;
  disclosure.onClose = () => {
    currentOnClose();
    setSelectedHydratedDanceVariant({});
  };

  const wrappedOnSubmit = () => {
    onSubmit(selectedHydratedDanceVariant as HydratedDanceVariant);
    disclosure.onClose();
  };

  const loadDanceOptions = async (
    inputValue: string,
  ): Promise<Option<Dance>[]> => {
    if (inputValue.length === 0 || inputValue === '') {
      return dances!.map((dance) => ({ value: dance, label: dance.title }));
    }

    return dances!
      .filter((d) => d.title.toLowerCase().includes(inputValue.toLowerCase()))
      .map((dance) => ({ value: dance, label: dance.title }));
  };

  const loadDanceVariantOptions = async (
    inputValue: string,
  ): Promise<Option<DanceVariant>[]> => {
    const danceVariants = await database.danceVariants
      .where('danceId')
      .equals(selectedHydratedDanceVariant.dance!.id)
      .toArray();

    if (inputValue.length === 0) {
      return danceVariants.map((danceVariant) => ({
        value: danceVariant,
        label: danceVariant.title,
      }));
    }
    return danceVariants
      .filter((danceVariant) =>
        danceVariant.title.toLowerCase().includes(inputValue.toLowerCase()),
      )
      .map((danceVariant) => ({
        value: danceVariant,
        label: danceVariant.title,
      }));
  };

  if (!dances) {
    return <></>;
  }

  return (
    <Modal isOpen={disclosure.isOpen} onClose={disclosure.onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Select Dance</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack gap="5px" width="100%">
            <>
              <Text key="dance-label">Select Dance</Text>
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
                loadOptions={loadDanceOptions}
                onChange={async (option: any) => {
                  const defaultDanceVariant = await database.danceVariants
                    .where('danceId')
                    .equals(option.value.id)
                    .and((v) => v.defaultVariant)
                    .first();

                  const song = await database.songs.get(
                    defaultDanceVariant!.songId,
                  );

                  setSelectedHydratedDanceVariant({
                    ...selectedHydratedDanceVariant,
                    dance: option.value,
                    danceVariant: defaultDanceVariant,
                    song,
                  });
                }}
              />
            </>
            {selectedHydratedDanceVariant.dance && (
              <>
                <Text key="song-label">Select Variant</Text>
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
                  defaultValue={selectedHydratedDanceVariant.danceVariant}
                  defaultInputValue={
                    selectedHydratedDanceVariant.danceVariant?.title
                  }
                  loadOptions={loadDanceVariantOptions}
                  onChange={async (option: any) => {
                    const song = await database.songs.get(option.value.songId);

                    setSelectedHydratedDanceVariant({
                      ...selectedHydratedDanceVariant,
                      danceVariant: option.value,
                      song,
                    });
                  }}
                />
              </>
            )}
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
};

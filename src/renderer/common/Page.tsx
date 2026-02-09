import { DrawerOverlay } from '@chakra-ui/icons';
import {
  Box,
  Drawer,
  DrawerBody,
  DrawerContent,
  Heading,
  useDisclosure,
  VStack,
} from '@chakra-ui/react';
import React, { useContext } from 'react';
import { JukeboxContext } from '../providers/JukeboxProvider';
import { GlobalNav } from './GlobalNav';

export type PageProps = {
  children: React.ReactNode;
  name: string;
};

export function Page({ children, name }: PageProps) {
  const jukebox = useContext(JukeboxContext);
  const jukeboxDisclosure = useDisclosure();

  return (
    <VStack w="100%" h="100vh" pt="25px" overflow="hidden">
      <GlobalNav />
      <Heading as="h1">{name}</Heading>
      <Box
        flexGrow={1}
        width="100%"
        padding="25px"
        overflow="hidden"
        id="page-container"
      >
        {children}
      </Box>
      <Drawer
        placement="bottom"
        onClose={jukeboxDisclosure.onClose}
        isOpen={jukebox.jukeboxState.showJukebox}
        initialFocusRef={jukebox.initialFocusRef}
      >
        <DrawerOverlay />
        <DrawerContent>
          <DrawerBody>
            <jukebox.Jukebox />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </VStack>
  );
}

import {
  Button,
  HStack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { useLiveQuery } from 'dexie-react-hooks';
import React from 'react';
import { Page } from '../common/Page';
import { database } from '../database';

export function PlaylistDetails() {
  const playlists = useLiveQuery(() => database.playlists.toArray());

  return (
    <Page name="Playlists">
      <TableContainer>
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th>Title</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {playlists?.map((dance) => (
              <Tr key={dance.id}>
                <Td>{dance.title}</Td>
                <Td>
                  <HStack gap="5px">
                    <Button>Edit</Button>
                    <Button>Delete</Button>
                  </HStack>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableContainer>
    </Page>
  );
}

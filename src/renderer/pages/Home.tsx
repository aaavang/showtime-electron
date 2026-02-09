import { Card, CardBody, Center, Text } from '@chakra-ui/react';
import { Page } from '../common/Page';

export function Home() {
  return (
    <Page name="Welcome to Showtime!">
      <Center>
        <Card width="66%">
          <CardBody>
            <Text>
              Showtime is a streamlined app designed specifically for dancers,
              making it easy to organize, manage, and play music for
              performances and rehearsals. It allows dancers to create
              playlists, arrange music tracks for specific routines, and set
              cues for seamless transitions. With simple playback controls and
              the ability to save different sets, Showtime helps performers stay
              focused on their dance while effortlessly managing their music.
              Whether for soloists, groups, or instructors, Showtime brings a
              professional touch to every show, rehearsal, and routine.
            </Text>
          </CardBody>
        </Card>
      </Center>
    </Page>
  );
}

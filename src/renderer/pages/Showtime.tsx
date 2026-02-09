import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Center,
  Checkbox,
  Flex,
  Heading,
  HStack,
  IconButton,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Text,
  useDisclosure,
  VStack
} from '@chakra-ui/react';
import FilePicker from 'chakra-ui-file-picker';
import {XMLParser} from 'fast-xml-parser';
import {useContext, useEffect, useState} from 'react';
import {FaGear} from 'react-icons/fa6';
import {Page} from '../common/Page';
import {UserSettingsContext} from '../providers/UserSettingsProvider';
import {decodeName} from '../utils/DecodeName';
import {AudioPlayer} from './AudioPlayerHowl';

export type Track = {
  location: string
  name: string
}

export const Showtime = () => {
  const [userSettings] = useContext(UserSettingsContext);
  const [file, setFile] = useState<File>();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [trackIndex, setTrackIndex] = useState<number>(0);
  const [overrideWindowsDrive, setOverrideWindowsDrive] = useState<boolean>(false);
  const [autoPlay, setAutoPlay] = useState<boolean>(false);
  const [windowsDrive, setWindowsDrive] = useState<string>('C');
  const { isOpen, onOpen, onClose } = useDisclosure();
  const parser = new XMLParser();
  const isWindows = userSettings.isWindows;

  const handleSettingsOpen = () => {
    // blur settings button
    document.getElementById('settings-button')?.blur();
    onOpen();
  };

  const handleChange = async (files: File[]) => {
    if (files.length === 0) {
      setTracks([]);
      setTrackIndex(0);
    } else {
      try {
        setFile(files[0]);
        const playlistXml = await files[0].text();
        const parsedPlaylist = parser.parse(playlistXml);
        const tracks: Track[] = parsedPlaylist.playlist.trackList.track.map((track: { location: string }) => ({
          location: track.location.replace('file:', 'showtime:'),
          name: decodeName(track.location.split('/').slice(-1)[0].slice(0, -4))
        }));
        setTracks(tracks);
      } catch (error) {
        setTracks([]);
        setTrackIndex(0);
        alert('Failed to parse playlist file: ' + String(error));
      }
    }
  };

  const remapTrackLocations = () => {
    const newTracks = tracks.map((track: Track) => ({
      location: overrideWindowsDrive ? track.location.replace(/showtime:\/\/\/(.:)/, `showtime:///${windowsDrive}:`) : track.location,
      name: track.name
    }));
    setTracks(newTracks);
  };

  const handlePrevious = () => {
    if (trackIndex > 0) {
      setTrackIndex(trackIndex - 1);
    }
    // blur previous button
    document.getElementById('previous-button')?.blur();
  };

  const handleNext = () => {
    if (trackIndex < tracks.length - 1) {
      setTrackIndex(trackIndex + 1);
    }
    // blur next button
    document.getElementById('next-button')?.blur();
  };

  const UpNext = () => {
    if (trackIndex + 1 < tracks.length) {
      return (
        <VStack>
          <Heading as={'h4'} size="md">Up Next </Heading>
          <Text>{tracks[trackIndex + 1].name}</Text>
        </VStack>
      );
    } else {
      return (
        <></>
      );
    }
  };

  const onDriveChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setWindowsDrive(e.target.value);
  };

  useEffect(() => {
    remapTrackLocations();
  }, [windowsDrive]);

  const driveLetters: string[] = Array.from({ length: 26 }, (_, i) => String.fromCharCode('A'.charCodeAt(0) + i));

  return (
    <Page name={'Showtime'}>
      <Center>
        <VStack gap={'15px'} w={'75vw'}>
          <HStack spacing="5px">
            <FilePicker
              onFileChange={handleChange}
              placeholder="Select a Playlist"
              accept=".xspf"
            />
            <IconButton id="settings-button" aria-label={'settings'} icon={<FaGear />} onClick={handleSettingsOpen} />
          </HStack>
          {file && tracks.length > 0 && (
            <Card w={'100%'}>
              <CardBody>
                <VStack w={'100%'}>
                  <Center>
                    <VStack>
                      <Heading as={'h3'} size="lg">Currently Playing</Heading>
                      <Text>{tracks[trackIndex].name}</Text>
                      <Text>Track {trackIndex + 1}/{tracks.length}</Text>
                      {trackIndex == tracks.length - 1 ? <Badge colorScheme={'orange'}>(last song!)</Badge> : <></>}
                    </VStack>
                  </Center>

                  <AudioPlayer src={tracks[trackIndex].location} onEnd={handleNext} autoPlay={autoPlay} />
                  <Center>
                    <UpNext />
                  </Center>
                  <Flex justifyContent={'space-between'} w={'100%'}>
                    {trackIndex > 0 ?
                      <Button id={'previous-button'} onClick={handlePrevious}>Previous</Button>
                      : <Box></Box>
                    }
                    {trackIndex < tracks.length - 1 ?
                      <Button id={'next-button'} onClick={handleNext}>Next</Button>
                      : <Box></Box>
                    }
                  </Flex>
                </VStack>
              </CardBody>
            </Card>
          )}
        </VStack>
        <Modal isOpen={isOpen} onClose={onClose}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Settings</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <HStack w={'100%'} justifyContent={'space-between'}>
                <Checkbox isDisabled={!isWindows}
                          isChecked={overrideWindowsDrive}
                          onChange={(e) => {
                            setOverrideWindowsDrive(e.target.checked);
                          }}>Override Windows Drive</Checkbox>
                {overrideWindowsDrive && (
                  <Select value={windowsDrive} onChange={onDriveChange} w={'25%'}>
                    {driveLetters.map((letter) => (
                      <option key={letter} value={letter}>{letter}:</option>
                    ))}
                  </Select>
                )}
              </HStack>
              <Checkbox isChecked={autoPlay} onChange={(e) => {
                setAutoPlay(e.target.checked);
              }}>Auto Play</Checkbox>
            </ModalBody>

            <ModalFooter>
              <Button colorScheme="blue" mr={3} onClick={onClose}>
                Close
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </Center>
    </Page>
  );
};

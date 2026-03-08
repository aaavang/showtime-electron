import {
  Box,
  Button,
  Card,
  CardBody,
  Checkbox,
  Divider,
  FormControl,
  Heading,
  HStack,
  Text,
  useColorMode,
  useToast,
} from '@chakra-ui/react';
import { useContext, useState } from 'react';
import { Page } from '../common/Page';
import { UserSettingsContext } from '../providers/UserSettingsProvider';
import { seedDatabase, clearDatabase } from '../seedData';

export function Settings() {
  const [userSettings, setUserSettings] = useContext(UserSettingsContext);
  const { colorMode, toggleColorMode } = useColorMode();
  const toast = useToast();
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedDatabase();
      toast({ title: 'Database seeded', status: 'success', duration: 2000 });
    } catch (e: any) {
      toast({ title: 'Seed failed', description: e.message, status: 'error', duration: 4000 });
    } finally {
      setSeeding(false);
    }
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      await clearDatabase();
      toast({ title: 'Database cleared', status: 'success', duration: 2000 });
    } catch (e: any) {
      toast({ title: 'Clear failed', description: e.message, status: 'error', duration: 4000 });
    } finally {
      setClearing(false);
    }
  };

  return (
    <Page name="Settings">
      <Card>
        <CardBody>
          <FormControl>
            <HStack gap="15px" alignItems="center" textAlign="center">
              <Text>Dark Mode</Text>
              <Checkbox
                isChecked={colorMode === 'dark'}
                onChange={toggleColorMode}
              />
            </HStack>
            <Text fontSize="xs">Select whether to use light or dark mode.</Text>
          </FormControl>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <FormControl>
            <HStack gap="15px" alignItems="center" textAlign="center">
              <Text>Enable Fine-Grained Autoplay</Text>
              <Checkbox
                isChecked={userSettings.enableFineGrainAutoplay}
                onChange={(e) => {
                  setUserSettings({
                    ...userSettings,
                    enableFineGrainAutoplay: e.target.checked,
                  });
                }}
              />
            </HStack>
            <Text fontSize="xs">
              When enabled, you can mark certain tracks to autoplay.
            </Text>
          </FormControl>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <FormControl>
            <HStack gap="15px" alignItems="center" textAlign="center">
              <Text>Use HTML5 Audio</Text>
              <Checkbox
                isChecked={userSettings.useHTML5Audio}
                // isDisabled={true}
                onChange={(e) => {
                  setUserSettings({
                    ...userSettings,
                    useHTML5Audio: e.target.checked,
                  });
                }}
              />
            </HStack>
            <Text fontSize="xs">
              When enabled, Howler will use HTML5 audio. Disabled because it
              introduces a bug where songs restart.
            </Text>
          </FormControl>
        </CardBody>
      </Card>
      <Box mt={8}>
        <Divider mb={4} />
        <Heading as="h3" size="md" color="red.500" mb={4}>
          Danger Zone
        </Heading>
        <Card borderColor="red.300" borderWidth="1px">
          <CardBody>
            <FormControl>
              <Text fontSize="sm" mb={3}>
                Seed the database with sample dances, songs, variants, and
                playlists for testing. Purge removes all data.
              </Text>
              <HStack>
                <Button
                  colorScheme="blue"
                  size="sm"
                  isLoading={seeding}
                  onClick={handleSeed}
                >
                  Seed Database
                </Button>
                <Button
                  colorScheme="red"
                  size="sm"
                  isLoading={clearing}
                  onClick={handleClear}
                >
                  Purge Database
                </Button>
              </HStack>
            </FormControl>
          </CardBody>
        </Card>
      </Box>
    </Page>
  );
}

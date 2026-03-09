import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
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
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import { useContext, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page } from '../common/Page';
import { UserSettingsContext } from '../providers/UserSettingsProvider';
import { database } from '../database';
import { seedDatabase, clearDatabase } from '../seedData';

export function Settings() {
  const [userSettings, setUserSettings] = useContext(UserSettingsContext);
  const { colorMode, toggleColorMode } = useColorMode();
  const navigate = useNavigate();
  const toast = useToast();
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirmStep, setConfirmStep] = useState(0);
  const {
    isOpen: isImportOpen,
    onOpen: onImportOpen,
    onClose: onImportClose,
  } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedDatabase();
      toast({ title: 'Database seeded', status: 'success', duration: 2000 });
    } catch (e: any) {
      toast({
        title: 'Seed failed',
        description: e.message,
        status: 'error',
        duration: 4000,
      });
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
      toast({
        title: 'Clear failed',
        description: e.message,
        status: 'error',
        duration: 4000,
      });
    } finally {
      setClearing(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const dump = {
        songs: await database.songs.toArray(),
        dances: await database.dances.toArray(),
        danceVariants: await database.danceVariants.toArray(),
        playlists: await database.playlists.toArray(),
        playlistDances: await database.playlistDances.toArray(),
      };
      const json = JSON.stringify(dump, null, 2);

      window.electron.ipcRenderer.sendMessage('exportDatabase', { json });
      window.electron.ipcRenderer.once('exportDatabase', (result: any) => {
        if (result.error) {
          toast({
            title: 'Export failed',
            description: result.error,
            status: 'error',
            duration: 4000,
          });
        } else if (!result.cancelled) {
          toast({
            title: 'Database exported',
            description: result.path,
            status: 'success',
            duration: 3000,
          });
        }
        setExporting(false);
      });
    } catch (e: any) {
      toast({
        title: 'Export failed',
        description: e.message,
        status: 'error',
        duration: 4000,
      });
      setExporting(false);
    }
  };

  const handleImportClick = () => {
    setConfirmStep(1);
    onImportOpen();
  };

  const handleImportConfirm = () => {
    if (confirmStep === 1) {
      setConfirmStep(2);
      return;
    }

    onImportClose();
    setConfirmStep(0);
    setImporting(true);

    window.electron.ipcRenderer.sendMessage('importDatabase', {});
    window.electron.ipcRenderer.once('importDatabase', async (result: any) => {
      try {
        if (result.cancelled) {
          setImporting(false);
          return;
        }
        if (result.error) {
          throw new Error(result.error);
        }

        const dump = JSON.parse(result.json);
        await clearDatabase();

        await database.transaction(
          'rw',
          [
            database.songs,
            database.dances,
            database.danceVariants,
            database.playlists,
            database.playlistDances,
          ],
          async () => {
            if (dump.songs?.length) await database.songs.bulkAdd(dump.songs);
            if (dump.dances?.length) await database.dances.bulkAdd(dump.dances);
            if (dump.danceVariants?.length)
              await database.danceVariants.bulkAdd(dump.danceVariants);
            if (dump.playlists?.length)
              await database.playlists.bulkAdd(dump.playlists);
            if (dump.playlistDances?.length)
              await database.playlistDances.bulkAdd(dump.playlistDances);
          },
        );

        toast({
          title: 'Database imported',
          status: 'success',
          duration: 2000,
        });
      } catch (e: any) {
        toast({
          title: 'Import failed',
          description: e.message,
          status: 'error',
          duration: 4000,
        });
      } finally {
        setImporting(false);
      }
    });
  };

  const handleImportCancel = () => {
    onImportClose();
    setConfirmStep(0);
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
              <Text>Preload Audio</Text>
              <Checkbox
                isChecked={userSettings.preloadAudio}
                onChange={(e) => {
                  setUserSettings({
                    ...userSettings,
                    preloadAudio: e.target.checked,
                  });
                }}
              />
            </HStack>
            <Text fontSize="xs">
              When enabled, all songs in the Practice Time list will be
              preloaded into memory for instant playback.
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
              {!window.electron.isPackaged && (
                <>
                  <Text fontSize="sm" mb={3}>
                    Seed the database with sample dances, songs, variants, and
                    playlists for testing. Purge removes all data.
                  </Text>
                  <HStack mb={3}>
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate('/query')}
                    >
                      Query Console
                    </Button>
                  </HStack>
                </>
              )}
              <Divider my={3} />
              <Text fontSize="sm" mb={3}>
                Export the entire database to a JSON file, or import from a
                previous export. Importing will replace all existing data.
              </Text>
              <HStack>
                <Button
                  colorScheme="teal"
                  size="sm"
                  isLoading={exporting}
                  onClick={handleExport}
                >
                  Export Database
                </Button>
                <Button
                  colorScheme="orange"
                  size="sm"
                  isLoading={importing}
                  onClick={handleImportClick}
                >
                  Import Database
                </Button>
              </HStack>
            </FormControl>
          </CardBody>
        </Card>
      </Box>
      <AlertDialog
        isOpen={isImportOpen}
        leastDestructiveRef={cancelRef as any}
        onClose={handleImportCancel}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              {confirmStep === 1
                ? 'Import Database'
                : 'Are you absolutely sure?'}
            </AlertDialogHeader>
            <AlertDialogBody>
              {confirmStep === 1
                ? 'This will delete all existing data and replace it with the imported file. Are you sure you want to continue?'
                : 'All current songs, dances, playlists, and variants will be permanently deleted and replaced. This cannot be undone.'}
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef as any} onClick={handleImportCancel}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleImportConfirm} ml={3}>
                {confirmStep === 1 ? 'Continue' : 'Yes, replace everything'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Page>
  );
}

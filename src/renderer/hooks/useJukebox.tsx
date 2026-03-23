import { CloseIcon } from '@chakra-ui/icons';
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  IconButton,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  VStack,
  keyframes,
} from '@chakra-ui/react';
import React, {
  MutableRefObject,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Dance, DanceVariant, database, Song } from '../database';
import { AudioPlayer } from '../pages/AudioPlayerTone';
import { UserSettingsContext } from '../providers/UserSettingsProvider';
import { HydratedDanceVariant } from './SelectDanceModal';
import { useSongPathEncoder } from './useSongPathEncoder';

const pulseAnimation = keyframes`
  0%, 50% { transform: scale(1); }
  55% { transform: scale(1.2); }
  60% { transform: scale(1); }
  65% { transform: scale(1.2); }
  70% { transform: scale(1); }
  75% { transform: scale(1.2); }
  80% { transform: scale(1); }
  100% { transform: scale(1); }
`;

export type JukeboxState = {
  showMode?: boolean;
  showJukebox: boolean;
  song?: Song;
  dance?: Dance;
  variant?: DanceVariant;
  onEnd?: (song: Song) => void;
  closeOnEnd?: boolean;
  currentTrackIndex?: number;
  playlist?: HydratedDanceVariant[];
  autoplay?: boolean;
};

type JukeboxProps = {
  state: JukeboxState;
  setState: (state: JukeboxState) => void;
  initialFocusRef?: any;
  onEnd?: (song: Song) => void;
  closeOnEnd?: boolean;
};

export type JukeboxReturnType = {
  jukeboxState: JukeboxState;
  setJukeboxState: (state: JukeboxState) => void;
  Jukebox: () => React.ReactNode;
  initialFocusRef: MutableRefObject<any>;
};

export const useJukebox = (): JukeboxReturnType => {
  const [jukeboxState, setJukeboxState] = useState<JukeboxState>({
    showJukebox: false,
  });
  const ref = useRef<HTMLElement>();

  const callback = useCallback(
    () => (
      <Jukebox
        state={jukeboxState}
        initialFocusRef={ref}
        setState={setJukeboxState}
      />
    ),
    [jukeboxState],
  );

  return {
    jukeboxState,
    setJukeboxState,
    Jukebox: callback,
    initialFocusRef: ref,
  };
};

function Jukebox({ state, setState, initialFocusRef }: JukeboxProps) {
  const [userSettings] = useContext(UserSettingsContext);
  const songPathEncoder = useSongPathEncoder();
  const isPlayingRef = useRef(false);
  const timestamps = useLiveQuery(
    () =>
      state.variant?.id
        ? database.variantTimestamps
            .where('variantId')
            .equals(state.variant.id)
            .sortBy('time')
        : [],
    [state.variant?.id],
  );
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const guardCancelRef = useRef<HTMLButtonElement>(null);

  if (!state.showJukebox || !state.song) {
    return null;
  }

  const doNextDance = () => {
    if (
      state.playlist &&
      state.currentTrackIndex! < state.playlist.length - 1
    ) {
      const nextSong = state.playlist[state.currentTrackIndex! + 1];
      setState({
        ...state,
        currentTrackIndex: state.currentTrackIndex! + 1,
        song: nextSong.song,
        dance: nextSong.dance,
        variant: nextSong.danceVariant,
        autoplay: nextSong.autoplay,
      });
    }
  };

  const doPreviousDance = () => {
    if (state.playlist && state.currentTrackIndex! > 0) {
      const previousSong = state.playlist[state.currentTrackIndex! - 1];
      setState({
        ...state,
        currentTrackIndex: state.currentTrackIndex! - 1,
        song: previousSong.song,
        dance: previousSong.dance,
        variant: previousSong.danceVariant,
        autoplay: previousSong.autoplay,
      });
    }
  };

  const doClose = () => {
    setState({ showJukebox: false });
  };

  const withShowModeGuard = (action: () => void) => {
    if (state.showMode && isPlayingRef.current) {
      setPendingAction(() => action);
    } else {
      action();
    }
  };

  const onEnd = () => {
    if (state.playlist) {
      if (state.currentTrackIndex! < state.playlist.length - 1) {
        doNextDance();
      } else {
        state.onEnd?.(state.song!);
        if (state.closeOnEnd) {
          doClose();
        }
      }
    } else {
      state.onEnd?.(state.song!);
      if (state.closeOnEnd) {
        doClose();
      }
    }
  };

  return (
    <Box width="100%">
      <HStack justifyContent="flex-end" marginTop="10px">
        <IconButton
          aria-label="close"
          icon={<CloseIcon />}
          onClick={() => withShowModeGuard(doClose)}
        />
      </HStack>
      <>
        <Flex>
          {state.playlist && (
            <VStack flex="0 0 20%" justifyContent="center" alignItems="center">
              <Heading as="h3" size="xs" minHeight="1.2em">
                {state.currentTrackIndex! >= 1
                  ? state.playlist[state.currentTrackIndex! - 1].dance.title
                  : ' '}
              </Heading>
              <Button
                colorScheme="gray"
                isDisabled={state.currentTrackIndex! < 1}
                onClick={() => withShowModeGuard(doPreviousDance)}
              >
                Previous
              </Button>
            </VStack>
          )}
          <Flex
            flex={state.playlist ? '0 0 60%' : '1'}
            alignItems="center"
            justifyContent="center"
          >
            <VStack textAlign="center">
              <Badge
                colorScheme={
                  userSettings.enableFineGrainAutoplay ? 'green' : 'gray'
                }
              >
                Auto Play{' '}
                {userSettings.enableFineGrainAutoplay && state.autoplay
                  ? 'Enabled'
                  : 'Disabled'}
              </Badge>
              {state.currentTrackIndex !== undefined && state.playlist && (
                <Heading
                  as="h2"
                  size="md"
                >{`${state.currentTrackIndex + 1}/${state.playlist.length}`}</Heading>
              )}
              {state.dance && (
                <Heading as="h2" size="lg">
                  {state.dance.title}
                </Heading>
              )}
              {state.variant && (
                <Heading as="h2" size="md">
                  {state.variant.title}
                </Heading>
              )}
              <Heading as="h3" size="md">
                {state.song.title}
              </Heading>
              {state.playlist?.[state.currentTrackIndex!]?.notes && (
                <Popover trigger="hover" placement="top">
                  <PopoverTrigger>
                    <Badge
                      key={state.currentTrackIndex}
                      colorScheme="yellow"
                      cursor="pointer"
                      mt={2}
                      mb={4}
                      px={2}
                      py={1}
                      animation={`${pulseAnimation} 2s ease-in-out`}
                    >
                      Hover for Notes
                    </Badge>
                  </PopoverTrigger>
                  <PopoverContent bg="yellow.100">
                    <PopoverArrow bg="yellow.100" />
                    <PopoverBody whiteSpace="pre-wrap" color="black">
                      {state.playlist[state.currentTrackIndex!].notes}
                    </PopoverBody>
                  </PopoverContent>
                </Popover>
              )}
            </VStack>
          </Flex>
          {state.playlist && (
            <VStack flex="0 0 20%" justifyContent="center" alignItems="center">
              <Heading as="h3" size="xs" minHeight="1.2em">
                {state.currentTrackIndex! < state.playlist.length - 1
                  ? state.playlist[state.currentTrackIndex! + 1].dance.title
                  : ' '}
              </Heading>
              <Button
                colorScheme="gray"
                isDisabled={
                  state.currentTrackIndex! >= state.playlist.length - 1
                }
                onClick={() => withShowModeGuard(doNextDance)}
              >
                Next
              </Button>
            </VStack>
          )}
        </Flex>
      </>
      <AudioPlayer
        initialFocusRef={initialFocusRef}
        showMode={state.showMode}
        autoPlay={userSettings.enableFineGrainAutoplay && state.autoplay}
        src={songPathEncoder(state.song)}
        onEnd={onEnd}
        isPlayingRef={isPlayingRef}
        timestamps={timestamps}
        variantId={state.variant?.id}
      />
      <AlertDialog
        isOpen={pendingAction !== null}
        leastDestructiveRef={guardCancelRef}
        onClose={() => setPendingAction(null)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Show Mode</AlertDialogHeader>
            <AlertDialogBody>
              We are running a show! Are you sure?
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button
                ref={guardCancelRef}
                onClick={() => setPendingAction(null)}
              >
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={() => {
                  setPendingAction(null);
                  pendingAction?.();
                }}
                ml={3}
              >
                Continue
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
}

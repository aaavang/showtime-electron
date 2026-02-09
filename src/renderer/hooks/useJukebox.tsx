import {CloseIcon} from '@chakra-ui/icons';
import {Badge, Box, Button, Flex, Heading, HStack, IconButton, VStack} from '@chakra-ui/react';
import React, {MutableRefObject, useCallback, useContext, useRef, useState} from 'react';
import {Dance, DanceVariant, Song} from '../database';
import {AudioPlayer} from '../pages/AudioPlayerHowl';
import {UserSettingsContext} from '../providers/UserSettingsProvider';
import {HydratedDanceVariant} from './SelectDanceModal';
import {useSongPathEncoder} from './useSongPathEncoder';

export type JukeboxState = {
  showMode?: boolean;
  showJukebox: boolean;
  song?: Song
  dance?: Dance
  variant?: DanceVariant
  onEnd?: (song: Song) => void
  closeOnEnd?: boolean
  currentTrackIndex?: number
  playlist?: HydratedDanceVariant[]
  autoplay?: boolean
}

type JukeboxProps = {
  state: JukeboxState
  setState: (state: JukeboxState) => void
  initialFocusRef?: any
  onEnd?: (song: Song) => void
  closeOnEnd?: boolean
}

export type JukeboxReturnType = {
  jukeboxState: JukeboxState
  setJukeboxState: (state: JukeboxState) => void
  Jukebox: () => React.ReactNode;
  initialFocusRef: MutableRefObject<any>
}

export const useJukebox = (): JukeboxReturnType => {
  const [jukeboxState, setJukeboxState] = useState<JukeboxState>({
    showJukebox: false
  });
  const ref = useRef<HTMLElement>()

  const callback = useCallback(() => <Jukebox state={jukeboxState}
                                              initialFocusRef={ref}
                                              setState={setJukeboxState} />, [jukeboxState]);


  return ({
    jukeboxState,
    setJukeboxState,
    Jukebox: callback,
    initialFocusRef: ref
  });
};

const Jukebox = ({ state, setState, initialFocusRef }: JukeboxProps) => {
  const [userSettings] = useContext(UserSettingsContext);
  const songPathEncoder = useSongPathEncoder();
  if (!state.showJukebox || !state.song) {
    return null;
  }

  const nextDance = () => {
    if (state.playlist && state.currentTrackIndex! < state.playlist.length - 1) {
      const nextSong = state.playlist[state.currentTrackIndex! + 1];
      setState({
        ...state,
        currentTrackIndex: state.currentTrackIndex! + 1,
        song: nextSong.song,
        dance: nextSong.dance,
        variant: nextSong.danceVariant,
        autoplay: nextSong.autoplay
      });
    }
  };

  const previousDance = () => {
    if (state.playlist && state.currentTrackIndex! > 0) {
      const previousSong = state.playlist[state.currentTrackIndex! - 1];
      setState({
        ...state,
        currentTrackIndex: state.currentTrackIndex! - 1,
        song: previousSong.song,
        dance: previousSong.dance,
        variant: previousSong.danceVariant,
        autoplay: previousSong.autoplay
      });
    }
  };

  const onEnd = () => {
    if (state.playlist) {
      if (state.currentTrackIndex! < state.playlist.length - 1) {
        nextDance();
      } else {
        state.onEnd?.(state.song!);
        if (state.closeOnEnd) {
          setState({
            showJukebox: false
          });
        }
      }
    } else {
      state.onEnd?.(state.song!);
      if (state.closeOnEnd) {
        setState({
          showJukebox: false
        });
      }
    }
  };

  return (
    <Box width={'100%'}>
      <HStack justifyContent={'flex-end'} marginTop={'10px'}>
        <IconButton aria-label={'close'} icon={<CloseIcon />} onClick={() => setState({
          showJukebox: false
        })} />
      </HStack>
      <>
        <Flex>
            {state.playlist && <VStack flex={'0 0 20%'} justifyContent={'center'} alignItems={'center'}>
              <Heading as={'h3'} size={'xs'}
                       minHeight={'1.2em'}>{state.currentTrackIndex! >= 1 ? state.playlist[state.currentTrackIndex! - 1].dance.title : ' '}</Heading>
              <Button colorScheme={'gray'} isDisabled={state.currentTrackIndex! < 1}
                      onClick={previousDance}>Previous</Button>
            </VStack>}
            <Flex flex={state.playlist ? '0 0 60%' : '1'} alignItems={'center'} justifyContent={'center'}>
              <VStack textAlign={'center'}>
                <Badge colorScheme={ userSettings.enableFineGrainAutoplay ? 'green' : 'gray' }>Auto Play {userSettings.enableFineGrainAutoplay && state.autoplay ? 'Enabled' : 'Disabled'}</Badge>
                {userSettings.useHTML5Audio && <Badge colorScheme={'red' }>HTML5 Enabled</Badge>}
                {state.currentTrackIndex !== undefined && state.playlist && (
                  <Heading as={'h2'} size={'md'}>{`${state.currentTrackIndex + 1}/${state.playlist.length}`}</Heading>)}
                {state.dance && (<Heading as={'h2'} size={'lg'}>{state.dance.title}</Heading>)}
                {state.variant && (<Heading as={'h2'} size={'md'}>{state.variant.title}</Heading>)}
                <Heading as={'h3'} size={'md'}>{state.song.title}</Heading>
              </VStack>
            </Flex>
            {state.playlist && <VStack flex={'0 0 20%'} justifyContent={'center'} alignItems={'center'}>
              <Heading as={'h3'} size={'xs'}
                       minHeight={'1.2em'}>{state.currentTrackIndex! < state.playlist.length - 1 ? state.playlist[state.currentTrackIndex! + 1].dance.title : ' '}</Heading>
              <Button colorScheme={'gray'} isDisabled={state.currentTrackIndex! >= state.playlist.length - 1}
                      onClick={nextDance}>Next</Button>
            </VStack>}
        </Flex>
      </>
      <AudioPlayer
        initialFocusRef={initialFocusRef}
        showMode={state.showMode}
        autoPlay={userSettings.enableFineGrainAutoplay && state.autoplay}
        src={songPathEncoder(state.song)} onEnd={onEnd} />
    </Box>
  );
};

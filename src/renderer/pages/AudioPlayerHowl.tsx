import {
  Button,
  HStack,
  Kbd,
  Progress,
  Text,
  useToast,
  VStack,
} from '@chakra-ui/react';
import { Howl } from 'howler';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { useInterval, useKeyPressEvent } from 'react-use';
import { AudioCacheContext } from '../providers/AudioCacheProvider';
import { UserSettingsContext } from '../providers/UserSettingsProvider';
import { confirmAction } from '../utils/ConfirmAction';
import { JukeboxContext } from '../providers/JukeboxProvider';

export type AudioPlayerHowlProps = {
  src: string;
  autoPlay?: boolean;
  onEnd: () => void;
  initialFocusRef?: any;
  showMode?: boolean;
  isPlayingRef?: React.MutableRefObject<boolean>;
};

export function AudioPlayer(props: AudioPlayerHowlProps) {
  const toast = useToast();
  const [userSettings] = useContext(UserSettingsContext);
  const { setJukeboxState } = useContext(JukeboxContext);
  const audioCache = useContext(AudioCacheContext);
  const [isFading, setIsFading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [howl, setHowl] = useState<Howl | null>(null);
  const howlRef = useRef<{ howl: Howl; cached: boolean } | null>(null);

  useEffect(() => {
    // Stop previous howl before switching
    if (howlRef.current) {
      const prev = howlRef.current;
      prev.howl.stop();
      if (!prev.cached) {
        prev.howl.unload();
      }
    }

    const cached = audioCache.get(props.src);
    if (cached) {
      cached.stop();
      cached.seek(0);
      cached.volume(1);
      howlRef.current = { howl: cached, cached: true };
      setHowl(cached);
    } else {
      const newHowl = new Howl({
        src: [props.src],
        html5: userSettings.useHTML5Audio,
      });
      howlRef.current = { howl: newHowl, cached: false };
      setHowl(newHowl);
    }

    return () => {
      if (howlRef.current) {
        howlRef.current.howl.stop();
        if (!howlRef.current.cached) {
          howlRef.current.howl.unload();
        }
        howlRef.current = null;
      }
    };
  }, [props.src]);

  useEffect(() => {
    if (props.isPlayingRef) {
      props.isPlayingRef.current = isPlaying;
    }
  }, [isPlaying]);

  useEffect(() => {
    if (howl) {
      const onLoad = () => {
        setCurrentTime(0);
        if (props.autoPlay && userSettings.enableFineGrainAutoplay) {
          howl.volume(1);
          howl.play();
          setIsPlaying(true);
        }
      };

      const onEnd = () => {
        props.onEnd();
        setCurrentTime(0);
        setIsPlaying(false);
      };

      howl.on('load', onLoad);
      howl.on('end', onEnd);

      // If already loaded (preloaded), fire onLoad immediately
      if (howl.state() === 'loaded') {
        onLoad();
      }

      return () => {
        howl.off('load', onLoad);
        howl.off('end', onEnd);
      };
    }
    return undefined;
  }, [howl]);

  const handlePlayPause = () => {
    // blur play-pause button
    document.getElementById('play-pause-button')?.blur();
    console.log('howl playing', howl?.playing());
    if (howl?.playing()) {
      console.log('showmode', props.showMode);
      if (props.showMode) {
        confirmAction(
          'We are running a show! Are you sure you want to pause?',
          () => {
            console.log('confirmed');
            howl?.pause();
            setIsPlaying(false);
          },
        )();
      } else {
        howl?.pause();
        setIsPlaying(false);
      }
    } else {
      setIsPlaying(true);
      howl?.volume(1);
      howl?.play();
    }
  };

  useKeyPressEvent(' ', handlePlayPause);
  useKeyPressEvent('Escape', () => {
    if (!props.showMode) {
      setJukeboxState({
        showJukebox: false,
      });
    }
  });

  useInterval(
    () => {
      if ((howl?.volume() ?? 0) <= 0) {
        toast({
          title: 'Faded out and moving on!',
          status: 'success',
          duration: 2000,
          isClosable: true,
        });
        howl?.pause();
        setIsFading(false);
        props.onEnd();
        setCurrentTime(0);
        setIsPlaying(false);
        howl?.seek(0);
        howl?.volume(1);
      } else if (howl?.playing()) {
        howl?.volume(
          parseFloat(Math.max(0, (howl?.volume() ?? 0) - 0.1).toFixed(1)),
        );
      }
    },
    isFading ? 250 : null,
  );

  const formatSecondsToLabel = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  const handleRestart = () => {
    if (howl?.playing()) {
      toast({
        title: 'Cannot restart while playing',
        status: 'warning',
        duration: 2000,
        isClosable: true,
      });
    } else {
      toast({
        title: 'Restarting',
        status: 'info',
        duration: 2000,
        isClosable: true,
      });
      howl?.seek(0);
      setCurrentTime(0);
    }
    // blur reset button
    document.getElementById('reset-button')?.blur();
  };

  const handleFade = () => {
    toast({
      title: 'Fading out',
      status: 'info',
      duration: 2000,
      isClosable: true,
    });
    setIsFading(true);

    // blur fade button
    document.getElementById('fade-button')?.blur();
  };

  useInterval(() => {
    if (howl?.playing()) {
      setCurrentTime(howl?.seek() ?? 0);
    }
  }, 100);

  const duration = howl?.duration() ?? -1;
  return (
    <VStack w="100%">
      <pre>
        {formatSecondsToLabel(currentTime)}/{formatSecondsToLabel(duration)}
      </pre>
      <Progress
        cursor="pointer"
        hasStripe
        value={(currentTime / duration) * 100}
        w="100%"
        onClick={(e) => {
          const percent = e.nativeEvent.offsetX / e.currentTarget.offsetWidth;
          howl?.seek(duration * percent);
          setCurrentTime(howl?.seek() ?? 0);
        }}
      />
      <HStack w="100%" justifyContent="space-between">
        <Button
          ref={props.initialFocusRef}
          id="play-pause-button"
          onClick={handlePlayPause}
          colorScheme="green"
        >
          {isPlaying ? 'Pause' : 'Play'}
        </Button>
        <Button
          id="fade-button"
          onClick={handleFade}
          colorScheme="blue"
          isDisabled={!isPlaying}
        >
          Fade out (2.5 secs)
        </Button>
        <Button
          id="reset-button"
          onClick={handleRestart}
          colorScheme="red"
          variant="outline"
          isDisabled={isPlaying || currentTime <= 0}
        >
          Restart
        </Button>
      </HStack>
      <Text>
        Press <Kbd>Space</Kbd> to Play/Pause
      </Text>
    </VStack>
  );
}

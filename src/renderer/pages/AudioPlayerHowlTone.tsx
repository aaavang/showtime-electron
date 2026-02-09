import {
  Button,
  HStack,
  Kbd,
  Progress,
  Text,
  useToast,
  VStack,
} from '@chakra-ui/react';
import React, { useContext, useEffect, useState } from 'react';
import { useInterval, useKeyPressEvent } from 'react-use';
import { useHowl } from 'rehowl';
import { PitchShift, Player } from 'tone';
import { UserSettingsContext } from '../providers/UserSettingsProvider';
import { confirmAction } from '../utils/ConfirmAction';
import { JukeboxContext } from '../providers/JukeboxProvider';

export type AudioPlayerHowlProps = {
  src: string;
  autoPlay?: boolean;
  onEnd: () => void;
  initialFocusRef?: any;
  showMode?: boolean;
};

export function AudioPlayer(props: AudioPlayerHowlProps) {
  const toast = useToast();
  const [userSettings] = useContext(UserSettingsContext);
  const { setJukeboxState } = useContext(JukeboxContext);
  const [isFading, setIsFading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [, setStartTime] = useState<number | undefined>(undefined);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [toneState, setToneState] = useState({
    player: undefined as Player | undefined,
    pitchShift: undefined as PitchShift | undefined,
  });
  const { howl } = useHowl({
    src: props.src,
    html5: userSettings.useHTML5Audio,
  });

  useEffect(() => {
    window.electron.ipcRenderer.once('readAudioFile', async (event: any) => {
      try {
        const ctx = new window.AudioContext();
        const audioBuffer = await ctx.decodeAudioData(event.buffer);
        const player = new Player(audioBuffer);
        const pitchShift = new PitchShift();
        player.connect(pitchShift);
        pitchShift.toDestination();
        setToneState({
          player,
          pitchShift,
        });
      } catch (error) {
        toast({
          title: 'Error decoding audio',
          description: String(error),
          status: 'error',
          duration: 4000,
          isClosable: true,
        });
      }
    });

    window.electron.ipcRenderer.sendMessage('readAudioFile', props.src);
  }, [props.src]);

  useEffect(() => {
    if (toneState.pitchShift && toneState.player) {
      toneState.player.playbackRate = rate;
      toneState.pitchShift.pitch = shiftToSemitones(rate);
    }
  }, [rate]);

  useEffect(() => {
    if (howl) {
      howl.on('load', () => {
        setCurrentTime(0);
        if (props.autoPlay && userSettings.enableFineGrainAutoplay) {
          howl.volume(1);
          howl.play();
          setIsPlaying(true);
          setStartTime(new Date().getTime());
        }
      });

      howl.on('end', () => {
        props.onEnd();
        setCurrentTime(0);
        setStartTime(undefined);
        setIsPlaying(false);
      });

      return () => {
        howl.off('load');
        howl.off('end');
      };
    }
    return undefined;
  }, [howl]);

  useEffect(() => {
    howl?.rate(rate);
  }, [rate]);

  const handleIncreaseRate = () => {
    setRate(parseFloat(Math.min(rate + 0.05, 4).toFixed(2)));
  };

  const handleDecreaseRate = () => {
    setRate(parseFloat(Math.max(rate - 0.05, 0.5).toFixed(2)));
  };

  const handlePlayPause = () => {
    // blur play-pause button
    document.getElementById('play-pause-button')?.blur();
    if (howl?.playing()) {
      if (props.showMode) {
        confirmAction(
          'We are running a show! Are you sure you want to pause?',
          () => {
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
      setStartTime(new Date().getTime());
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

  const shiftToSemitones = (shift: number) =>
    +(12 * Math.log2(1 / shift)).toFixed(1);

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
      {!props.showMode && userSettings.useHTML5Audio && (
        <HStack w="100%" justifyContent="space-between">
          <pre>{`Rate: ${rate}x`}</pre>
          <pre>{`Semitones: ${shiftToSemitones(rate)}`}</pre>
          <Button
            id="play-tone"
            onClick={() => {
              if (toneState.player?.state === 'started') {
                toneState.player?.stop();
              } else {
                toneState.player?.start();
              }
            }}
            colorScheme="blue"
          >
            Play Tone
          </Button>
          <Button
            id="decrease-rate"
            onClick={handleDecreaseRate}
            colorScheme="gray"
          >
            Decrease Rate
          </Button>
          <Button
            id="increase-rate"
            onClick={handleIncreaseRate}
            colorScheme="gray"
          >
            Increase Rate
          </Button>
        </HStack>
      )}
      <Text>
        Press <Kbd>Space</Kbd> to Play/Pause
      </Text>
    </VStack>
  );
}

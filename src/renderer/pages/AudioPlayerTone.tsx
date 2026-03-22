import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
  HStack,
  Kbd,
  Progress,
  Text,
  useToast,
  VStack,
} from '@chakra-ui/react';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { useInterval } from 'react-use';
import { GrainPlayer } from 'tone';
import { AudioCacheContext } from '../providers/AudioCacheProvider';
import { UserSettingsContext } from '../providers/UserSettingsProvider';
import { JukeboxContext } from '../providers/JukeboxProvider';

export type AudioPlayerProps = {
  src: string;
  autoPlay?: boolean;
  onEnd: () => void;
  initialFocusRef?: any;
  showMode?: boolean;
  isPlayingRef?: React.MutableRefObject<boolean>;
};

type ToneState = {
  player: GrainPlayer;
  duration: number;
};

const linearToDb = (v: number) => (v > 0 ? 20 * Math.log10(v) : -100);
const nowSec = () => performance.now() / 1000;

export function AudioPlayer(props: AudioPlayerProps) {
  const toast = useToast();
  const [userSettings] = useContext(UserSettingsContext);
  const { setJukeboxState } = useContext(JukeboxContext);
  const audioCache = useContext(AudioCacheContext);
  const [isFading, setIsFading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPauseConfirm, setShowPauseConfirm] = useState(false);
  const [rate, setRate] = useState(1);
  const [tone, setTone] = useState<ToneState | null>(null);
  const pauseCancelRef = useRef<HTMLButtonElement>(null);
  const toneRef = useRef<ToneState | null>(null);
  toneRef.current = tone;
  const playbackRef = useRef({ startOffset: 0, startTime: 0 });
  const fadeVolumeRef = useRef(1);
  const rateRef = useRef(rate);
  const isPlayingRef = useRef(isPlaying);
  rateRef.current = rate;
  isPlayingRef.current = isPlaying;

  const getPosition = () => {
    if (!isPlayingRef.current) return playbackRef.current.startOffset;
    const elapsed =
      (nowSec() - playbackRef.current.startTime) * rateRef.current;
    return Math.min(
      playbackRef.current.startOffset + elapsed,
      toneRef.current?.duration ?? Infinity,
    );
  };

  const buildPlayer = (audioBuffer: AudioBuffer): ToneState => {
    const player = new GrainPlayer({
      url: audioBuffer,
      grainSize: 0.05,
      overlap: 0.05,
    });
    player.toDestination();
    return { player, duration: audioBuffer.duration };
  };

  // Load audio — from cache or via IPC
  useEffect(() => {
    let disposed = false;
    setRate(1);
    setCurrentTime(0);
    setIsPlaying(false);
    playbackRef.current = { startOffset: 0, startTime: 0 };
    fadeVolumeRef.current = 1;

    const cached = audioCache.get(props.src);
    if (cached && cached instanceof AudioBuffer) {
      setTone(buildPlayer(cached));
      return () => {
        if (toneRef.current) {
          toneRef.current.player.stop();
          toneRef.current.player.dispose();
        }
      };
    }

    let unsubscribe: (() => void) | undefined;
    const handler = async (event: any) => {
      if (event.src !== props.src) return;
      unsubscribe?.();
      if (disposed) return;
      try {
        const ctx = new window.AudioContext();
        // IPC may deliver a Uint8Array instead of ArrayBuffer on some platforms
        const buf =
          event.buffer instanceof ArrayBuffer
            ? event.buffer
            : new Uint8Array(event.buffer).buffer;
        const audioBuffer = await ctx.decodeAudioData(buf);
        setTone(buildPlayer(audioBuffer));
      } catch (error) {
        toast({
          title: 'Error loading audio',
          description: String(error),
          status: 'error',
          duration: 4000,
          isClosable: true,
        });
      }
    };
    unsubscribe = window.electron.ipcRenderer.on('readAudioFile', handler);
    window.electron.ipcRenderer.sendMessage('readAudioFile', props.src);

    return () => {
      disposed = true;
      unsubscribe?.();
      if (toneRef.current) {
        toneRef.current.player.stop();
        toneRef.current.player.dispose();
      }
    };
  }, [props.src, toast, audioCache]);

  // Auto-play when loaded
  const { autoPlay, onEnd } = props;
  useEffect(() => {
    if (tone && autoPlay && userSettings.enableFineGrainAutoplay) {
      fadeVolumeRef.current = 1;
      tone.player.volume.value = 0;
      playbackRef.current = { startOffset: 0, startTime: nowSec() };
      tone.player.start(undefined, 0);
      setIsPlaying(true);
    }
  }, [tone, autoPlay, userSettings.enableFineGrainAutoplay]);

  useEffect(() => {
    if (props.isPlayingRef) {
      props.isPlayingRef.current = isPlaying;
    }
  }, [isPlaying, props.isPlayingRef]);

  // Rate change: GrainPlayer handles pitch preservation natively
  useEffect(() => {
    if (!tone) return;
    tone.player.playbackRate = rate;

    if (isPlaying) {
      const { startOffset } = playbackRef.current;
      tone.player.stop();
      playbackRef.current = { startOffset, startTime: nowSec() };
      tone.player.start(undefined, startOffset);
    }
  }, [rate, tone, isPlaying]);

  const checkpointPosition = () => {
    if (isPlayingRef.current) {
      const pos = getPosition();
      playbackRef.current = { startOffset: pos, startTime: nowSec() };
    }
  };

  const handleIncreaseRate = () => {
    if (props.showMode) return;
    checkpointPosition();
    setRate(parseFloat(Math.min(rate + 0.05, 4).toFixed(2)));
  };

  const handleDecreaseRate = () => {
    if (props.showMode) return;
    checkpointPosition();
    setRate(parseFloat(Math.max(rate - 0.05, 0.5).toFixed(2)));
  };

  const doPause = () => {
    if (!tone) return;
    playbackRef.current.startOffset = getPosition();
    tone.player.stop();
    setIsPlaying(false);
  };

  const doPlay = () => {
    if (!tone) return;
    fadeVolumeRef.current = 1;
    tone.player.volume.value = 0;
    playbackRef.current.startTime = nowSec();
    tone.player.start(undefined, playbackRef.current.startOffset);
    setIsPlaying(true);
  };

  const handlePlayPause = () => {
    document.getElementById('play-pause-button')?.blur();
    if (!tone) return;

    if (isPlaying) {
      if (props.showMode) {
        setShowPauseConfirm(true);
      } else {
        doPause();
      }
    } else {
      doPlay();
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case ' ':
          e.preventDefault();
          handlePlayPause();
          break;
        case '[':
          handleDecreaseRate();
          break;
        case ']':
          handleIncreaseRate();
          break;
        case 'Escape':
          if (!props.showMode) {
            setJukeboxState({ showJukebox: false });
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // Fade interval
  useInterval(
    () => {
      if (!tone) return;
      if (fadeVolumeRef.current <= 0) {
        toast({
          title: 'Faded out and moving on!',
          status: 'success',
          duration: 2000,
          isClosable: true,
        });
        tone.player.stop();
        setIsFading(false);
        setIsPlaying(false);
        setCurrentTime(0);
        playbackRef.current = { startOffset: 0, startTime: 0 };
        fadeVolumeRef.current = 1;
        tone.player.volume.value = 0;
        onEnd();
      } else if (isPlaying) {
        fadeVolumeRef.current = parseFloat(
          Math.max(0, fadeVolumeRef.current - 0.1).toFixed(1),
        );
        tone.player.volume.value = linearToDb(fadeVolumeRef.current);
      }
    },
    isFading ? 250 : null,
  );

  // Position tracking + end detection
  useInterval(() => {
    if (isPlaying && tone) {
      const pos = getPosition();
      setCurrentTime(pos);
      if (pos >= tone.duration) {
        tone.player.stop();
        setIsPlaying(false);
        setCurrentTime(0);
        playbackRef.current = { startOffset: 0, startTime: 0 };
        onEnd();
      }
    }
  }, 100);

  const formatSecondsToLabel = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  const handleRestart = () => {
    if (isPlaying) {
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
      playbackRef.current = { startOffset: 0, startTime: 0 };
      setCurrentTime(0);
    }
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
    document.getElementById('fade-button')?.blur();
  };

  const duration = tone?.duration ?? 0;
  const isLoaded = tone !== null;
  return (
    <VStack w="100%">
      <pre>
        {isLoaded
          ? `${formatSecondsToLabel(currentTime)}/${formatSecondsToLabel(duration)}`
          : '--:--/--:--'}
      </pre>
      <Progress
        cursor="pointer"
        hasStripe
        value={isLoaded && duration > 0 ? (currentTime / duration) * 100 : 0}
        w="100%"
        onClick={(e) => {
          const percent = e.nativeEvent.offsetX / e.currentTarget.offsetWidth;
          const seekPos = duration * percent;
          if (isPlaying && tone) {
            tone.player.stop();
            playbackRef.current = { startOffset: seekPos, startTime: nowSec() };
            tone.player.start(undefined, seekPos);
          } else {
            playbackRef.current.startOffset = seekPos;
          }
          setCurrentTime(seekPos);
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
      {!props.showMode && (
        <HStack w="100%" justifyContent="space-between">
          <Button
            id="decrease-rate"
            onClick={handleDecreaseRate}
            colorScheme="gray"
          >
            Decrease Rate
          </Button>
          <pre>{`Rate: ${rate}x`}</pre>
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
        {!props.showMode && (
          <>
            {' '}
            | <Kbd>[</Kbd> / <Kbd>]</Kbd> to adjust speed
          </>
        )}
      </Text>
      <AlertDialog
        isOpen={showPauseConfirm}
        leastDestructiveRef={pauseCancelRef}
        onClose={() => setShowPauseConfirm(false)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Pause Playback</AlertDialogHeader>
            <AlertDialogBody>
              We are running a show! Are you sure you want to pause?
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button
                ref={pauseCancelRef}
                onClick={() => setShowPauseConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={() => {
                  setShowPauseConfirm(false);
                  doPause();
                }}
                ml={3}
              >
                Pause
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </VStack>
  );
}

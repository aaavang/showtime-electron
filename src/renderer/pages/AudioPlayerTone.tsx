import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Badge,
  Button,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Kbd,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Progress,
  Text,
  useDisclosure,
  useToast,
  VStack,
} from '@chakra-ui/react';
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useInterval } from 'react-use';
import { GrainPlayer, Player } from 'tone';
import { database, VariantTimestamp } from '../database';
import { AudioCacheContext } from '../providers/AudioCacheProvider';
import { UserSettingsContext } from '../providers/UserSettingsProvider';
import { JukeboxContext } from '../providers/JukeboxProvider';
import { getSharedAudioContext } from '../utils/audioContext';

export type AudioPlayerProps = {
  src: string;
  autoPlay?: boolean;
  onEnd: () => void;
  initialFocusRef?: any;
  showMode?: boolean;
  isPlayingRef?: React.MutableRefObject<boolean>;
  timestamps?: VariantTimestamp[];
  variantId?: number;
};

type ToneState = {
  player: Player | GrainPlayer;
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
  const [showFadeConfirm, setShowFadeConfirm] = useState(false);
  const [rate, setRate] = useState(1);
  const [volume, setVolume] = useState(100);
  const [tone, setTone] = useState<ToneState | null>(null);
  const [activeTimestampIndex, setActiveTimestampIndex] = useState(-1);
  const [tsScrollOffset, setTsScrollOffset] = useState<number | null>(null);
  const [capturedTime, setCapturedTime] = useState(0);
  const [timestampLabel, setTimestampLabel] = useState('');
  const timestampModal = useDisclosure();
  const timestampInputRef = useRef<HTMLInputElement>(null);
  const pauseCancelRef = useRef<HTMLButtonElement>(null);
  const fadeCancelRef = useRef<HTMLButtonElement>(null);

  const sortedTimestamps = useMemo(
    () => (props.timestamps ?? []).slice().sort((a, b) => a.time - b.time),
    [props.timestamps],
  );
  const toneRef = useRef<ToneState | null>(null);
  toneRef.current = tone;
  const playbackRef = useRef({ startOffset: 0, startTime: 0 });
  const fadeVolumeRef = useRef(1);
  const rateRef = useRef(rate);
  const volumeRef = useRef(volume);
  const isPlayingRef = useRef(isPlaying);
  rateRef.current = rate;
  volumeRef.current = volume;
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

  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const playerTypeRef = useRef<'standard' | 'grain'>('standard');

  const buildPlayer = (buffer: AudioBuffer, grain: boolean): ToneState => {
    const player = grain
      ? new GrainPlayer({ url: buffer, grainSize: 0.05, overlap: 0.05 })
      : new Player({ url: buffer });
    player.toDestination();
    return { player, duration: buffer.duration };
  };

  // Load audio — from cache or via IPC
  useEffect(() => {
    let disposed = false;
    setRate(1);
    setCurrentTime(0);
    setIsPlaying(false);
    playbackRef.current = { startOffset: 0, startTime: 0 };
    fadeVolumeRef.current = 1;
    playerTypeRef.current = 'standard';

    const cached = audioCache.get(props.src);
    if (cached && cached instanceof AudioBuffer) {
      audioBufferRef.current = cached;
      setTone(buildPlayer(cached, false));
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
        const ctx = getSharedAudioContext();
        // IPC may deliver a Uint8Array instead of ArrayBuffer on some platforms
        const buf =
          event.buffer instanceof ArrayBuffer
            ? event.buffer
            : new Uint8Array(event.buffer).buffer;
        const audioBuffer = await ctx.decodeAudioData(buf);
        audioBufferRef.current = audioBuffer;
        setTone(buildPlayer(audioBuffer, false));
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
      tone.player.volume.value = linearToDb(volumeRef.current / 100);
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

  // Volume change: apply user volume scaled by fade volume
  useEffect(() => {
    if (!tone) return;
    const effectiveVolume = (volume / 100) * fadeVolumeRef.current;
    tone.player.volume.value = linearToDb(effectiveVolume);
  }, [volume, tone]);

  // Rate change: update playbackRate without stop/start
  useEffect(() => {
    if (!tone) return;
    // Checkpoint position before rate change so tracking stays accurate
    if (isPlaying) {
      const pos = getPosition();
      playbackRef.current = { startOffset: pos, startTime: nowSec() };
    }
    tone.player.playbackRate = rate;
  }, [rate, tone, isPlaying]);

  // Swap between Player (1x / show mode) and GrainPlayer (non-1x, pitch-preserved)
  const useGrain = !props.showMode && rate !== 1;
  useEffect(() => {
    const targetType = useGrain ? 'grain' : 'standard';
    if (
      !audioBufferRef.current ||
      !tone ||
      targetType === playerTypeRef.current
    )
      return;

    playerTypeRef.current = targetType;
    const pos = getPosition();
    const wasPlaying = isPlayingRef.current;

    tone.player.stop();
    tone.player.dispose();

    const newTone = buildPlayer(audioBufferRef.current, useGrain);
    newTone.player.playbackRate = rateRef.current;
    const ev = (volumeRef.current / 100) * fadeVolumeRef.current;
    newTone.player.volume.value = linearToDb(ev);

    if (wasPlaying) {
      playbackRef.current = { startOffset: pos, startTime: nowSec() };
      newTone.player.start(undefined, pos);
    } else {
      playbackRef.current.startOffset = pos;
    }

    setTone(newTone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useGrain]);

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
    tone.player.volume.value = -100;
    tone.player.stop();
    setIsPlaying(false);
  };

  const doPlay = () => {
    if (!tone) return;
    const effectiveVolume = (volumeRef.current / 100) * fadeVolumeRef.current;
    tone.player.volume.value = linearToDb(effectiveVolume);
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
      // Don't handle hotkeys when interacting with form elements
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
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
        case 'ArrowUp':
          e.preventDefault();
          setVolume((v) => Math.min(v + 5, 150));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume((v) => Math.max(v - 5, 0));
          break;
        case 't':
        case 'T':
          handleCaptureTimestamp();
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
        tone.player.volume.value = linearToDb(volumeRef.current / 100);
        onEnd();
      } else if (isPlaying) {
        fadeVolumeRef.current = parseFloat(
          Math.max(0, fadeVolumeRef.current - 0.1).toFixed(1),
        );
        const effectiveVolume =
          (volumeRef.current / 100) * fadeVolumeRef.current;
        tone.player.volume.value = linearToDb(effectiveVolume);
      }
    },
    isFading ? 250 : null,
  );

  // Position tracking + end detection + active timestamp
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
      // Find the last timestamp at or before the current position
      if (sortedTimestamps.length > 0) {
        let idx = -1;
        for (let i = sortedTimestamps.length - 1; i >= 0; i -= 1) {
          if (sortedTimestamps[i].time <= pos) {
            idx = i;
            break;
          }
        }
        setActiveTimestampIndex(idx);
      }
    }
  }, 50);

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

  const doFade = () => {
    toast({
      title: 'Fading out',
      status: 'info',
      duration: 2000,
      isClosable: true,
    });
    setIsFading(true);
    document.getElementById('fade-button')?.blur();
  };

  const handleFade = () => {
    if (props.showMode) {
      setShowFadeConfirm(true);
    } else {
      doFade();
    }
  };

  const handleCaptureTimestamp = () => {
    if (!props.variantId || props.showMode) return;
    setCapturedTime(parseFloat(getPosition().toFixed(2)));
    setTimestampLabel('');
    timestampModal.onOpen();
  };

  const handleSaveTimestamp = async () => {
    if (!props.variantId || !timestampLabel.trim()) return;
    await database.variantTimestamps.add({
      variantId: props.variantId,
      time: capturedTime,
      label: timestampLabel.trim(),
    } as any);
    timestampModal.onClose();
    toast({
      title: 'Timestamp saved',
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  const seekToTimestamp = (time: number) => {
    if (props.showMode || !tone) return;
    if (isPlaying) {
      tone.player.stop();
      playbackRef.current = { startOffset: time, startTime: nowSec() };
      tone.player.start(undefined, time);
    } else {
      playbackRef.current.startOffset = time;
    }
    setCurrentTime(time);
    // Reset scroll offset so auto-follow resumes
    setTsScrollOffset(null);
  };

  const duration = tone?.duration ?? 0;
  const isLoaded = tone !== null;
  return (
    <VStack w="100%">
      <HStack w="100%" justifyContent="space-between">
        <pre>
          {isLoaded
            ? `${formatSecondsToLabel(currentTime)}/${formatSecondsToLabel(duration)}`
            : '--:--/--:--'}
        </pre>
        <pre>{`Vol: ${volume}%`}</pre>
      </HStack>
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
      {sortedTimestamps.length > 0 &&
        (() => {
          const active = activeTimestampIndex;
          // Use manual scroll offset if set, otherwise auto-follow playback
          let windowStart: number;
          if (tsScrollOffset !== null) {
            windowStart = tsScrollOffset;
          } else if (active < 0) {
            windowStart = 0;
          } else if (active === 0) {
            windowStart = 0;
          } else {
            windowStart = Math.min(active - 1, sortedTimestamps.length - 3);
          }
          windowStart = Math.max(
            0,
            Math.min(windowStart, sortedTimestamps.length - 3),
          );
          const visible = sortedTimestamps.slice(windowStart, windowStart + 3);
          const canScrollLeft = windowStart > 0;
          const canScrollRight = windowStart + 3 < sortedTimestamps.length;
          return (
            <HStack spacing={2} justifyContent="center">
              <Button
                size="xs"
                variant="ghost"
                isDisabled={!canScrollLeft}
                onClick={() => setTsScrollOffset(windowStart - 1)}
              >
                &lsaquo;
              </Button>
              {visible.map((ts) => {
                const idx = sortedTimestamps.indexOf(ts);
                const isCurrent = idx === active;
                return (
                  <Text
                    key={ts.id}
                    fontSize="sm"
                    color={isCurrent ? 'white' : 'gray.500'}
                    fontWeight={isCurrent ? 'bold' : 'normal'}
                    cursor={props.showMode ? 'default' : 'pointer'}
                    onClick={
                      props.showMode
                        ? undefined
                        : () => {
                            setActiveTimestampIndex(idx);
                            seekToTimestamp(ts.time);
                          }
                    }
                    _hover={
                      props.showMode ? {} : { textDecoration: 'underline' }
                    }
                  >
                    {formatSecondsToLabel(ts.time)} {ts.label}
                  </Text>
                );
              })}
              <Button
                size="xs"
                variant="ghost"
                isDisabled={!canScrollRight}
                onClick={() => setTsScrollOffset(windowStart + 1)}
              >
                &rsaquo;
              </Button>
            </HStack>
          );
        })()}
      <HStack w="100%" justifyContent="space-between">
        <Button
          ref={props.initialFocusRef}
          id="play-pause-button"
          onClick={handlePlayPause}
          colorScheme="green"
          size="lg"
          w="120px"
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
        {!props.showMode && props.variantId && (
          <Button
            size="sm"
            colorScheme="purple"
            variant="outline"
            onClick={handleCaptureTimestamp}
          >
            Add Timestamp
          </Button>
        )}
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
        Press <Kbd>Space</Kbd> to Play/Pause | <Kbd>&uarr;</Kbd> /{' '}
        <Kbd>&darr;</Kbd> volume
        {!props.showMode && (
          <>
            {' '}
            | <Kbd>[</Kbd> / <Kbd>]</Kbd> speed
          </>
        )}
        {!props.showMode && props.variantId && (
          <>
            {' '}
            | <Kbd>T</Kbd> timestamp
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
      <AlertDialog
        isOpen={showFadeConfirm}
        leastDestructiveRef={fadeCancelRef}
        onClose={() => setShowFadeConfirm(false)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Fade Out</AlertDialogHeader>
            <AlertDialogBody>
              We are running a show! Are you sure you want to fade out?
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button
                ref={fadeCancelRef}
                onClick={() => setShowFadeConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={() => {
                  setShowFadeConfirm(false);
                  doFade();
                }}
                ml={3}
              >
                Fade Out
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
      <Modal
        isOpen={timestampModal.isOpen}
        onClose={timestampModal.onClose}
        initialFocusRef={timestampInputRef}
        size="sm"
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add Timestamp</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={3}>
              <Text>
                Time: <strong>{formatSecondsToLabel(capturedTime)}</strong> (
                {capturedTime}s)
              </Text>
              <FormControl>
                <FormLabel>Label</FormLabel>
                <Input
                  ref={timestampInputRef}
                  value={timestampLabel}
                  onChange={(e) => setTimestampLabel(e.target.value)}
                  placeholder="e.g. Chorus, Bridge, Spin"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTimestamp();
                    e.stopPropagation();
                  }}
                  onKeyUp={(e) => e.stopPropagation()}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button mr={3} onClick={timestampModal.onClose}>
              Cancel
            </Button>
            <Button
              colorScheme="purple"
              onClick={handleSaveTimestamp}
              isDisabled={!timestampLabel.trim()}
            >
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
}

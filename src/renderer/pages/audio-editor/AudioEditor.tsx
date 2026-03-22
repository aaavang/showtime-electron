import {
  Box,
  Button,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalOverlay,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Spinner,
  Text,
  VStack,
  useToast,
} from '@chakra-ui/react';
import { useLiveQuery } from 'dexie-react-hooks';
import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useInterval } from 'react-use';
import { GrainPlayer } from 'tone';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Page } from '../../common/Page';
import { database } from '../../database';
import { AudioCacheContext } from '../../providers/AudioCacheProvider';
import { renderOfflineAudio } from '../../utils/renderOfflineAudio';
import { Waveform } from './Waveform';

export function AudioEditor() {
  const toast = useToast();
  const navigate = useNavigate();
  const audioCache = useContext(AudioCacheContext);
  const songId = parseInt(useParams().songId!, 10);
  const [searchParams] = useSearchParams();
  const variantIdParam = searchParams.get('variantId');
  const variantId = variantIdParam ? parseInt(variantIdParam, 10) : null;

  // Always load song
  const song = useLiveQuery(() => database.songs.get(songId), [songId]);

  // Conditionally load variant + dance
  const variant = useLiveQuery(
    () => (variantId ? database.danceVariants.get(variantId) : undefined),
    [variantId],
  );
  const dance = useLiveQuery(
    () => (variant ? database.dances.get(variant.danceId) : undefined),
    [variant],
  );

  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [zoom, setZoom] = useState(0);
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewTime, setPreviewTime] = useState<number | undefined>(undefined);
  const previewPlayerRef = useRef<GrainPlayer | null>(null);
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewStartRef = useRef({ wallTime: 0, audioTime: 0, rate: 1 });

  const isVariantMode = variantId !== null;

  // Prepopulate title from song
  useEffect(() => {
    if (song && !title) {
      setTitle(song.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song]);

  // Load audio — from cache or via IPC
  useEffect(() => {
    if (!song) return undefined;

    let disposed = false;
    const src = encodeURI(`showtime://${song.path}`);

    const cached = audioCache.get(src);
    if (cached && cached instanceof AudioBuffer) {
      setAudioBuffer(cached);
      setEndTime(cached.duration);
      return undefined;
    }

    let unsubscribe: (() => void) | undefined;
    const handler = async (event: any) => {
      if (event.src !== src) return;
      unsubscribe?.();
      if (disposed) return;
      try {
        const ctx = new window.AudioContext();
        const decoded = await ctx.decodeAudioData(event.buffer);
        setAudioBuffer(decoded);
        setEndTime(decoded.duration);
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
    window.electron.ipcRenderer.sendMessage('readAudioFile', src);

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [song, toast, audioCache]);

  const handleRegionChange = useCallback((start: number, end: number) => {
    setStartTime(start);
    setEndTime(end);
  }, []);

  // --- Preview ---

  const stopPreview = useCallback(() => {
    if (previewPlayerRef.current) {
      previewPlayerRef.current.stop();
      previewPlayerRef.current.dispose();
      previewPlayerRef.current = null;
    }
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
    setIsPreviewing(false);
    setPreviewTime(undefined);
  }, []);

  const handlePreview = useCallback(() => {
    if (isPreviewing) {
      stopPreview();
      return;
    }

    if (!audioBuffer) return;

    const player = new GrainPlayer({
      url: audioBuffer,
      grainSize: 0.05,
      overlap: 0.05,
    });
    player.playbackRate = playbackRate;
    player.toDestination();

    const regionDuration = endTime - startTime;
    player.start(undefined, startTime, regionDuration);
    previewPlayerRef.current = player;
    setIsPreviewing(true);
    setPreviewTime(startTime);
    previewStartRef.current = {
      wallTime: performance.now(),
      audioTime: startTime,
      rate: playbackRate,
    };

    const timeoutMs = (regionDuration / playbackRate) * 1000;
    previewTimeoutRef.current = setTimeout(() => {
      stopPreview();
    }, timeoutMs + 100);
  }, [
    audioBuffer,
    startTime,
    endTime,
    playbackRate,
    isPreviewing,
    stopPreview,
  ]);

  useInterval(
    () => {
      const { wallTime, audioTime, rate } = previewStartRef.current;
      const elapsed = (performance.now() - wallTime) / 1000;
      const pos = audioTime + elapsed * rate;
      if (pos >= endTime) {
        stopPreview();
      } else {
        setPreviewTime(pos);
      }
    },
    isPreviewing ? 50 : null,
  );

  useEffect(() => {
    return () => {
      if (previewPlayerRef.current) {
        previewPlayerRef.current.stop();
        previewPlayerRef.current.dispose();
      }
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
    };
  }, []);

  // Spacebar to toggle preview
  const handlePreviewRef = useRef(handlePreview);
  handlePreviewRef.current = handlePreview;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger when typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === ' ') {
        e.preventDefault();
        handlePreviewRef.current();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // --- Render + encode shared helper ---

  const encodeAndSaveViaIPC = useCallback(
    (
      rendered: AudioBuffer,
      opts: { filePath?: string; defaultFileName?: string },
    ) => {
      // Send raw float32 bytes per channel — avoids Array.from() on large TypedArrays
      const channelBuffers: ArrayBuffer[] = [];
      for (let ch = 0; ch < rendered.numberOfChannels; ch += 1) {
        const f32 = rendered.getChannelData(ch);
        channelBuffers.push(
          f32.buffer.slice(f32.byteOffset, f32.byteOffset + f32.byteLength),
        );
      }

      return new Promise<any>((resolve) => {
        const unsubscribe = window.electron.ipcRenderer.on(
          'encodeAndSaveAudio',
          (result: any) => {
            unsubscribe?.();
            resolve(result);
          },
        );
        window.electron.ipcRenderer.sendMessage('encodeAndSaveAudio', {
          ...opts,
          channelBuffers,
          sampleRate: rendered.sampleRate,
          numChannels: rendered.numberOfChannels,
        });
      });
    },
    [],
  );

  // --- Save ---
  // If title matches the original song title → overwrite in place.
  // If title differs → save as new song (+ new variant in variant mode).

  const handleSave = useCallback(async () => {
    if (!audioBuffer || !song) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast({
        title: 'Title required',
        status: 'warning',
        duration: 2000,
        isClosable: true,
      });
      return;
    }

    if (endTime <= startTime) {
      toast({
        title: 'Invalid selection',
        description: 'End time must be after start time',
        status: 'warning',
        duration: 2000,
        isClosable: true,
      });
      return;
    }

    const isOverwrite = trimmedTitle === song.title;

    if (
      isOverwrite &&
      // eslint-disable-next-line no-alert
      !window.confirm(
        `Overwrite "${song.title}"? This will replace the original audio file.`,
      )
    ) {
      return;
    }

    setIsSaving(true);
    setSaveStatus('Rendering audio...');

    // Yield so React can paint the modal before CPU-heavy work
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });

    try {
      const regionDuration = endTime - startTime;
      const outputSamples = Math.ceil(
        (regionDuration / playbackRate) * audioBuffer.sampleRate,
      );

      // eslint-disable-next-line no-console
      console.log('Save params:', {
        startTime,
        endTime,
        playbackRate,
        regionDuration,
        outputSamples,
        bufferDuration: audioBuffer.duration,
      });

      if (
        regionDuration <= 0 ||
        outputSamples <= 0 ||
        outputSamples > 10 * 60 * audioBuffer.sampleRate
      ) {
        throw new Error(
          `Invalid render params: region=${regionDuration.toFixed(1)}s, ` +
            `output=${outputSamples} samples, rate=${playbackRate}x`,
        );
      }

      const rendered = await renderOfflineAudio({
        sourceBuffer: audioBuffer,
        startTime,
        endTime,
        playbackRate,
      });

      setSaveStatus('Encoding & saving...');

      if (isOverwrite) {
        const result = await encodeAndSaveViaIPC(rendered, {
          filePath: song.path,
        });
        if (result.error) throw new Error(result.error);

        audioCache.remove(encodeURI(`showtime://${song.path}`));

        // Update song path if extension changed (e.g. .wav → .mp3)
        if (result.path !== song.path) {
          await database.songs.update(song.id, { path: result.path });
          audioCache.remove(encodeURI(`showtime://${result.path}`));
        }

        toast({
          title: 'Song saved',
          description: `"${song.title}" has been updated`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        const defaultFileName = `${trimmedTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp3`;
        const result = await encodeAndSaveViaIPC(rendered, {
          defaultFileName,
        });

        if (result.error) throw new Error(result.error);
        if (result.cancelled) {
          setIsSaving(false);
          setSaveStatus('');
          return;
        }

        setSaveStatus('Creating records...');

        const newSongId = await database.songs.add({
          title: trimmedTitle,
          path: result.path,
        } as any);

        // In variant mode, also create a new DanceVariant
        if (isVariantMode && variant) {
          await database.danceVariants.add({
            title: trimmedTitle,
            danceId: variant.danceId,
            songId: newSongId,
            defaultVariant: false,
          } as any);
        }

        toast({
          title: isVariantMode ? 'New variant created' : 'New song created',
          description: `"${trimmedTitle}" saved`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      }

      if (isVariantMode && variant) {
        navigate(`/dances/${variant.danceId}`);
      } else {
        navigate('/songs');
      }
    } catch (error) {
      toast({
        title: 'Save failed',
        description: String(error),
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setIsSaving(false);
      setSaveStatus('');
    }
  }, [
    audioBuffer,
    startTime,
    endTime,
    playbackRate,
    song,
    title,
    encodeAndSaveViaIPC,
    audioCache,
    toast,
    navigate,
    isVariantMode,
    variant,
  ]);

  // --- Render ---

  if (!song) {
    return (
      <Page name="Audio Editor">
        <Spinner />
      </Page>
    );
  }

  const backPath =
    isVariantMode && variant ? `/dances/${variant.danceId}` : '/songs';
  const backLabel =
    isVariantMode && dance ? `Back to ${dance.title}` : 'Back to Songs';

  return (
    <Page name="Audio Editor">
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Box>
          <Button variant="link" onClick={() => navigate(backPath)} mb={2}>
            &larr; {backLabel}
          </Button>
          {isVariantMode && dance && variant && (
            <Text fontSize="sm" color="gray.500" mb={1}>
              {dance.title} &mdash; {variant.title}
            </Text>
          )}
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            variant="flushed"
            fontSize="xl"
            fontWeight="bold"
            placeholder="Song title"
          />
          {title.trim() && title.trim() !== song.title && (
            <Text fontSize="xs" color="blue.500" mt={1}>
              New title — will save as a new{' '}
              {isVariantMode ? 'variant' : 'song'}
            </Text>
          )}
        </Box>

        {/* Waveform */}
        {audioBuffer ? (
          <>
            <Waveform
              audioBuffer={audioBuffer}
              startTime={startTime}
              endTime={endTime}
              onRegionChange={handleRegionChange}
              zoom={zoom}
              onZoomChange={setZoom}
              currentTime={previewTime}
            />
            <FormControl>
              <FormLabel>Zoom</FormLabel>
              <Slider min={0} max={500} value={zoom} onChange={setZoom}>
                <SliderTrack>
                  <SliderFilledTrack />
                </SliderTrack>
                <SliderThumb />
              </Slider>
            </FormControl>
          </>
        ) : (
          <Box textAlign="center" py={10}>
            <Spinner size="lg" />
            <Text mt={2}>Loading audio...</Text>
          </Box>
        )}

        {/* Controls */}
        <HStack spacing={4} align="end">
          <FormControl w="120px" flexShrink={0}>
            <FormLabel fontSize="xs">Start (s)</FormLabel>
            <NumberInput
              size="sm"
              min={0}
              max={endTime}
              step={0.1}
              precision={2}
              value={startTime}
              onChange={(_, val) => {
                if (!Number.isNaN(val)) setStartTime(val);
              }}
            >
              <NumberInputField />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
          </FormControl>

          <FormControl w="120px" flexShrink={0}>
            <FormLabel fontSize="xs">End (s)</FormLabel>
            <NumberInput
              size="sm"
              min={startTime}
              max={audioBuffer?.duration ?? 0}
              step={0.1}
              precision={2}
              value={endTime}
              onChange={(_, val) => {
                if (!Number.isNaN(val)) setEndTime(val);
              }}
            >
              <NumberInputField />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
          </FormControl>

          <HStack flexShrink={0}>
            <Button
              size="sm"
              onClick={() =>
                setPlaybackRate(
                  parseFloat(Math.max(playbackRate - 0.05, 0.5).toFixed(2)),
                )
              }
            >
              -
            </Button>
            <Text fontSize="sm" fontFamily="mono" whiteSpace="nowrap">
              {playbackRate}x
            </Text>
            <Button
              size="sm"
              onClick={() =>
                setPlaybackRate(
                  parseFloat(Math.min(playbackRate + 0.05, 4).toFixed(2)),
                )
              }
            >
              +
            </Button>
          </HStack>

          <Button
            size="sm"
            colorScheme="green"
            onClick={handlePreview}
            isDisabled={!audioBuffer}
          >
            {isPreviewing ? 'Stop' : 'Preview'}
          </Button>

          <Button
            size="sm"
            colorScheme="blue"
            onClick={handleSave}
            isLoading={isSaving}
            isDisabled={!audioBuffer || !title.trim()}
          >
            Save
          </Button>
        </HStack>
      </VStack>

      {/* Save progress modal */}
      <Modal isOpen={isSaving} onClose={() => {}} isCentered size="xs">
        <ModalOverlay />
        <ModalContent>
          <ModalBody textAlign="center" py={8}>
            <Spinner size="lg" mb={4} />
            <Text>{saveStatus}</Text>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Page>
  );
}

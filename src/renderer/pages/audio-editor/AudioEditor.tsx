import { DeleteIcon } from '@chakra-ui/icons';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  HStack,
  Heading,
  IconButton,
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
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
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
import { database, VariantTimestamp } from '../../database';
import { useSongPathEncoder } from '../../hooks/useSongPathEncoder';
import { AudioCacheContext } from '../../providers/AudioCacheProvider';
import { renderOfflineAudio } from '../../utils/renderOfflineAudio';
import { Waveform } from './Waveform';

export function AudioEditor() {
  const toast = useToast();
  const navigate = useNavigate();
  const audioCache = useContext(AudioCacheContext);
  const songPathEncoder = useSongPathEncoder();
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
  const [hasRegion, setHasRegion] = useState(false);
  const [fadeIn, setFadeIn] = useState(0);
  const [fadeOut, setFadeOut] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  type EditorSnapshot = {
    audioBuffer: AudioBuffer;
    startTime: number;
    endTime: number;
    hasRegion: boolean;
    fadeIn: number;
    fadeOut: number;
  };
  const undoStackRef = useRef<EditorSnapshot[]>([]);

  const pushUndo = useCallback(() => {
    if (!audioBuffer) return;
    undoStackRef.current.push({
      audioBuffer,
      startTime,
      endTime,
      hasRegion,
      fadeIn,
      fadeOut,
    });
  }, [audioBuffer, startTime, endTime, hasRegion, fadeIn, fadeOut]);

  const handleUndo = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const snapshot = stack.pop()!;
    setAudioBuffer(snapshot.audioBuffer);
    setStartTime(snapshot.startTime);
    setEndTime(snapshot.endTime);
    setHasRegion(snapshot.hasRegion);
    setFadeIn(snapshot.fadeIn);
    setFadeOut(snapshot.fadeOut);
  }, []);
  const [zoom, setZoom] = useState(0);
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewTime, setPreviewTime] = useState<number | undefined>(undefined);
  const previewPlayerRef = useRef<GrainPlayer | null>(null);
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewStartRef = useRef({ wallTime: 0, audioTime: 0, rate: 1 });

  const timestamps = useLiveQuery(
    () =>
      variantId
        ? database.variantTimestamps
            .where('variantId')
            .equals(variantId)
            .sortBy('time')
        : [],
    [variantId],
  );

  const [newTsTime, setNewTsTime] = useState(0);
  const [newTsLabel, setNewTsLabel] = useState('');

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
    const src = songPathEncoder(song);

    const cached = audioCache.get(src);
    if (cached && cached instanceof AudioBuffer) {
      setAudioBuffer(cached);
      setEndTime(parseFloat(cached.duration.toFixed(2)));
      return undefined;
    }

    let unsubscribe: (() => void) | undefined;
    const handler = async (event: any) => {
      if (event.src !== src) return;
      unsubscribe?.();
      if (disposed) return;
      try {
        const ctx = new window.AudioContext();
        // IPC may deliver a Uint8Array instead of ArrayBuffer on some platforms
        const buf =
          event.buffer instanceof ArrayBuffer
            ? event.buffer
            : new Uint8Array(event.buffer).buffer;
        const decoded = await ctx.decodeAudioData(buf);
        setAudioBuffer(decoded);
        setEndTime(parseFloat(decoded.duration.toFixed(2)));
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
  }, [song, toast, audioCache, songPathEncoder]);

  const handleRegionChange = useCallback((start: number, end: number) => {
    setStartTime(start);
    setEndTime(end);
    setHasRegion(true);
  }, []);

  const handleRegionClear = useCallback(() => {
    if (!audioBuffer) return;
    setStartTime(0);
    setEndTime(parseFloat(audioBuffer.duration.toFixed(2)));
    setHasRegion(false);
  }, [audioBuffer]);

  const handleDeleteRegion = useCallback(() => {
    if (!audioBuffer || !hasRegion) return;
    if (endTime <= startTime) return;

    pushUndo();

    const { sampleRate } = audioBuffer;
    const numChannels = audioBuffer.numberOfChannels;
    const beforeSamples = Math.floor(startTime * sampleRate);
    const afterStart = Math.ceil(endTime * sampleRate);
    const afterSamples = audioBuffer.length - afterStart;
    const newLength = beforeSamples + Math.max(afterSamples, 0);

    if (newLength <= 0) return;

    const newBuffer = new AudioContext().createBuffer(
      numChannels,
      newLength,
      sampleRate,
    );

    for (let ch = 0; ch < numChannels; ch += 1) {
      const oldData = audioBuffer.getChannelData(ch);
      const newData = newBuffer.getChannelData(ch);
      // Copy audio before the region
      newData.set(oldData.subarray(0, beforeSamples));
      // Copy audio after the region
      if (afterSamples > 0) {
        newData.set(oldData.subarray(afterStart), beforeSamples);
      }
    }

    // Adjust fade in: if deleted region overlaps [0, fadeIn], shrink it
    let newFadeIn = fadeIn;
    if (fadeIn > 0) {
      if (startTime < fadeIn) {
        // Overlap: remove the portion of fade-in that was deleted
        const overlap = Math.min(endTime, fadeIn) - startTime;
        newFadeIn = Math.max(parseFloat((fadeIn - overlap).toFixed(2)), 0);
      }
      // If deleted region is entirely after fade in, no change
    }

    // Adjust fade out: if deleted region overlaps [oldDuration - fadeOut, oldDuration], shrink it
    const oldDuration = audioBuffer.duration;
    let newFadeOut = fadeOut;
    if (fadeOut > 0) {
      const fadeOutStart = oldDuration - fadeOut;
      if (endTime > fadeOutStart) {
        // Overlap: remove the portion of fade-out that was deleted
        const overlap = endTime - Math.max(startTime, fadeOutStart);
        newFadeOut = Math.max(parseFloat((fadeOut - overlap).toFixed(2)), 0);
      }
      // If deleted region is entirely before fade out, duration offset stays the same
    }

    setAudioBuffer(newBuffer);
    setStartTime(0);
    setEndTime(parseFloat(newBuffer.duration.toFixed(2)));
    setHasRegion(false);
    setFadeIn(newFadeIn);
    setFadeOut(newFadeOut);
  }, [audioBuffer, hasRegion, startTime, endTime, fadeIn, fadeOut, pushUndo]);

  const handleTrimToSelection = useCallback(() => {
    if (!audioBuffer || !hasRegion) return;
    if (endTime <= startTime) return;

    pushUndo();

    const { sampleRate } = audioBuffer;
    const numChannels = audioBuffer.numberOfChannels;
    const startSample = Math.floor(startTime * sampleRate);
    const endSample = Math.ceil(endTime * sampleRate);
    const newLength = endSample - startSample;

    if (newLength <= 0) return;

    const newBuffer = new AudioContext().createBuffer(
      numChannels,
      newLength,
      sampleRate,
    );

    for (let ch = 0; ch < numChannels; ch += 1) {
      const oldData = audioBuffer.getChannelData(ch);
      newBuffer
        .getChannelData(ch)
        .set(oldData.subarray(startSample, endSample));
    }

    // Adjust fades: clamp to what fits within the trimmed region
    const trimmedDuration = newBuffer.duration;
    let newFadeIn = fadeIn > 0 ? Math.max(fadeIn - startTime, 0) : 0;
    const oldDuration = audioBuffer.duration;
    let newFadeOut =
      fadeOut > 0 ? Math.max(fadeOut - (oldDuration - endTime), 0) : 0;
    // Prevent overlap
    if (newFadeIn + newFadeOut > trimmedDuration) {
      const ratio = trimmedDuration / (newFadeIn + newFadeOut);
      newFadeIn = parseFloat((newFadeIn * ratio).toFixed(2));
      newFadeOut = parseFloat((newFadeOut * ratio).toFixed(2));
    } else {
      newFadeIn = parseFloat(newFadeIn.toFixed(2));
      newFadeOut = parseFloat(newFadeOut.toFixed(2));
    }

    setAudioBuffer(newBuffer);
    setStartTime(0);
    setEndTime(parseFloat(trimmedDuration.toFixed(2)));
    setHasRegion(false);
    setFadeIn(newFadeIn);
    setFadeOut(newFadeOut);
  }, [audioBuffer, hasRegion, startTime, endTime, fadeIn, fadeOut, pushUndo]);

  const handleMarkFadeIn = useCallback(() => {
    if (!hasRegion || !audioBuffer) return;
    const duration = parseFloat((endTime - startTime).toFixed(2));
    const maxAllowed = audioBuffer.duration - fadeOut;
    if (duration > 0) setFadeIn(Math.min(duration, maxAllowed));
  }, [hasRegion, audioBuffer, startTime, endTime, fadeOut]);

  const handleMarkFadeOut = useCallback(() => {
    if (!hasRegion || !audioBuffer) return;
    const duration = parseFloat((endTime - startTime).toFixed(2));
    const maxAllowed = audioBuffer.duration - fadeIn;
    if (duration > 0) setFadeOut(Math.min(duration, maxAllowed));
  }, [hasRegion, audioBuffer, startTime, endTime, fadeIn]);

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

  const handlePreview = useCallback(async () => {
    if (isPreviewing) {
      stopPreview();
      return;
    }

    if (!audioBuffer) return;

    const regionDuration = endTime - startTime;
    if (regionDuration <= 0) return;

    // Render with fades and playback rate baked in
    const rendered = await renderOfflineAudio({
      sourceBuffer: audioBuffer,
      startTime,
      endTime,
      playbackRate,
      fadeIn,
      fadeOut,
    });

    // Play the rendered buffer at rate 1.0 (everything is already baked in)
    const player = new GrainPlayer({
      url: rendered,
      grainSize: 0.05,
      overlap: 0.05,
    });
    player.playbackRate = 1;
    player.toDestination();

    const outputDuration = rendered.duration;
    player.start(undefined, 0, outputDuration);
    previewPlayerRef.current = player;
    setIsPreviewing(true);
    setPreviewTime(startTime);
    previewStartRef.current = {
      wallTime: performance.now(),
      audioTime: startTime,
      rate: playbackRate,
    };

    const timeoutMs = outputDuration * 1000;
    previewTimeoutRef.current = setTimeout(() => {
      stopPreview();
    }, timeoutMs + 100);
  }, [
    audioBuffer,
    startTime,
    endTime,
    playbackRate,
    fadeIn,
    fadeOut,
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

  // Keyboard shortcuts
  const handlePreviewRef = useRef(handlePreview);
  handlePreviewRef.current = handlePreview;
  const handleUndoRef = useRef(handleUndo);
  handleUndoRef.current = handleUndo;
  const handleRegionClearRef = useRef(handleRegionClear);
  handleRegionClearRef.current = handleRegionClear;
  const handleDeleteRegionRef = useRef(handleDeleteRegion);
  handleDeleteRegionRef.current = handleDeleteRegion;
  const handleTrimRef = useRef(handleTrimToSelection);
  handleTrimRef.current = handleTrimToSelection;
  const handleMarkFadeInRef = useRef(handleMarkFadeIn);
  handleMarkFadeInRef.current = handleMarkFadeIn;
  const handleMarkFadeOutRef = useRef(handleMarkFadeOut);
  handleMarkFadeOutRef.current = handleMarkFadeOut;
  const playbackRateRef = useRef(playbackRate);
  playbackRateRef.current = playbackRate;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd/Ctrl+Z works even in inputs
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        handleUndoRef.current();
        return;
      }
      // Don't trigger other shortcuts when typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          handlePreviewRef.current();
          break;
        case 'Escape':
          handleRegionClearRef.current();
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          handleDeleteRegionRef.current();
          break;
        case 't':
          handleTrimRef.current();
          break;
        case 'i':
          handleMarkFadeInRef.current();
          break;
        case 'o':
          handleMarkFadeOutRef.current();
          break;
        case '[':
          setPlaybackRate(
            parseFloat(
              Math.max(playbackRateRef.current - 0.05, 0.5).toFixed(2),
            ),
          );
          break;
        case ']':
          setPlaybackRate(
            parseFloat(Math.min(playbackRateRef.current + 0.05, 4).toFixed(2)),
          );
          break;
        default:
          break;
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
        fadeIn,
        fadeOut,
      });

      setSaveStatus('Encoding & saving...');

      if (isOverwrite) {
        const result = await encodeAndSaveViaIPC(rendered, {
          filePath: song.path,
        });
        if (result.error) throw new Error(result.error);

        audioCache.remove(songPathEncoder(song));

        // Update song path if extension changed (e.g. .wav → .mp3)
        if (result.path !== song.path) {
          await database.songs.update(song.id, { path: result.path });
          audioCache.remove(songPathEncoder({ ...song, path: result.path }));
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
    fadeIn,
    fadeOut,
    song,
    title,
    encodeAndSaveViaIPC,
    songPathEncoder,
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
              hasRegion={hasRegion}
              onRegionChange={handleRegionChange}
              onRegionClear={handleRegionClear}
              zoom={zoom}
              onZoomChange={setZoom}
              currentTime={previewTime}
              timestamps={timestamps}
              fadeIn={fadeIn}
              fadeOut={fadeOut}
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

        {/* Selection controls */}
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
                if (!Number.isNaN(val)) {
                  setStartTime(val);
                  setHasRegion(true);
                }
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
                if (!Number.isNaN(val)) {
                  setEndTime(val);
                  setHasRegion(true);
                }
              }}
            >
              <NumberInputField />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
          </FormControl>

          <Button
            size="sm"
            variant="outline"
            onClick={handleRegionClear}
            isDisabled={!hasRegion}
            title="Esc"
          >
            Clear Selection (Esc)
          </Button>

          <Button
            size="sm"
            variant="outline"
            colorScheme="red"
            onClick={handleDeleteRegion}
            isDisabled={!hasRegion}
            title="Delete / Backspace"
          >
            Delete Region (Del)
          </Button>

          <Button
            size="sm"
            variant="outline"
            colorScheme="teal"
            onClick={handleTrimToSelection}
            isDisabled={!hasRegion}
            title="T"
          >
            Trim to Selection (T)
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleUndo}
            isDisabled={undoStackRef.current.length === 0}
            title="Cmd/Ctrl+Z"
          >
            Undo ({'\u2318'}Z)
          </Button>
        </HStack>

        {/* Fade controls */}
        <HStack spacing={4} align="end">
          <FormControl w="120px" flexShrink={0}>
            <FormLabel fontSize="xs">Fade In (s)</FormLabel>
            <NumberInput
              size="sm"
              min={0}
              max={Math.max((audioBuffer?.duration ?? 0) - fadeOut, 0)}
              step={0.5}
              precision={1}
              value={fadeIn}
              onChange={(_, val) => {
                if (!Number.isNaN(val)) setFadeIn(val);
              }}
            >
              <NumberInputField />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
          </FormControl>

          <Button
            size="sm"
            colorScheme="green"
            variant="outline"
            onClick={handleMarkFadeIn}
            isDisabled={!hasRegion}
            title="I"
          >
            Mark as Fade In (I)
          </Button>

          <FormControl w="120px" flexShrink={0}>
            <FormLabel fontSize="xs">Fade Out (s)</FormLabel>
            <NumberInput
              size="sm"
              min={0}
              max={Math.max((audioBuffer?.duration ?? 0) - fadeIn, 0)}
              step={0.5}
              precision={1}
              value={fadeOut}
              onChange={(_, val) => {
                if (!Number.isNaN(val)) setFadeOut(val);
              }}
            >
              <NumberInputField />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
          </FormControl>

          <Button
            size="sm"
            colorScheme="purple"
            variant="outline"
            onClick={handleMarkFadeOut}
            isDisabled={!hasRegion}
            title="O"
          >
            Mark as Fade Out (O)
          </Button>
        </HStack>

        {/* Playback controls */}
        <HStack spacing={4} align="end">
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
        {/* Timestamps */}
        {isVariantMode && variantId && (
          <Box>
            <Heading size="sm" mb={2}>
              Timestamps
            </Heading>
            {timestamps && timestamps.length > 0 && (
              <Table size="sm" mb={3}>
                <Thead>
                  <Tr>
                    <Th>Time</Th>
                    <Th>Label</Th>
                    <Th w="40px" />
                  </Tr>
                </Thead>
                <Tbody>
                  {timestamps.map((ts: VariantTimestamp) => (
                    <Tr key={ts.id}>
                      <Td fontFamily="mono" w="80px">
                        {`${Math.floor(ts.time / 60)}:${Math.round(ts.time % 60)
                          .toString()
                          .padStart(2, '0')}`}
                      </Td>
                      <Td>
                        <Input
                          size="sm"
                          variant="flushed"
                          defaultValue={ts.label}
                          onBlur={(e) => {
                            const val = e.target.value.trim();
                            if (val && val !== ts.label) {
                              database.variantTimestamps.update(ts.id, {
                                label: val,
                              });
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter')
                              (e.target as HTMLInputElement).blur();
                          }}
                        />
                      </Td>
                      <Td>
                        <IconButton
                          aria-label="Delete timestamp"
                          icon={<DeleteIcon />}
                          size="xs"
                          variant="ghost"
                          colorScheme="red"
                          onClick={() =>
                            database.variantTimestamps.delete(ts.id)
                          }
                        />
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
            <HStack spacing={2}>
              <FormControl w="100px" flexShrink={0}>
                <FormLabel fontSize="xs">Time (s)</FormLabel>
                <NumberInput
                  size="sm"
                  min={0}
                  max={audioBuffer?.duration ?? 0}
                  step={0.1}
                  precision={2}
                  value={newTsTime}
                  onChange={(_, val) => {
                    if (!Number.isNaN(val)) setNewTsTime(val);
                  }}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
              </FormControl>
              <FormControl flexGrow={1}>
                <FormLabel fontSize="xs">Label</FormLabel>
                <Input
                  size="sm"
                  value={newTsLabel}
                  onChange={(e) => setNewTsLabel(e.target.value)}
                  placeholder="e.g. Chorus, Bridge"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTsLabel.trim()) {
                      database.variantTimestamps.add({
                        variantId,
                        time: newTsTime,
                        label: newTsLabel.trim(),
                      } as any);
                      setNewTsLabel('');
                    }
                  }}
                />
              </FormControl>
              <Button
                size="sm"
                colorScheme="purple"
                mt="auto"
                onClick={() => {
                  if (!newTsLabel.trim()) return;
                  database.variantTimestamps.add({
                    variantId,
                    time: newTsTime,
                    label: newTsLabel.trim(),
                  } as any);
                  setNewTsLabel('');
                }}
                isDisabled={!newTsLabel.trim()}
              >
                Add
              </Button>
            </HStack>
          </Box>
        )}
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

import React, { useEffect, useRef, useState } from 'react';
import { Box } from '@chakra-ui/react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin, { Region } from 'wavesurfer.js/dist/plugins/regions.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.js';
import { encodeWav } from '../../utils/encodeWav';
import { VariantTimestamp } from '../../database';

export type WaveformProps = {
  audioBuffer: AudioBuffer;
  startTime: number;
  endTime: number;
  onRegionChange: (start: number, end: number) => void;
  onRegionClear?: () => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  currentTime?: number;
  hasRegion: boolean;
  timestamps?: VariantTimestamp[];
  fadeIn?: number;
  fadeOut?: number;
};

export const Waveform = React.memo(function Waveform({
  audioBuffer,
  startTime,
  endTime,
  onRegionChange,
  onRegionClear,
  zoom,
  onZoomChange,
  currentTime,
  hasRegion,
  timestamps,
  fadeIn = 0,
  fadeOut = 0,
}: WaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);
  const readyRef = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const onRegionChangeRef = useRef(onRegionChange);
  onRegionChangeRef.current = onRegionChange;
  const onRegionClearRef = useRef(onRegionClear);
  onRegionClearRef.current = onRegionClear;
  const onZoomChangeRef = useRef(onZoomChange);
  onZoomChangeRef.current = onZoomChange;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  // Track whether the region update came from user interaction (drag/resize)
  // to avoid syncing back from the parent and creating a loop
  const isUserDraggingRef = useRef(false);
  // Track programmatic addRegion calls so region-created doesn't echo back
  const isProgrammaticRef = useRef(false);

  // Create WaveSurfer instance
  useEffect(() => {
    if (!containerRef.current) return undefined;

    const regions = RegionsPlugin.create();
    regionsRef.current = regions;

    const timeline = TimelinePlugin.create({
      timeInterval: 5,
      primaryLabelInterval: 5,
      secondaryLabelInterval: 0,
      style: { fontSize: '11px', color: '#888' },
    });

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#4a9eff',
      progressColor: '#4a9eff',
      cursorColor: '#1a365d',
      cursorWidth: 2,
      height: 128,
      interact: false, // disable default click-to-seek so drag works on empty areas
      plugins: [regions, timeline],
    });

    // Load audio via blob URL from the AudioBuffer
    const wavData = encodeWav(audioBuffer);
    const blob = new Blob([wavData], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    ws.load(url);

    readyRef.current = false;
    setIsReady(false);
    ws.on('ready', () => {
      readyRef.current = true;
      setIsReady(true);
      // Apply initial zoom so WaveSurfer matches the slider value
      ws.zoom(zoomRef.current);
    });

    // Allow drag-to-create new regions on the waveform
    regions.enableDragSelection({
      color: 'rgba(74, 158, 255, 0.2)',
    });

    // During drag-to-create, the region isn't saved yet so the plugin
    // doesn't relay its `update` events. Listen on the region directly.
    regions.on('region-initialized', (region: Region) => {
      isUserDraggingRef.current = true;
      region.on('update', () => {
        onRegionChangeRef.current(
          parseFloat(region.start.toFixed(2)),
          parseFloat(region.end.toFixed(2)),
        );
      });
    });

    // When a new region is created via drag, remove old ones and notify parent
    regions.on('region-created', (region: Region) => {
      if (isProgrammaticRef.current) return;
      // Ignore timestamp markers and fade regions
      if (region.id.startsWith('ts-') || region.id.startsWith('fade-')) return;
      // Remove zero-length regions (accidental clicks) and reset drag flag
      if (Math.abs(region.end - region.start) < 0.01) {
        region.remove();
        isUserDraggingRef.current = false;
        return;
      }

      // Remove all other trim regions — keep timestamp markers and fade regions
      regions.getRegions().forEach((r) => {
        if (
          r.id !== region.id &&
          !r.id.startsWith('ts-') &&
          !r.id.startsWith('fade-')
        )
          r.remove();
      });
      onRegionChangeRef.current(
        parseFloat(region.start.toFixed(2)),
        parseFloat(region.end.toFixed(2)),
      );
      isUserDraggingRef.current = false;
    });

    // When a region is being resized/dragged by the user, update live
    regions.on('region-update', (region: Region) => {
      if (isProgrammaticRef.current) return;
      isUserDraggingRef.current = true;
      onRegionChangeRef.current(
        parseFloat(region.start.toFixed(2)),
        parseFloat(region.end.toFixed(2)),
      );
    });

    // When the drag/resize finishes, clear the dragging flag
    regions.on('region-updated', (region: Region) => {
      if (isProgrammaticRef.current) return;
      onRegionChangeRef.current(
        parseFloat(region.start.toFixed(2)),
        parseFloat(region.end.toFixed(2)),
      );
      isUserDraggingRef.current = false;
    });

    wsRef.current = ws;

    return () => {
      URL.revokeObjectURL(url);
      ws.destroy();
      wsRef.current = null;
      regionsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioBuffer]);

  // Scroll wheel zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -20 : 20;
      const next = Math.max(0, Math.min(500, zoomRef.current + delta));
      onZoomChangeRef.current(next);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  // Sync region from parent state (e.g. when NumberInputs change)
  useEffect(() => {
    const regions = regionsRef.current;
    if (!regions || isUserDraggingRef.current) return;

    // If no region, clear all visual trim regions (keep timestamp markers and fades)
    if (!hasRegion) {
      isProgrammaticRef.current = true;
      regions
        .getRegions()
        .filter((r) => !r.id.startsWith('ts-') && !r.id.startsWith('fade-'))
        .forEach((r) => r.remove());
      isProgrammaticRef.current = false;
      return;
    }

    // Don't create a region until we have a meaningful range
    if (endTime <= startTime) return;

    const existing = regions
      .getRegions()
      .filter((r) => !r.id.startsWith('ts-') && !r.id.startsWith('fade-'));
    if (existing.length === 1) {
      const r = existing[0];
      // Only update if values actually differ to avoid loops
      if (
        Math.abs(r.start - startTime) > 0.01 ||
        Math.abs(r.end - endTime) > 0.01
      ) {
        isProgrammaticRef.current = true;
        r.setOptions({ start: startTime, end: endTime });
        isProgrammaticRef.current = false;
      }
    } else {
      // No region yet (or multiple) — clear and create one
      existing.forEach((r) => r.remove());
      isProgrammaticRef.current = true;
      regions.addRegion({
        start: startTime,
        end: endTime,
        color: 'rgba(74, 158, 255, 0.2)',
        drag: true,
        resize: true,
      });
      isProgrammaticRef.current = false;
    }
  }, [startTime, endTime, hasRegion]);

  // Sync timestamp markers (wait for WaveSurfer to be ready)
  useEffect(() => {
    const regions = regionsRef.current;
    if (!regions || !isReady) return;

    isProgrammaticRef.current = true;

    // Remove existing timestamp markers
    regions
      .getRegions()
      .filter((r) => r.id.startsWith('ts-'))
      .forEach((r) => r.remove());

    // Add current timestamps as point markers (start === end for vertical line)
    (timestamps ?? []).forEach((ts) => {
      regions.addRegion({
        id: `ts-${ts.id}`,
        start: ts.time,
        end: ts.time,
        color: 'rgba(255, 165, 0, 0.8)',
        drag: false,
        resize: false,
        content: ts.label,
      });
    });

    isProgrammaticRef.current = false;
  }, [timestamps, isReady]);

  // Sync fade regions
  useEffect(() => {
    const regions = regionsRef.current;
    if (!regions || !isReady) return;

    isProgrammaticRef.current = true;

    // Remove existing fade regions
    regions
      .getRegions()
      .filter((r) => r.id.startsWith('fade-'))
      .forEach((r) => r.remove());

    const { duration } = audioBuffer;

    if (fadeIn > 0) {
      regions.addRegion({
        id: 'fade-in',
        start: 0,
        end: fadeIn,
        color: 'rgba(72, 187, 120, 0.3)',
        drag: false,
        resize: false,
        content: 'Fade In',
      });
    }

    if (fadeOut > 0) {
      regions.addRegion({
        id: 'fade-out',
        start: duration - fadeOut,
        end: duration,
        color: 'rgba(159, 122, 234, 0.3)',
        drag: false,
        resize: false,
        content: 'Fade Out',
      });
    }

    isProgrammaticRef.current = false;
  }, [fadeIn, fadeOut, audioBuffer, isReady]);

  // Update zoom — only after audio is loaded
  useEffect(() => {
    if (wsRef.current && readyRef.current) {
      wsRef.current.zoom(zoom);
    }
  }, [zoom]);

  // Update playhead position during preview
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || !readyRef.current || currentTime === undefined) return;
    const duration = ws.getDuration();
    if (duration > 0) {
      ws.seekTo(Math.min(currentTime / duration, 1));
    }
  }, [currentTime]);

  return (
    <Box
      ref={containerRef}
      w="100%"
      border="1px solid"
      borderColor="gray.200"
      borderRadius="md"
      overflow="auto"
    />
  );
});

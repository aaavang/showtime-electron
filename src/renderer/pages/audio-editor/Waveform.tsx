import React, { useEffect, useRef } from 'react';
import { Box } from '@chakra-ui/react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin, { Region } from 'wavesurfer.js/dist/plugins/regions.js';
import { encodeWav } from '../../utils/encodeWav';

export type WaveformProps = {
  audioBuffer: AudioBuffer;
  startTime: number;
  endTime: number;
  onRegionChange: (start: number, end: number) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  currentTime?: number;
};

export const Waveform = React.memo(function Waveform({
  audioBuffer,
  startTime,
  endTime,
  onRegionChange,
  zoom,
  onZoomChange,
  currentTime,
}: WaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);
  const readyRef = useRef(false);
  const onRegionChangeRef = useRef(onRegionChange);
  onRegionChangeRef.current = onRegionChange;
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

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#4a9eff',
      progressColor: '#4a9eff',
      cursorColor: '#1a365d',
      cursorWidth: 2,
      height: 128,
      interact: false, // disable default click-to-seek so drag works on empty areas
      plugins: [regions],
    });

    // Load audio via blob URL from the AudioBuffer
    const wavData = encodeWav(audioBuffer);
    const blob = new Blob([wavData], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    ws.load(url);

    readyRef.current = false;
    ws.on('ready', () => {
      readyRef.current = true;
      // Apply initial zoom so WaveSurfer matches the slider value
      ws.zoom(zoomRef.current);
    });

    // Allow drag-to-create new regions on the waveform
    regions.enableDragSelection({
      color: 'rgba(74, 158, 255, 0.2)',
    });

    // When a new region is created via drag, remove old ones and notify parent
    regions.on('region-created', (region: Region) => {
      if (isProgrammaticRef.current) return;
      // Ignore zero-length regions (accidental clicks)
      if (Math.abs(region.end - region.start) < 0.01) return;

      // Remove all other regions — keep only the newest
      regions.getRegions().forEach((r) => {
        if (r.id !== region.id) r.remove();
      });
      isUserDraggingRef.current = true;
      onRegionChangeRef.current(region.start, region.end);
      isUserDraggingRef.current = false;
    });

    // When a region is resized/dragged by the user, notify parent
    regions.on('region-updated', (region: Region) => {
      if (isProgrammaticRef.current) return;
      isUserDraggingRef.current = true;
      onRegionChangeRef.current(region.start, region.end);
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

    // Don't create a region until we have a meaningful range
    if (endTime <= startTime) return;

    const existing = regions.getRegions();
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
  }, [startTime, endTime]);

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

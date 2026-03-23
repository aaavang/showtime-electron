export async function renderOfflineAudio(params: {
  sourceBuffer: AudioBuffer;
  startTime: number;
  endTime: number;
  playbackRate: number;
  fadeIn?: number;
  fadeOut?: number;
}): Promise<AudioBuffer> {
  const {
    sourceBuffer,
    startTime,
    endTime,
    playbackRate,
    fadeIn = 0,
    fadeOut = 0,
  } = params;
  const regionDuration = endTime - startTime;

  if (
    regionDuration <= 0 ||
    !Number.isFinite(regionDuration) ||
    !Number.isFinite(playbackRate) ||
    playbackRate <= 0
  ) {
    throw new Error(
      `Invalid params: start=${startTime}, end=${endTime}, rate=${playbackRate}`,
    );
  }

  const outputDuration = regionDuration / playbackRate;
  const outputLength = Math.ceil(outputDuration * sourceBuffer.sampleRate);

  // Guard against unreasonably large buffers (>10 min)
  const maxLength = 10 * 60 * sourceBuffer.sampleRate;
  if (outputLength > maxLength || outputLength <= 0) {
    throw new Error(
      `Output too large: ${Math.round(outputDuration)}s (${outputLength} samples). ` +
        `Region: ${regionDuration.toFixed(1)}s, rate: ${playbackRate}x. ` +
        `Trim the selection or increase speed.`,
    );
  }

  const offlineCtx = new OfflineAudioContext(
    sourceBuffer.numberOfChannels,
    outputLength,
    sourceBuffer.sampleRate,
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = sourceBuffer;
  source.playbackRate.value = playbackRate;

  // Apply fade in/out via a GainNode
  // fadeIn/fadeOut are in source time — convert to output time
  const fadeInOutput = fadeIn / playbackRate;
  const fadeOutOutput = fadeOut / playbackRate;

  if (fadeInOutput > 0 || fadeOutOutput > 0) {
    const gain = offlineCtx.createGain();
    source.connect(gain);
    gain.connect(offlineCtx.destination);

    const fadeOutStart = outputDuration - fadeOutOutput;

    if (fadeInOutput > 0 && fadeOutOutput > 0) {
      // Both fades: start at 0, ramp up, hold at 1, ramp down
      gain.gain.setValueAtTime(0, 0);
      gain.gain.linearRampToValueAtTime(1, fadeInOutput);
      // linearRampToValueAtTime targets from the previous event,
      // so schedule a ramp to 1 at fadeOutStart to hold the value,
      // then ramp down to 0
      gain.gain.linearRampToValueAtTime(
        1,
        Math.max(fadeOutStart, fadeInOutput),
      );
      gain.gain.linearRampToValueAtTime(0, outputDuration);
    } else if (fadeInOutput > 0) {
      gain.gain.setValueAtTime(0, 0);
      gain.gain.linearRampToValueAtTime(1, fadeInOutput);
    } else {
      gain.gain.setValueAtTime(1, fadeOutStart);
      gain.gain.linearRampToValueAtTime(0, outputDuration);
    }
  } else {
    source.connect(offlineCtx.destination);
  }

  source.start(0, startTime, regionDuration);

  return offlineCtx.startRendering();
}

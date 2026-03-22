export async function renderOfflineAudio(params: {
  sourceBuffer: AudioBuffer;
  startTime: number;
  endTime: number;
  playbackRate: number;
}): Promise<AudioBuffer> {
  const { sourceBuffer, startTime, endTime, playbackRate } = params;
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
  source.connect(offlineCtx.destination);
  source.start(0, startTime, regionDuration);

  return offlineCtx.startRendering();
}

import {Button, HStack, Kbd, Progress, Text, Tooltip, useToast, VStack} from '@chakra-ui/react';
import {useState} from 'react';
import {useAudio, useInterval, useKeyPressEvent} from 'react-use';

export const AudioPlayer = (props: any) => {
  const toast = useToast();
  const [isFading, setIsFading] = useState(false);
  const [audio, state, controls, ref] = useAudio({
    src: props.src,
    autoPlay: props.autoPlay ?? false,
    onEnded: props.onEnd
  });

  const handlePlayPause = () => {
    // blur play-pause button
    document.getElementById('play-pause-button')?.blur();
    if (state.playing && !state.paused) {
      controls.pause();
    } else {
      controls.volume(1);
      controls.play();
    }
  };

  useKeyPressEvent(' ', handlePlayPause);

  useInterval(() => {
      if (state.volume <= 0) {
        toast({
          title: 'Faded out and moving on!',
          status: 'success',
          duration: 2000,
          isClosable: true
        });
        controls.pause();
        setIsFading(false);
        props.onEnd();
        controls.volume(1);
      } else if(state.playing && !state.paused) {
        controls.volume(parseFloat(Math.max(0, state.volume - 0.1).toFixed(1)));
      }
    },
    isFading ? 250 : null
  );

  const formatSecondsToLabel = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  const handleRestart = () => {
    if (state.playing) {
      toast({
        title: 'Cannot restart while playing',
        status: 'warning',
        duration: 2000,
        isClosable: true
      });
    } else {
      toast({
        title: 'Restarting',
        status: 'info',
        duration: 2000,
        isClosable: true
      });
      controls.seek(0);
    }
    // blur reset button
    document.getElementById('reset-button')?.blur();
  };

  const handleFade = () => {
    toast({
      title: 'Fading out',
      status: 'info',
      duration: 2000,
      isClosable: true
    });
    setIsFading(true);

    // blur fade button
    document.getElementById('fade-button')?.blur();
  };

  const handleReload = () => {
    toast({
      title: 'Reloading audio',
      status: 'info',
      duration: 2000,
      isClosable: true
    });
    ref.current?.load();
    ref.current?.blur();
  }

  return (
    <VStack w={'100%'}>
      {audio}
      <pre>{formatSecondsToLabel(state.time)}/{formatSecondsToLabel(state.duration)}</pre>
      <Progress hasStripe value={(state.time / state.duration) * 100} w={'100%'} />
      <HStack w={'100%'} justifyContent={'space-between'}>
        <Button id={'play-pause-button'} onClick={handlePlayPause}
                color={'green'}>{state.playing && !state.paused ? 'Pause' : 'Play'}</Button>
        <Button id={'fade-button'} onClick={handleFade} color={'blue'} isDisabled={!state.playing || state.paused}>Fade out (2.5
          secs)</Button>
        <Button id={'reset-button'} onClick={handleRestart} color={'red'} variant={'outline'}
                isDisabled={state.playing || state.time == 0}>Restart</Button>
        <Tooltip label='In case of emergencies...' openDelay={250}>
          <Button id={'reload-button'} onClick={handleReload} color={'red'} variant={'outline'}
                  isDisabled={state.playing}>Reload</Button>
        </Tooltip>
      </HStack>
      <Text>Press <Kbd>Space</Kbd> to Play/Pause</Text>
    </VStack>
  );
};

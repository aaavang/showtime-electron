import '@testing-library/jest-dom';
import React from 'react';
import { render, act } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { DebouncedInput } from '../renderer/common/Filter';

const renderInput = (
  props: Partial<React.ComponentProps<typeof DebouncedInput>>,
) =>
  render(
    <ChakraProvider>
      <DebouncedInput value="" onChange={() => {}} {...props} />
    </ChakraProvider>,
  );

describe('DebouncedInput', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('does not re-fire the debounce when only the onChange identity changes', () => {
    // Callers routinely pass an inline onChange (new identity every render).
    // Re-rendering with a fresh onChange but the SAME value must not re-arm
    // the debounce timer — otherwise the callback fires on every parent
    // render, driving an infinite render loop.
    const firstOnChange = jest.fn();
    const { rerender } = renderInput({ value: 'hi', onChange: firstOnChange });

    // Mount debounce settles once with the initial value.
    act(() => jest.advanceTimersByTime(200));
    firstOnChange.mockClear();

    const secondOnChange = jest.fn();
    rerender(
      <ChakraProvider>
        <DebouncedInput value="hi" onChange={secondOnChange} />
      </ChakraProvider>,
    );
    act(() => jest.advanceTimersByTime(200));

    expect(secondOnChange).not.toHaveBeenCalled();
  });
});

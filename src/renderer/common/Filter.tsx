import { Input, InputProps } from '@chakra-ui/react';
import { Column } from '@tanstack/react-table';
import { useEffect, useRef, useState } from 'react';

export function Filter({ column }: { column: Column<any, unknown> }) {
  const columnFilterValue = column.getFilterValue();

  return (
    <DebouncedInput
      type="text"
      value={(columnFilterValue ?? '') as string}
      onChange={(value) => column.setFilterValue(value)}
      placeholder="Search..."
    />
  );
}

export function DebouncedInput({
  value: initialValue,
  onChange,
  debounce = 200,
  ...props
}: {
  value: string | number;
  onChange: (value: string | number) => void;
  debounce?: number;
} & InputProps) {
  const [value, setValue] = useState(initialValue);

  // Keep the latest onChange in a ref so the debounce effect below does not
  // depend on its identity. Callers routinely pass an inline onChange (a new
  // function every render); depending on it would re-arm the timer on every
  // parent render, and since onChange typically writes state that triggers a
  // re-render, that becomes an infinite render loop.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      onChangeRef.current(value);
    }, debounce);

    return () => clearTimeout(timeout);
  }, [value, debounce]);

  return (
    <Input
      {...props}
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}

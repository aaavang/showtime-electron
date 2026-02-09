import {
  Button,
  Center,
  Divider,
  HStack,
  Input,
  Select,
  Text,
} from '@chakra-ui/react';
import { Table as ReactTable } from '@tanstack/react-table';

export function TableControls<T>({ table }: { table: ReactTable<T> }) {
  return (
    <HStack gap="15px" justifyContent="center" py={3} flexShrink={0}>
      <Button
        onClick={() => table.setPageIndex(0)}
        isDisabled={!table.getCanPreviousPage()}
      >
        {'<<'}
      </Button>
      <Button
        onClick={() => table.previousPage()}
        isDisabled={!table.getCanPreviousPage()}
      >
        {'<'}
      </Button>
      <Button
        onClick={() => table.nextPage()}
        isDisabled={!table.getCanNextPage()}
      >
        {'>'}
      </Button>
      <Button
        onClick={() => table.setPageIndex(table.getPageCount() - 1)}
        isDisabled={!table.getCanNextPage()}
      >
        {'>>'}
      </Button>
      <Center gap="5px">
        <Text>Page</Text>
        <strong>
          {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </strong>
      </Center>
      <Center height="20px">
        <Divider orientation="vertical" />
      </Center>
      <Center gap="5px">
        Go to page:
        <Input
          width="100px"
          type="number"
          defaultValue={table.getState().pagination.pageIndex + 1}
          onChange={(e) => {
            const page = e.target.value ? Number(e.target.value) - 1 : 0;
            if (page >= 0 && page < table.getPageCount())
              table.setPageIndex(page);
          }}
        />
      </Center>
      <Select
        width="150px"
        value={table.getState().pagination.pageSize}
        onChange={(e) => {
          table.setPageSize(Number(e.target.value));
        }}
      >
        {[10, 20, 30, 40, 50].map((pageSize) => (
          <option key={pageSize} value={pageSize}>
            Show {pageSize}
          </option>
        ))}
      </Select>
    </HStack>
  );
}

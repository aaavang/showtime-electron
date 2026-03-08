import {
  Box,
  Button,
  Code,
  HStack,
  Table,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tr,
  VStack,
} from '@chakra-ui/react';
import React, { useState } from 'react';
import { Page } from '../common/Page';
import { database } from '../database';

type QueryResult = {
  columns: string[];
  rows: Record<string, unknown>[];
  duration: number;
  error?: string;
};

const TABLE_NAMES = [
  'songs',
  'dances',
  'danceVariants',
  'playlists',
  'playlistDances',
] as const;

type TableName = (typeof TABLE_NAMES)[number];

function getTable(name: string) {
  const normalized = name.toLowerCase();
  const mapping: Record<string, TableName> = {
    songs: 'songs',
    dances: 'dances',
    dancevariants: 'danceVariants',
    dance_variants: 'danceVariants',
    playlists: 'playlists',
    playlistdances: 'playlistDances',
    playlist_dances: 'playlistDances',
  };
  const tableName = mapping[normalized];
  if (!tableName) return null;
  return database[tableName];
}

function parseQuery(sql: string): {
  tableName: string;
  columns: string[] | '*';
  where: ((row: Record<string, unknown>) => boolean) | null;
  orderBy: { column: string; desc: boolean } | null;
  limit: number | null;
} {
  const trimmed = sql.trim().replace(/;$/, '');

  const selectMatch = trimmed.match(
    /^SELECT\s+(.+?)\s+FROM\s+(\w+)(.*)/i,
  );
  if (!selectMatch) {
    throw new Error(
      'Unsupported syntax. Use: SELECT * FROM table [WHERE ...] [ORDER BY ...] [LIMIT n]',
    );
  }

  const columnsRaw = selectMatch[1].trim();
  const tableName = selectMatch[2].trim();
  let rest = selectMatch[3].trim();

  const columns: string[] | '*' =
    columnsRaw === '*'
      ? '*'
      : columnsRaw.split(',').map((c) => c.trim());

  // Parse LIMIT (extract first so it doesn't interfere with ORDER BY parsing)
  let limit: number | null = null;
  const limitMatch = rest.match(/\bLIMIT\s+(\d+)/i);
  if (limitMatch) {
    limit = parseInt(limitMatch[1], 10);
    rest = rest.replace(limitMatch[0], '').trim();
  }

  // Parse ORDER BY
  let orderBy: { column: string; desc: boolean } | null = null;
  const orderMatch = rest.match(
    /\bORDER\s+BY\s+(\w+)(\s+(ASC|DESC))?/i,
  );
  if (orderMatch) {
    orderBy = {
      column: orderMatch[1],
      desc: orderMatch[3]?.toUpperCase() === 'DESC',
    };
    rest = rest.replace(orderMatch[0], '').trim();
  }

  // Parse WHERE
  let where: ((row: Record<string, unknown>) => boolean) | null = null;
  const whereMatch = rest.match(/\bWHERE\s+(.*)/i);
  if (whereMatch) {
    where = parseWhereClause(whereMatch[1].trim());
  }

  return { tableName, columns, where, orderBy, limit };
}

function parseWhereClause(
  clause: string,
): (row: Record<string, unknown>) => boolean {
  // Support AND/OR chains
  const orParts = clause.split(/\s+OR\s+/i);

  const orPredicates = orParts.map((orPart) => {
    const andParts = orPart.split(/\s+AND\s+/i);
    const andPredicates = andParts.map((part) => parseSingleCondition(part.trim()));
    return (row: Record<string, unknown>) =>
      andPredicates.every((pred) => pred(row));
  });

  return (row: Record<string, unknown>) =>
    orPredicates.some((pred) => pred(row));
}

function parseSingleCondition(
  condition: string,
): (row: Record<string, unknown>) => boolean {
  // LIKE
  const likeMatch = condition.match(/^(\w+)\s+LIKE\s+'(.*)'/i);
  if (likeMatch) {
    const col = likeMatch[1];
    const pattern = likeMatch[2]
      .replace(/%/g, '.*')
      .replace(/_/g, '.');
    const regex = new RegExp(`^${pattern}$`, 'i');
    return (row) => regex.test(String(row[col] ?? ''));
  }

  // NOT LIKE
  const notLikeMatch = condition.match(/^(\w+)\s+NOT\s+LIKE\s+'(.*)'/i);
  if (notLikeMatch) {
    const col = notLikeMatch[1];
    const pattern = notLikeMatch[2]
      .replace(/%/g, '.*')
      .replace(/_/g, '.');
    const regex = new RegExp(`^${pattern}$`, 'i');
    return (row) => !regex.test(String(row[col] ?? ''));
  }

  // IS NULL / IS NOT NULL
  const isNullMatch = condition.match(/^(\w+)\s+IS\s+(NOT\s+)?NULL/i);
  if (isNullMatch) {
    const col = isNullMatch[1];
    const isNot = !!isNullMatch[2];
    return (row) =>
      isNot
        ? row[col] !== null && row[col] !== undefined
        : row[col] === null || row[col] === undefined;
  }

  // Comparison operators: !=, >=, <=, >, <, =
  const compMatch = condition.match(
    /^(\w+)\s*(!=|>=|<=|>|<|=)\s*('.*?'|\d+(\.\d+)?|true|false)/i,
  );
  if (compMatch) {
    const col = compMatch[1];
    const op = compMatch[2];
    let val: unknown = compMatch[3];

    // Parse value type
    if (
      typeof val === 'string' &&
      val.startsWith("'") &&
      val.endsWith("'")
    ) {
      val = (val as string).slice(1, -1);
    } else if (val === 'true') {
      val = true;
    } else if (val === 'false') {
      val = false;
    } else {
      val = Number(val);
    }

    return (row) => {
      const rowVal = row[col];
      switch (op) {
        case '=':
          return rowVal === val;
        case '!=':
          return rowVal !== val;
        case '>':
          return (rowVal as number) > (val as number);
        case '<':
          return (rowVal as number) < (val as number);
        case '>=':
          return (rowVal as number) >= (val as number);
        case '<=':
          return (rowVal as number) <= (val as number);
        default:
          return false;
      }
    };
  }

  throw new Error(`Cannot parse condition: "${condition}"`);
}

function parseUpdateQuery(sql: string): {
  tableName: string;
  sets: Record<string, unknown>;
  where: ((row: Record<string, unknown>) => boolean) | null;
} {
  const trimmed = sql.trim().replace(/;$/, '');

  const updateMatch = trimmed.match(
    /^UPDATE\s+(\w+)\s+SET\s+(.+?)(\s+WHERE\s+(.+))?$/i,
  );
  if (!updateMatch) {
    throw new Error(
      'Unsupported UPDATE syntax. Use: UPDATE table SET col = val [WHERE ...]',
    );
  }

  const tableName = updateMatch[1];
  const setsRaw = updateMatch[2];
  const whereRaw = updateMatch[4] || null;

  // Parse SET assignments
  const sets: Record<string, unknown> = {};
  // Split on commas not inside quotes
  const assignments = setsRaw.match(/\w+\s*=\s*(?:'[^']*'|\S+)/g);
  if (!assignments) {
    throw new Error('Cannot parse SET clause');
  }
  for (const assignment of assignments) {
    const eqMatch = assignment.match(/^(\w+)\s*=\s*('.*?'|\d+(\.\d+)?|true|false)$/i);
    if (!eqMatch) {
      throw new Error(`Cannot parse assignment: "${assignment}"`);
    }
    const col = eqMatch[1];
    let val: unknown = eqMatch[2];
    if (typeof val === 'string' && val.startsWith("'") && val.endsWith("'")) {
      val = (val as string).slice(1, -1);
    } else if (val === 'true') {
      val = true;
    } else if (val === 'false') {
      val = false;
    } else {
      val = Number(val);
    }
    sets[col] = val;
  }

  const where = whereRaw ? parseWhereClause(whereRaw) : null;

  return { tableName, sets, where };
}

function parseDeleteQuery(sql: string): {
  tableName: string;
  where: ((row: Record<string, unknown>) => boolean) | null;
} {
  const trimmed = sql.trim().replace(/;$/, '');

  const deleteMatch = trimmed.match(
    /^DELETE\s+FROM\s+(\w+)(\s+WHERE\s+(.+))?$/i,
  );
  if (!deleteMatch) {
    throw new Error(
      'Unsupported DELETE syntax. Use: DELETE FROM table [WHERE ...]',
    );
  }

  const tableName = deleteMatch[1];
  const whereRaw = deleteMatch[3] || null;
  const where = whereRaw ? parseWhereClause(whereRaw) : null;

  return { tableName, where };
}

async function executeQuery(sql: string): Promise<QueryResult> {
  const start = performance.now();
  try {
    const trimmed = sql.trim().replace(/;$/, '');
    const command = trimmed.split(/\s+/)[0].toUpperCase();

    if (command === 'UPDATE') {
      return await executeUpdate(sql, start);
    }
    if (command === 'DELETE') {
      return await executeDelete(sql, start);
    }
    if (command !== 'SELECT') {
      throw new Error('Supported commands: SELECT, UPDATE, DELETE');
    }

    const { tableName, columns, where, orderBy, limit } =
      parseQuery(sql);

    const table = getTable(tableName);
    if (!table) {
      throw new Error(
        `Unknown table "${tableName}". Available: ${TABLE_NAMES.join(', ')}`,
      );
    }

    let rows = (await table.toArray()) as Record<string, unknown>[];

    if (where) {
      rows = rows.filter(where);
    }

    if (orderBy) {
      rows.sort((a, b) => {
        const aVal = a[orderBy.column];
        const bVal = b[orderBy.column];
        if (aVal === bVal) return 0;
        const cmp = aVal! < bVal! ? -1 : 1;
        return orderBy.desc ? -cmp : cmp;
      });
    }

    if (limit !== null) {
      rows = rows.slice(0, limit);
    }

    // Project columns
    let resultColumns: string[];
    if (columns === '*') {
      resultColumns =
        rows.length > 0 ? Object.keys(rows[0]) : ['(no results)'];
    } else {
      resultColumns = columns;
      rows = rows.map((row) => {
        const projected: Record<string, unknown> = {};
        for (const col of columns) {
          projected[col] = row[col];
        }
        return projected;
      });
    }

    const duration = performance.now() - start;
    return { columns: resultColumns, rows, duration };
  } catch (e: any) {
    const duration = performance.now() - start;
    return { columns: [], rows: [], duration, error: e.message };
  }
}

async function executeUpdate(
  sql: string,
  start: number,
): Promise<QueryResult> {
  const { tableName, sets, where } = parseUpdateQuery(sql);

  const table = getTable(tableName);
  if (!table) {
    throw new Error(
      `Unknown table "${tableName}". Available: ${TABLE_NAMES.join(', ')}`,
    );
  }

  let rows = (await table.toArray()) as Record<string, unknown>[];
  if (where) {
    rows = rows.filter(where);
  }

  const ids = rows.map((r) => r.id);
  let updatedCount = 0;
  for (const id of ids) {
    await (table as any).update(id, sets);
    updatedCount++;
  }

  const duration = performance.now() - start;
  return {
    columns: ['result'],
    rows: [{ result: `${updatedCount} row${updatedCount !== 1 ? 's' : ''} updated` }],
    duration,
  };
}

async function executeDelete(
  sql: string,
  start: number,
): Promise<QueryResult> {
  const { tableName, where } = parseDeleteQuery(sql);

  const table = getTable(tableName);
  if (!table) {
    throw new Error(
      `Unknown table "${tableName}". Available: ${TABLE_NAMES.join(', ')}`,
    );
  }

  let rows = (await table.toArray()) as Record<string, unknown>[];
  if (where) {
    rows = rows.filter(where);
  }

  const ids = rows.map((r) => r.id);
  await table.bulkDelete(ids as any);

  const duration = performance.now() - start;
  return {
    columns: ['result'],
    rows: [{ result: `${ids.length} row${ids.length !== 1 ? 's' : ''} deleted` }],
    duration,
  };
}

const EXAMPLE_QUERIES = [
  'SELECT * FROM songs',
  'SELECT * FROM dances ORDER BY title',
  "SELECT * FROM songs WHERE title LIKE '%waltz%'",
  'SELECT * FROM danceVariants WHERE danceId = 1',
  'SELECT title, path FROM songs LIMIT 5',
  'SELECT * FROM danceVariants WHERE defaultVariant = true',
  "UPDATE dances SET title = 'New Name' WHERE id = 1",
  'DELETE FROM songs WHERE id = 1',
];

export function QueryConsole() {
  const [query, setQuery] = useState('SELECT * FROM songs');
  const [result, setResult] = useState<QueryResult | null>(null);

  const runQuery = async () => {
    const res = await executeQuery(query);
    setResult(res);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      runQuery();
    }
  };

  return (
    <Page name="Query Console">
      <VStack height="100%" spacing={3} align="stretch">
        <Box flexShrink={0}>
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            fontFamily="mono"
            fontSize="sm"
            rows={3}
            placeholder="SELECT * FROM songs WHERE title LIKE '%waltz%'"
          />
          <HStack mt={2} justifyContent="space-between">
            <Button colorScheme="blue" onClick={runQuery}>
              Run Query
            </Button>
            <Text fontSize="xs" color="gray.500">
              Cmd+Enter to run
            </Text>
          </HStack>
        </Box>

        {result?.error && (
          <Box p={3} bg="red.50" borderRadius="md" flexShrink={0}>
            <Text color="red.600" fontSize="sm" fontFamily="mono">
              {result.error}
            </Text>
          </Box>
        )}

        {result && !result.error && (
          <>
            <Text fontSize="xs" color="gray.500" flexShrink={0}>
              {result.rows.length} row{result.rows.length !== 1 ? 's' : ''} in{' '}
              {result.duration.toFixed(1)}ms
            </Text>
            <Box flex={1} overflowY="auto" width="100%">
              <Table variant="simple" size="sm" width="100%">
                <Thead position="sticky" top={0} zIndex={1} bg="chakra-body-bg">
                  <Tr>
                    {result.columns.map((col) => (
                      <Th key={col}>{col}</Th>
                    ))}
                  </Tr>
                </Thead>
                <Tbody>
                  {result.rows.map((row, i) => (
                    <Tr key={i}>
                      {result.columns.map((col) => (
                        <Td key={col} fontFamily="mono" fontSize="xs">
                          {formatValue(row[col])}
                        </Td>
                      ))}
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          </>
        )}

        {!result && (
          <Box flexShrink={0}>
            <Text fontSize="sm" mb={2} fontWeight="bold">
              Examples:
            </Text>
            <VStack align="stretch" spacing={1}>
              {EXAMPLE_QUERIES.map((q) => (
                <Code
                  key={q}
                  p={2}
                  fontSize="xs"
                  cursor="pointer"
                  _hover={{ bg: 'blue.50' }}
                  onClick={() => setQuery(q)}
                >
                  {q}
                </Code>
              ))}
            </VStack>
          </Box>
        )}
      </VStack>
    </Page>
  );
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'string' && val.length > 80) return `${val.slice(0, 80)}...`;
  return String(val);
}

import { Box, Link, Tab, TabList, Tabs } from '@chakra-ui/react';
import React from 'react';
import { Link as ReactRouterLink, useLocation } from 'react-router-dom';

export function GlobalNav() {
  const location = useLocation();
  const { pathname } = location;

  const pathBase =
    pathname.split('/').length === 1 ? '/' : pathname.split('/')[1];

  let index;
  switch (pathBase) {
    case '/':
      index = 0;
      break;
    case 'dances':
      index = 1;
      break;
    case 'songs':
      index = 2;
      break;
    case 'playlists':
      index = 3;
      break;
    case 'settings':
      index = 4;
      break;
    default:
      index = 0;
  }

  return (
    <Box>
      <Tabs variant="enclosed" defaultIndex={index}>
        <TabList>
          <Link as={ReactRouterLink} to="/">
            <Tab>Showtime</Tab>
          </Link>
          <Link as={ReactRouterLink} to="/dances">
            <Tab>Dances</Tab>
          </Link>
          <Link as={ReactRouterLink} to="/songs">
            <Tab>Songs</Tab>
          </Link>
          <Link as={ReactRouterLink} to="/playlists">
            <Tab>Playlists</Tab>
          </Link>
          <Link as={ReactRouterLink} to="/settings">
            <Tab>Settings</Tab>
          </Link>
        </TabList>
      </Tabs>
    </Box>
  );
}

import { ChakraProvider, ColorModeScript } from '@chakra-ui/react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { JukeboxProvider } from './providers/JukeboxProvider';
import { UserSettingsProvider } from './providers/UserSettingsProvider';
import theme from './theme';

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);
root.render(
  <ChakraProvider>
    <JukeboxProvider>
      <UserSettingsProvider>
        <ColorModeScript initialColorMode={theme.config.initialColorMode} />
        <App />
      </UserSettingsProvider>
    </JukeboxProvider>
  </ChakraProvider>,
);

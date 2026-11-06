import '@weasel-js/labkit/styles.css';
import '../renamed-storage.js';
import { IconRegistryProvider } from '@weasel-js/core';
import { kitIcons } from '@weasel-js/ui/kit-icons';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <IconRegistryProvider icons={kitIcons}>
      <App />
    </IconRegistryProvider>
  </StrictMode>,
);

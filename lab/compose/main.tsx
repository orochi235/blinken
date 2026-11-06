import '@weasel-js/labkit/styles.css';
import '../renamed-storage.js';
import { mount } from '@msb235/blits-panel';
import { IconRegistryProvider } from '@weasel-js/core';
import { kitIcons } from '@weasel-js/ui/kit-icons';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';

if (import.meta.env.DEV && !new URLSearchParams(location.search).has('nopanel')) mount();

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <IconRegistryProvider icons={kitIcons}>
      <App />
    </IconRegistryProvider>
  </StrictMode>,
);

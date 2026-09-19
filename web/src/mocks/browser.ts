/**
 * MSW browser worker. OWNER: M1. Started from main.tsx when
 * VITE_USE_MOCKS === 'true' (mocks/README.md).
 */
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers.js';

export const worker = setupWorker(...handlers);

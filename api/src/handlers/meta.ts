import { readFileSync } from 'node:fs';
import type { MetaCategoriesResponse } from '@dse/shared';
import type { Handler } from '../router.js';

const meta = JSON.parse(
  readFileSync(new URL('../../../fixtures/meta-categories.json', import.meta.url), 'utf8'),
) as MetaCategoriesResponse;

export const getCategories: Handler = () => ({
  status: 200,
  body: structuredClone(meta),
});

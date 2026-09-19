import { readFileSync, existsSync } from 'node:fs';
import type { MetaCategoriesResponse } from '@dse/shared';
import type { Handler } from '../router.js';

function getFixturePath(fileName: string): URL {
  const localUrl = new URL(`../../../fixtures/${fileName}`, import.meta.url);
  if (existsSync(localUrl)) return localUrl;
  const bundleUrl = new URL(`./fixtures/${fileName}`, import.meta.url);
  if (existsSync(bundleUrl)) return bundleUrl;
  return localUrl;
}

const meta = JSON.parse(
  readFileSync(getFixturePath('meta-categories.json'), 'utf8'),
) as MetaCategoriesResponse;

export const getCategories: Handler = () => ({
  status: 200,
  body: structuredClone(meta),
});

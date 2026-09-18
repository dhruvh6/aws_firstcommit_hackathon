import type { Repo } from './index.js';
import { createMemoryRepo } from './memory.js';

let configuredRepo: Repo | undefined;

/**
 * Local development defaults to fixtures in memory. The Lambda bootstrap can
 * inject M3's DynamoDB implementation without changing any handler.
 */
export function getRepo(): Repo {
  configuredRepo ??= createMemoryRepo();
  return configuredRepo;
}

export function configureRepo(repo: Repo): void {
  configuredRepo = repo;
}

export function resetRepo(): void {
  configuredRepo = undefined;
}

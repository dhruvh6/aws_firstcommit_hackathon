import type { Repo } from './index.js';
import { createMemoryRepo } from './memory.js';
import { createDynamoRepo } from './dynamo.js';

let configuredRepo: Repo | undefined;

/**
 * Selected at runtime by REPO_DRIVER ('memory' | 'dynamo').
 * Local dev defaults to fixtures in memory.
 * Deployed Lambda uses DynamoDB.
 */
export function getRepo(): Repo {
  if (!configuredRepo) {
    const driver = process.env.REPO_DRIVER ?? (process.env.AWS_LAMBDA_FUNCTION_NAME ? 'dynamo' : 'memory');
    configuredRepo = driver === 'dynamo' ? createDynamoRepo() : createMemoryRepo();
  }
  return configuredRepo;
}

export function configureRepo(repo: Repo): void {
  configuredRepo = repo;
}

export function resetRepo(): void {
  configuredRepo = undefined;
}

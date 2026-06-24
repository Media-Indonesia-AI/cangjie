import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface CangjieConfig {
  /** username OR email (the "identifier" the API accepts) */
  identifier?: string;
  /** password */
  password?: string;
  /** pre-encoded `identifier:password` (overrides identifier/password) */
  basicAuth?: string;
  /** API base URL (host root; paths include /v1) */
  baseUrl?: string;
}

export const DEFAULT_BASE_URL = 'http://localhost:3000';
const CONFIG_PATH = join(homedir(), '.cangjie.json');

export function loadConfig(): CangjieConfig {
  let fileConfig: CangjieConfig = {};
  if (existsSync(CONFIG_PATH)) {
    try {
      const raw = readFileSync(CONFIG_PATH, 'utf8');
      fileConfig = JSON.parse(raw) as CangjieConfig;
    } catch (err) {
      throw new Error(
        `Failed to parse ${CONFIG_PATH}: ${(err as Error).message}`,
      );
    }
  }

  return {
    identifier: process.env.CANGJIE_IDENTIFIER ?? fileConfig.identifier,
    password: process.env.CANGJIE_PASSWORD ?? fileConfig.password,
    basicAuth:
      process.env.CANGJIE_BASIC_AUTH ?? fileConfig.basicAuth,
    baseUrl:
      process.env.CANGJIE_BASE_URL ?? fileConfig.baseUrl ?? DEFAULT_BASE_URL,
  };
}

export function resolveBaseUrl(override?: string): string {
  const url = override ?? loadConfig().baseUrl ?? DEFAULT_BASE_URL;
  return url.replace(/\/+$/, '');
}

export function resolveBasicAuth(
  override?: string,
  identifierOverride?: string,
  passwordOverride?: string,
): string | undefined {
  if (override) return override;
  if (identifierOverride && passwordOverride) {
    return `${identifierOverride}:${passwordOverride}`;
  }
  const cfg = loadConfig();
  if (cfg.basicAuth) return cfg.basicAuth;
  if (cfg.identifier && cfg.password) return `${cfg.identifier}:${cfg.password}`;
  if (cfg.identifier) return cfg.identifier;
  return undefined;
}
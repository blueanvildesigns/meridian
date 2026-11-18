// Mirrors the parts of Firebase Hosting's config semantics that Meridian uses, so the
// production build can be served locally (and in e2e) with the real headers and rewrites.
// Reference: https://firebase.google.com/docs/hosting/full-config
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export interface HeaderRule {
  source?: string;
  regex?: string;
  headers: { key: string; value: string }[];
}

export interface HostingConfig {
  public: string;
  rewrites?: { source: string; destination: string }[];
  headers?: HeaderRule[];
}

export const FIREBASE_JSON = fileURLToPath(new URL('../../firebase.json', import.meta.url));

export function loadHosting(path = FIREBASE_JSON): HostingConfig {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as { hosting: HostingConfig };
  return parsed.hosting;
}

/** Converts the glob subset we use (`**`, `*`, `?`, literals) to an anchored RegExp. */
export function globToRegExp(glob: string): RegExp {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i] as string;
    if (ch === '*' && glob[i + 1] === '*') {
      out += '.*';
      i++;
    } else if (ch === '*') {
      out += '[^/]*';
    } else if (ch === '?') {
      out += '[^/]';
    } else {
      out += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${out}$`);
}

export function ruleMatches(rule: { source?: string; regex?: string }, path: string): boolean {
  if (rule.regex !== undefined) return new RegExp(rule.regex).test(path);
  if (rule.source !== undefined) return globToRegExp(rule.source).test(path);
  return false;
}

/**
 * Headers for a request path (matched before rewrites, as Firebase does).
 * Firebase does not document which rule wins when two set the same key, so we forbid it.
 */
export function headersFor(config: HostingConfig, path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rule of config.headers ?? []) {
    if (!ruleMatches(rule, path)) continue;
    for (const { key, value } of rule.headers) {
      const k = key.toLowerCase();
      if (k in out) {
        throw new Error(`firebase.json: two header rules set "${key}" for ${path}`);
      }
      out[k] = value;
    }
  }
  return out;
}

export function rewriteFor(config: HostingConfig, path: string): string | undefined {
  return config.rewrites?.find((r) => ruleMatches(r, path))?.destination;
}

export function cspDirectives(config: HostingConfig): Map<string, string[]> {
  const csp = headersFor(config, '/')['content-security-policy'] ?? '';
  const map = new Map<string, string[]>();
  for (const part of csp.split(';')) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) map.set(name, values);
  }
  return map;
}

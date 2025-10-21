// API versioning middleware with semantic version headers
import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * API version information following Semantic Versioning 2.0.0
 * @see https://semver.org/
 */
export const API_VERSION = {
  major: 1,
  minor: 1,
  patch: 0,
  full: '1.1.0',
  releaseDate: '2025-10-21',
  stability: 'stable' as const, // 'alpha' | 'beta' | 'rc' | 'stable'
};

/**
 * Minimum supported client version
 * Clients below this version should upgrade
 */
export const MIN_SUPPORTED_VERSION = '1.0.0';

/**
 * Deprecated versions that will be removed soon
 */
export const DEPRECATED_VERSIONS = ['1.0.0'];

/**
 * Version header names
 */
export const VERSION_HEADERS = {
  API_VERSION: 'X-API-Version',
  MIN_VERSION: 'X-API-Min-Version',
  DEPRECATION: 'X-API-Deprecation',
  SUNSET: 'X-API-Sunset', // ISO 8601 date when version will be removed
  CHANGELOG: 'X-API-Changelog',
} as const;

/**
 * Parse version string to components
 */
export function parseVersion(version: string): { major: number; minor: number; patch: number } | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;

  return {
    major: parseInt(match[1]),
    minor: parseInt(match[2]),
    patch: parseInt(match[3]),
  };
}

/**
 * Compare two semantic versions
 * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
  const parsed1 = parseVersion(v1);
  const parsed2 = parseVersion(v2);

  if (!parsed1 || !parsed2) {
    throw new Error('Invalid version format');
  }

  if (parsed1.major !== parsed2.major) {
    return parsed1.major > parsed2.major ? 1 : -1;
  }

  if (parsed1.minor !== parsed2.minor) {
    return parsed1.minor > parsed2.minor ? 1 : -1;
  }

  if (parsed1.patch !== parsed2.patch) {
    return parsed1.patch > parsed2.patch ? 1 : -1;
  }

  return 0;
}

/**
 * Check if a version is deprecated
 */
export function isVersionDeprecated(version: string): boolean {
  return DEPRECATED_VERSIONS.includes(version);
}

/**
 * Check if client version is supported
 */
export function isVersionSupported(clientVersion: string): boolean {
  try {
    return compareVersions(clientVersion, MIN_SUPPORTED_VERSION) >= 0;
  } catch {
    return false;
  }
}

/**
 * Versioning middleware - adds version headers to all responses
 */
export async function versioningMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Set API version headers
  reply.header(VERSION_HEADERS.API_VERSION, API_VERSION.full);
  reply.header(VERSION_HEADERS.MIN_VERSION, MIN_SUPPORTED_VERSION);
  reply.header(VERSION_HEADERS.CHANGELOG, 'https://github.com/MerlijnW70/zodforge-api/blob/main/CHANGELOG.md');

  // Check client version if provided
  const clientVersion = request.headers['x-client-version'] as string;

  if (clientVersion) {
    // Validate client version format
    if (!parseVersion(clientVersion)) {
      reply.code(400).send({
        success: false,
        error: 'Invalid client version format. Expected semantic version (e.g., 1.0.0)',
        errorCode: 'INVALID_CLIENT_VERSION',
      });
      return;
    }

    // Check if client version is deprecated
    if (isVersionDeprecated(clientVersion)) {
      reply.header(VERSION_HEADERS.DEPRECATION, 'true');
      reply.header(
        VERSION_HEADERS.SUNSET,
        new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // 90 days
      );

      // Add deprecation warning to response (non-blocking)
      request.log.warn({
        msg: 'Deprecated client version',
        clientVersion,
        minSupportedVersion: MIN_SUPPORTED_VERSION,
      });
    }

    // Check if client version is supported
    if (!isVersionSupported(clientVersion)) {
      reply.code(426).send({
        success: false,
        error: `Client version ${clientVersion} is no longer supported. Minimum version: ${MIN_SUPPORTED_VERSION}`,
        errorCode: 'VERSION_TOO_OLD',
        upgradeRequired: true,
        minVersion: MIN_SUPPORTED_VERSION,
        currentVersion: API_VERSION.full,
      });
      return;
    }
  }

  // Add version info to request context for logging
  (request as any).apiVersion = API_VERSION.full;
}

/**
 * Get version information object
 */
export function getVersionInfo() {
  return {
    version: API_VERSION.full,
    releaseDate: API_VERSION.releaseDate,
    stability: API_VERSION.stability,
    minSupportedVersion: MIN_SUPPORTED_VERSION,
    deprecatedVersions: DEPRECATED_VERSIONS,
    changelog: 'https://github.com/MerlijnW70/zodforge-api/blob/main/CHANGELOG.md',
    semver: {
      major: API_VERSION.major,
      minor: API_VERSION.minor,
      patch: API_VERSION.patch,
    },
  };
}

/**
 * Create deprecation notice
 */
export function createDeprecationNotice(
  feature: string,
  removalVersion: string,
  alternative?: string
): string {
  let notice = `DEPRECATED: ${feature} will be removed in version ${removalVersion}.`;
  if (alternative) {
    notice += ` Use ${alternative} instead.`;
  }
  return notice;
}

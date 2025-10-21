// Tests for API versioning middleware
import { describe, it, expect } from 'vitest';
import {
  API_VERSION,
  MIN_SUPPORTED_VERSION,
  parseVersion,
  compareVersions,
  isVersionDeprecated,
  isVersionSupported,
  getVersionInfo,
  createDeprecationNotice,
} from '../../middleware/versioning.js';

describe('Versioning Utilities', () => {
  describe('parseVersion', () => {
    it('should parse valid semantic version', () => {
      const version = parseVersion('1.2.3');

      expect(version).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
      });
    });

    it('should return null for invalid version', () => {
      expect(parseVersion('1.2')).toBeNull();
      expect(parseVersion('v1.2.3')).toBeNull();
      expect(parseVersion('invalid')).toBeNull();
      expect(parseVersion('1.2.3.4')).toBeNull();
    });

    it('should handle zero versions', () => {
      const version = parseVersion('0.0.0');
      expect(version).toEqual({
        major: 0,
        minor: 0,
        patch: 0,
      });
    });
  });

  describe('compareVersions', () => {
    it('should compare major versions', () => {
      expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
      expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
    });

    it('should compare minor versions when major is equal', () => {
      expect(compareVersions('1.2.0', '1.1.0')).toBe(1);
      expect(compareVersions('1.1.0', '1.2.0')).toBe(-1);
    });

    it('should compare patch versions when major and minor are equal', () => {
      expect(compareVersions('1.1.2', '1.1.1')).toBe(1);
      expect(compareVersions('1.1.1', '1.1.2')).toBe(-1);
    });

    it('should return 0 for equal versions', () => {
      expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
    });

    it('should throw for invalid versions', () => {
      expect(() => compareVersions('invalid', '1.0.0')).toThrow('Invalid version format');
      expect(() => compareVersions('1.0.0', 'invalid')).toThrow('Invalid version format');
    });
  });

  describe('isVersionDeprecated', () => {
    it('should return true for deprecated versions', () => {
      // Assuming '1.0.0' is deprecated based on middleware setup
      expect(isVersionDeprecated('1.0.0')).toBe(true);
    });

    it('should return false for non-deprecated versions', () => {
      expect(isVersionDeprecated('1.1.0')).toBe(false);
      expect(isVersionDeprecated('2.0.0')).toBe(false);
    });
  });

  describe('isVersionSupported', () => {
    it('should return true for supported versions', () => {
      expect(isVersionSupported('1.0.0')).toBe(true);
      expect(isVersionSupported('1.1.0')).toBe(true);
      expect(isVersionSupported('2.0.0')).toBe(true);
    });

    it('should return false for versions below minimum', () => {
      // MIN_SUPPORTED_VERSION is '1.0.0'
      expect(isVersionSupported('0.9.9')).toBe(false);
      expect(isVersionSupported('0.1.0')).toBe(false);
    });

    it('should return false for invalid versions', () => {
      expect(isVersionSupported('invalid')).toBe(false);
      expect(isVersionSupported('v1.0.0')).toBe(false);
    });
  });

  describe('getVersionInfo', () => {
    it('should return complete version information', () => {
      const info = getVersionInfo();

      expect(info).toHaveProperty('version');
      expect(info).toHaveProperty('releaseDate');
      expect(info).toHaveProperty('stability');
      expect(info).toHaveProperty('minSupportedVersion');
      expect(info).toHaveProperty('deprecatedVersions');
      expect(info).toHaveProperty('changelog');
      expect(info).toHaveProperty('semver');
    });

    it('should have correct version format', () => {
      const info = getVersionInfo();

      expect(info.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(info.minSupportedVersion).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should have semver components', () => {
      const info = getVersionInfo();

      expect(info.semver).toHaveProperty('major');
      expect(info.semver).toHaveProperty('minor');
      expect(info.semver).toHaveProperty('patch');
      expect(typeof info.semver.major).toBe('number');
      expect(typeof info.semver.minor).toBe('number');
      expect(typeof info.semver.patch).toBe('number');
    });

    it('should have valid stability', () => {
      const info = getVersionInfo();

      expect(['alpha', 'beta', 'rc', 'stable']).toContain(info.stability);
    });
  });

  describe('createDeprecationNotice', () => {
    it('should create basic deprecation notice', () => {
      const notice = createDeprecationNotice('Feature X', '2.0.0');

      expect(notice).toContain('DEPRECATED');
      expect(notice).toContain('Feature X');
      expect(notice).toContain('2.0.0');
    });

    it('should include alternative when provided', () => {
      const notice = createDeprecationNotice('Feature X', '2.0.0', 'Feature Y');

      expect(notice).toContain('Feature X');
      expect(notice).toContain('2.0.0');
      expect(notice).toContain('Feature Y');
      expect(notice).toContain('Use Feature Y instead');
    });

    it('should not mention alternative when not provided', () => {
      const notice = createDeprecationNotice('Feature X', '2.0.0');

      expect(notice).not.toContain('instead');
    });
  });

  describe('API_VERSION constant', () => {
    it('should have all required fields', () => {
      expect(API_VERSION).toHaveProperty('major');
      expect(API_VERSION).toHaveProperty('minor');
      expect(API_VERSION).toHaveProperty('patch');
      expect(API_VERSION).toHaveProperty('full');
      expect(API_VERSION).toHaveProperty('releaseDate');
      expect(API_VERSION).toHaveProperty('stability');
    });

    it('should have consistent version string', () => {
      const { major, minor, patch, full } = API_VERSION;
      expect(full).toBe(`${major}.${minor}.${patch}`);
    });

    it('should have valid release date', () => {
      const date = new Date(API_VERSION.releaseDate);
      expect(date.toString()).not.toBe('Invalid Date');
    });
  });

  describe('MIN_SUPPORTED_VERSION constant', () => {
    it('should be a valid semantic version', () => {
      expect(MIN_SUPPORTED_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should be less than or equal to current version', () => {
      expect(compareVersions(MIN_SUPPORTED_VERSION, API_VERSION.full)).toBeLessThanOrEqual(0);
    });
  });
});

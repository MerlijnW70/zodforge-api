// Tests for metrics collector
import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsCollector } from '../../../lib/providers/metrics.js';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector(100);
  });

  describe('record', () => {
    it('should record a successful request', () => {
      collector.record('openai', true, 1500);

      const metrics = collector.getMetrics('openai');
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(1);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.averageResponseTime).toBe(1500);
    });

    it('should record a failed request', () => {
      collector.record('openai', false, 500, 'API error');

      const metrics = collector.getMetrics('openai');
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(1);
    });

    it('should limit entries to maxEntries', () => {
      const smallCollector = new MetricsCollector(3);

      for (let i = 0; i < 5; i++) {
        smallCollector.record('openai', true, 1000);
      }

      expect(smallCollector.getEntryCount()).toBe(3);
    });
  });

  describe('getMetrics', () => {
    beforeEach(() => {
      collector.record('openai', true, 1000);
      collector.record('openai', true, 2000);
      collector.record('openai', false, 500, 'Rate limit');
    });

    it('should calculate correct metrics', () => {
      const metrics = collector.getMetrics('openai');

      expect(metrics.totalRequests).toBe(3);
      expect(metrics.successfulRequests).toBe(2);
      expect(metrics.failedRequests).toBe(1);
      expect(metrics.successRate).toBeCloseTo(2 / 3);
      expect(metrics.averageResponseTime).toBeCloseTo(1166.67, 1);
      expect(metrics.minResponseTime).toBe(500);
      expect(metrics.maxResponseTime).toBe(2000);
    });

    it('should return zero metrics for non-existent provider', () => {
      const metrics = collector.getMetrics('non-existent');

      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successRate).toBe(0);
      expect(metrics.averageResponseTime).toBe(0);
    });

    it('should filter by time period', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Only recent entries
      const metrics = collector.getMetrics('openai', new Date());
      expect(metrics.totalRequests).toBe(3);

      // No entries from far past
      const oldMetrics = collector.getMetrics('openai', new Date(Date.now() + 3600000));
      expect(oldMetrics.totalRequests).toBe(0);
    });
  });

  describe('getAllMetrics', () => {
    beforeEach(() => {
      collector.record('openai', true, 1000);
      collector.record('openai', false, 500);
      collector.record('anthropic', true, 1500);
    });

    it('should return metrics for all providers', () => {
      const allMetrics = collector.getAllMetrics();

      expect(Object.keys(allMetrics)).toHaveLength(2);
      expect(allMetrics.openai.totalRequests).toBe(2);
      expect(allMetrics.anthropic.totalRequests).toBe(1);
    });
  });

  describe('getTopProviders', () => {
    beforeEach(() => {
      collector.record('provider1', true, 1000);
      collector.record('provider1', true, 1000);
      collector.record('provider1', true, 1000); // 100% success

      collector.record('provider2', true, 1000);
      collector.record('provider2', false, 1000); // 50% success

      collector.record('provider3', false, 1000);
      collector.record('provider3', false, 1000); // 0% success
    });

    it('should return top providers by success rate', () => {
      const top = collector.getTopProviders(3);

      expect(top).toHaveLength(3);
      expect(top[0].provider).toBe('provider1');
      expect(top[0].metrics.successRate).toBe(1);
      expect(top[1].provider).toBe('provider2');
      expect(top[1].metrics.successRate).toBe(0.5);
      expect(top[2].provider).toBe('provider3');
      expect(top[2].metrics.successRate).toBe(0);
    });

    it('should limit results', () => {
      const top = collector.getTopProviders(2);
      expect(top).toHaveLength(2);
    });
  });

  describe('getFastestProviders', () => {
    beforeEach(() => {
      collector.record('fast', true, 500);
      collector.record('fast', true, 600);

      collector.record('slow', true, 2000);
      collector.record('slow', true, 2500);

      collector.record('medium', true, 1000);
    });

    it('should return fastest providers', () => {
      const fastest = collector.getFastestProviders(3);

      expect(fastest).toHaveLength(3);
      expect(fastest[0].provider).toBe('fast');
      expect(fastest[0].metrics.averageResponseTime).toBe(550);
      expect(fastest[1].provider).toBe('medium');
      expect(fastest[2].provider).toBe('slow');
    });
  });

  describe('getSlowestProviders', () => {
    beforeEach(() => {
      collector.record('fast', true, 500);
      collector.record('slow', true, 2000);
      collector.record('medium', true, 1000);
    });

    it('should return slowest providers', () => {
      const slowest = collector.getSlowestProviders(3);

      expect(slowest).toHaveLength(3);
      expect(slowest[0].provider).toBe('slow');
      expect(slowest[1].provider).toBe('medium');
      expect(slowest[2].provider).toBe('fast');
    });
  });

  describe('getErrorBreakdown', () => {
    beforeEach(() => {
      collector.record('openai', false, 500, 'Rate limit exceeded');
      collector.record('openai', false, 600, 'Rate limit exceeded');
      collector.record('openai', false, 700, 'API timeout');
      collector.record('openai', true, 800);
    });

    it('should break down errors by type', () => {
      const breakdown = collector.getErrorBreakdown('openai');

      expect(Object.keys(breakdown)).toHaveLength(2);
      expect(breakdown['Rate limit exceeded'].count).toBe(2);
      expect(breakdown['Rate limit exceeded'].percentage).toBeCloseTo(66.67, 1);
      expect(breakdown['API timeout'].count).toBe(1);
      expect(breakdown['API timeout'].percentage).toBeCloseTo(33.33, 1);
    });

    it('should handle provider with no errors', () => {
      collector.record('perfect', true, 1000);

      const breakdown = collector.getErrorBreakdown('perfect');
      expect(Object.keys(breakdown)).toHaveLength(0);
    });
  });

  describe('getTimeline', () => {
    it('should group requests by time intervals', () => {
      const now = Date.now();

      // Override timestamps for predictable testing
      collector.record('openai', true, 1000);
      collector.record('openai', false, 1500);

      const timeline = collector.getTimeline('openai', 60000); // 1 minute intervals

      expect(timeline.length).toBeGreaterThan(0);
      expect(timeline[0].requests).toBeDefined();
      expect(timeline[0].successful).toBeDefined();
      expect(timeline[0].failed).toBeDefined();
      expect(timeline[0].avgResponseTime).toBeDefined();
    });
  });

  describe('clear', () => {
    it('should clear all metrics', () => {
      collector.record('openai', true, 1000);
      collector.record('anthropic', true, 1500);

      collector.clear();

      const allMetrics = collector.getAllMetrics();
      expect(Object.keys(allMetrics)).toHaveLength(0);
    });
  });

  describe('getEntryCount', () => {
    it('should return correct count', () => {
      expect(collector.getEntryCount()).toBe(0);

      collector.record('openai', true, 1000);
      expect(collector.getEntryCount()).toBe(1);

      collector.record('anthropic', true, 1500);
      expect(collector.getEntryCount()).toBe(2);
    });
  });

  describe('exportJSON', () => {
    beforeEach(() => {
      collector.record('openai', true, 1000);
      collector.record('openai', false, 500);
    });

    it('should export metrics as JSON', () => {
      const json = collector.exportJSON();
      const data = JSON.parse(json);

      expect(data.timestamp).toBeDefined();
      expect(data.totalEntries).toBe(2);
      expect(data.metrics.openai).toBeDefined();
      expect(data.metrics.openai.totalRequests).toBe(2);
    });
  });

  describe('lastRequestTime tracking', () => {
    it('should track last request, success, and failure times', () => {
      collector.record('openai', true, 1000);
      const metrics1 = collector.getMetrics('openai');
      expect(metrics1.lastRequestTime).toBeDefined();
      expect(metrics1.lastSuccessTime).toBeDefined();
      expect(metrics1.lastFailureTime).toBeUndefined();

      collector.record('openai', false, 500);
      const metrics2 = collector.getMetrics('openai');
      expect(metrics2.lastFailureTime).toBeDefined();
    });
  });
});

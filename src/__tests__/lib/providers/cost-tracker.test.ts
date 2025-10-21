// Tests for cost tracker
import { describe, it, expect, beforeEach } from 'vitest';
import { CostTracker } from '../../../lib/providers/cost-tracker.js';

describe('CostTracker', () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = new CostTracker(100);
  });

  describe('track', () => {
    it('should track a cost entry', () => {
      tracker.track({
        provider: 'openai',
        inputTokens: 1000,
        outputTokens: 500,
        cost: 0.015,
      });

      const summary = tracker.getSummary();
      expect(summary.totalRequests).toBe(1);
      expect(summary.totalCost).toBe(0.015);
    });

    it('should track multiple entries', () => {
      tracker.track({
        provider: 'openai',
        inputTokens: 1000,
        outputTokens: 500,
        cost: 0.015,
      });

      tracker.track({
        provider: 'anthropic',
        inputTokens: 2000,
        outputTokens: 1000,
        cost: 0.021,
      });

      const summary = tracker.getSummary();
      expect(summary.totalRequests).toBe(2);
      expect(summary.totalCost).toBeCloseTo(0.036);
    });

    it('should limit entries to maxEntries', () => {
      const smallTracker = new CostTracker(3);

      for (let i = 0; i < 5; i++) {
        smallTracker.track({
          provider: 'openai',
          inputTokens: 1000,
          outputTokens: 500,
          cost: 0.01,
        });
      }

      const count = smallTracker.getEntryCount();
      expect(count).toBe(3);
    });
  });

  describe('calculateCost', () => {
    it('should calculate cost correctly', () => {
      const cost = tracker.calculateCost(
        'openai',
        1000, // input tokens
        500, // output tokens
        0.01, // $0.01 per 1K input
        0.03 // $0.03 per 1K output
      );

      // (1000 / 1000) * 0.01 + (500 / 1000) * 0.03
      // = 0.01 + 0.015
      // = 0.025
      expect(cost).toBeCloseTo(0.025);
    });

    it('should handle large token counts', () => {
      const cost = tracker.calculateCost(
        'provider',
        50000, // 50K input
        25000, // 25K output
        0.01,
        0.03
      );

      // (50000 / 1000) * 0.01 + (25000 / 1000) * 0.03
      // = 0.5 + 0.75
      // = 1.25
      expect(cost).toBeCloseTo(1.25);
    });
  });

  describe('getSummary', () => {
    beforeEach(() => {
      tracker.track({
        provider: 'openai',
        inputTokens: 1000,
        outputTokens: 500,
        cost: 0.025,
      });

      tracker.track({
        provider: 'openai',
        inputTokens: 2000,
        outputTokens: 1000,
        cost: 0.05,
      });

      tracker.track({
        provider: 'anthropic',
        inputTokens: 1500,
        outputTokens: 750,
        cost: 0.0165,
      });
    });

    it('should calculate overall summary', () => {
      const summary = tracker.getSummary();

      expect(summary.totalRequests).toBe(3);
      expect(summary.totalCost).toBeCloseTo(0.0915);
      expect(summary.totalInputTokens).toBe(4500);
      expect(summary.totalOutputTokens).toBe(2250);
      expect(summary.averageCostPerRequest).toBeCloseTo(0.0305);
    });

    it('should break down by provider', () => {
      const summary = tracker.getSummary();

      expect(summary.byProvider.openai.requests).toBe(2);
      expect(summary.byProvider.openai.cost).toBeCloseTo(0.075);
      expect(summary.byProvider.openai.inputTokens).toBe(3000);

      expect(summary.byProvider.anthropic.requests).toBe(1);
      expect(summary.byProvider.anthropic.cost).toBeCloseTo(0.0165);
    });

    it('should filter by time period', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Only entries from today
      const summary = tracker.getSummary(new Date());
      expect(summary.totalRequests).toBe(3);

      // No entries from yesterday
      const oldSummary = tracker.getSummary(yesterday);
      expect(oldSummary.totalRequests).toBe(3); // All within last 24h
    });
  });

  describe('getMostCostEffective', () => {
    it('should find cheapest provider', () => {
      const providers = [
        {
          name: 'expensive',
          costPerInputToken: 0.01,
          costPerOutputToken: 0.03,
        },
        {
          name: 'cheap',
          costPerInputToken: 0.001,
          costPerOutputToken: 0.002,
        },
        {
          name: 'medium',
          costPerInputToken: 0.005,
          costPerOutputToken: 0.015,
        },
      ];

      const best = tracker.getMostCostEffective(providers, 1000, 500);

      expect(best).not.toBeNull();
      expect(best?.provider).toBe('cheap');
      expect(best?.estimatedCost).toBeCloseTo(0.002); // (1 * 0.001) + (0.5 * 0.002)
    });

    it('should return null for empty provider list', () => {
      const best = tracker.getMostCostEffective([], 1000, 500);
      expect(best).toBeNull();
    });
  });

  describe('getEntriesByProvider', () => {
    beforeEach(() => {
      tracker.track({ provider: 'openai', inputTokens: 100, outputTokens: 50, cost: 0.01 });
      tracker.track({ provider: 'anthropic', inputTokens: 200, outputTokens: 100, cost: 0.02 });
      tracker.track({ provider: 'openai', inputTokens: 300, outputTokens: 150, cost: 0.03 });
    });

    it('should get entries for specific provider', () => {
      const entries = tracker.getEntriesByProvider('openai');
      expect(entries).toHaveLength(2);
      expect(entries.every((e) => e.provider === 'openai')).toBe(true);
    });

    it('should limit returned entries', () => {
      const entries = tracker.getEntriesByProvider('openai', 1);
      expect(entries).toHaveLength(1);
    });
  });

  describe('getEntriesByTimeRange', () => {
    it('should filter entries by time range', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600000);
      const twoHoursAgo = new Date(now.getTime() - 7200000);

      tracker.track({ provider: 'openai', inputTokens: 100, outputTokens: 50, cost: 0.01 });

      const entries = tracker.getEntriesByTimeRange(twoHoursAgo, now);
      expect(entries).toHaveLength(1);

      // Future time range should be empty
      const futureEntries = tracker.getEntriesByTimeRange(
        new Date(now.getTime() + 3600000),
        new Date(now.getTime() + 7200000)
      );
      expect(futureEntries).toHaveLength(0);
    });
  });

  describe('exportCSV', () => {
    it('should export entries as CSV', () => {
      tracker.track({
        provider: 'openai',
        inputTokens: 1000,
        outputTokens: 500,
        cost: 0.025,
        model: 'gpt-4',
      });

      const csv = tracker.exportCSV();

      expect(csv).toContain('Timestamp,Provider,Model,Input Tokens,Output Tokens,Cost,Request ID');
      expect(csv).toContain('openai');
      expect(csv).toContain('gpt-4');
      expect(csv).toContain('1000');
      expect(csv).toContain('500');
      expect(csv).toContain('0.025');
    });
  });

  describe('checkBudget', () => {
    it('should detect budget exceeded', () => {
      tracker.track({ provider: 'openai', inputTokens: 1000, outputTokens: 500, cost: 30 });
      tracker.track({ provider: 'openai', inputTokens: 1000, outputTokens: 500, cost: 25 });

      const exceeded = tracker.checkBudget(50);
      expect(exceeded).toBe(true);
    });

    it('should return false when under budget', () => {
      tracker.track({ provider: 'openai', inputTokens: 1000, outputTokens: 500, cost: 10 });

      const exceeded = tracker.checkBudget(50);
      expect(exceeded).toBe(false);
    });

    it('should respect time period', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

      tracker.track({ provider: 'openai', inputTokens: 1000, outputTokens: 500, cost: 60 });

      // Budget exceeded for all time
      expect(tracker.checkBudget(50)).toBe(true);

      // Not exceeded for entries since today (none)
      expect(tracker.checkBudget(50, new Date())).toBe(true); // Entry is recent
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      tracker.track({ provider: 'openai', inputTokens: 1000, outputTokens: 500, cost: 0.01 });
      tracker.track({ provider: 'anthropic', inputTokens: 1000, outputTokens: 500, cost: 0.01 });

      tracker.clear();

      const summary = tracker.getSummary();
      expect(summary.totalRequests).toBe(0);
      expect(summary.totalCost).toBe(0);
    });
  });

  describe('getEntryCount', () => {
    it('should return correct count', () => {
      expect(tracker.getEntryCount()).toBe(0);

      tracker.track({ provider: 'openai', inputTokens: 1000, outputTokens: 500, cost: 0.01 });
      expect(tracker.getEntryCount()).toBe(1);

      tracker.track({ provider: 'openai', inputTokens: 1000, outputTokens: 500, cost: 0.01 });
      expect(tracker.getEntryCount()).toBe(2);
    });
  });
});

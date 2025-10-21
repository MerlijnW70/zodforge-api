// Cost tracking and optimization for AI providers
export interface CostEntry {
  provider: string;
  timestamp: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  model?: string;
  requestId?: string;
}

export interface CostSummary {
  totalCost: number;
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  averageCostPerRequest: number;
  byProvider: Record<
    string,
    {
      cost: number;
      requests: number;
      inputTokens: number;
      outputTokens: number;
    }
  >;
}

/**
 * Cost tracker for AI provider usage
 */
export class CostTracker {
  private entries: CostEntry[] = [];
  private maxEntries: number;

  constructor(maxEntries = 10000) {
    this.maxEntries = maxEntries;
    console.log(`💰 Cost tracker initialized (max entries: ${maxEntries})`);
  }

  /**
   * Track a request cost
   */
  track(entry: Omit<CostEntry, 'timestamp'>): void {
    const fullEntry: CostEntry = {
      ...entry,
      timestamp: Date.now(),
    };

    this.entries.push(fullEntry);

    // Prune old entries if needed
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    console.log(
      `💰 Cost tracked: ${entry.provider} - $${entry.cost.toFixed(6)} (${entry.inputTokens} in, ${entry.outputTokens} out)`
    );
  }

  /**
   * Calculate cost based on token usage and provider rates
   */
  calculateCost(
    _provider: string,
    inputTokens: number,
    outputTokens: number,
    costPerInputToken: number,
    costPerOutputToken: number
  ): number {
    const inputCost = (inputTokens / 1000) * costPerInputToken;
    const outputCost = (outputTokens / 1000) * costPerOutputToken;
    return inputCost + outputCost;
  }

  /**
   * Get cost summary for a time period
   */
  getSummary(since?: Date): CostSummary {
    const sinceTimestamp = since ? since.getTime() : 0;
    const relevantEntries = this.entries.filter((entry) => entry.timestamp >= sinceTimestamp);

    const byProvider: Record<string, any> = {};
    let totalCost = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (const entry of relevantEntries) {
      totalCost += entry.cost;
      totalInputTokens += entry.inputTokens;
      totalOutputTokens += entry.outputTokens;

      if (!byProvider[entry.provider]) {
        byProvider[entry.provider] = {
          cost: 0,
          requests: 0,
          inputTokens: 0,
          outputTokens: 0,
        };
      }

      byProvider[entry.provider].cost += entry.cost;
      byProvider[entry.provider].requests += 1;
      byProvider[entry.provider].inputTokens += entry.inputTokens;
      byProvider[entry.provider].outputTokens += entry.outputTokens;
    }

    return {
      totalCost,
      totalRequests: relevantEntries.length,
      totalInputTokens,
      totalOutputTokens,
      averageCostPerRequest: relevantEntries.length > 0 ? totalCost / relevantEntries.length : 0,
      byProvider,
    };
  }

  /**
   * Get most cost-effective provider for a given workload
   */
  getMostCostEffective(
    providers: Array<{
      name: string;
      costPerInputToken: number;
      costPerOutputToken: number;
    }>,
    estimatedInputTokens: number,
    estimatedOutputTokens: number
  ): { provider: string; estimatedCost: number } | null {
    if (providers.length === 0) {
      return null;
    }

    let bestProvider: string | null = null;
    let bestCost = Infinity;

    for (const provider of providers) {
      const cost = this.calculateCost(
        provider.name,
        estimatedInputTokens,
        estimatedOutputTokens,
        provider.costPerInputToken,
        provider.costPerOutputToken
      );

      if (cost < bestCost) {
        bestCost = cost;
        bestProvider = provider.name;
      }
    }

    return bestProvider ? { provider: bestProvider, estimatedCost: bestCost } : null;
  }

  /**
   * Get entries for a specific provider
   */
  getEntriesByProvider(provider: string, limit?: number): CostEntry[] {
    const entries = this.entries.filter((entry) => entry.provider === provider);
    return limit ? entries.slice(-limit) : entries;
  }

  /**
   * Get entries within a time range
   */
  getEntriesByTimeRange(start: Date, end: Date): CostEntry[] {
    const startTime = start.getTime();
    const endTime = end.getTime();
    return this.entries.filter(
      (entry) => entry.timestamp >= startTime && entry.timestamp <= endTime
    );
  }

  /**
   * Export entries as CSV
   */
  exportCSV(): string {
    const headers = [
      'Timestamp',
      'Provider',
      'Model',
      'Input Tokens',
      'Output Tokens',
      'Cost',
      'Request ID',
    ];

    const rows = this.entries.map((entry) => [
      new Date(entry.timestamp).toISOString(),
      entry.provider,
      entry.model || 'N/A',
      entry.inputTokens.toString(),
      entry.outputTokens.toString(),
      entry.cost.toFixed(6),
      entry.requestId || 'N/A',
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries = [];
    console.log('💰 Cost tracker cleared');
  }

  /**
   * Get total entry count
   */
  getEntryCount(): number {
    return this.entries.length;
  }

  /**
   * Set budget alert (returns true if budget exceeded)
   */
  checkBudget(budget: number, period?: Date): boolean {
    const summary = this.getSummary(period);
    const exceeded = summary.totalCost > budget;

    if (exceeded) {
      console.warn(
        `💰 ⚠️  Budget EXCEEDED: $${summary.totalCost.toFixed(2)} / $${budget.toFixed(2)}`
      );
    }

    return exceeded;
  }
}

// Export singleton instance
export const costTracker = new CostTracker(10000);

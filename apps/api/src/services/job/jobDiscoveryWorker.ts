import { jobDiscoveryManager } from './jobDiscoveryManager';

export class JobDiscoveryWorker {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  public startWorker(pollIntervalMs = 60000) {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('🚀 Job Discovery Background Worker started.');

    // Run initial discovery cycle
    this.executePollingCycle();

    // Schedule periodic polling
    this.intervalId = setInterval(() => {
      this.executePollingCycle();
    }, pollIntervalMs);
  }

  public stopWorker() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 Job Discovery Background Worker stopped.');
  }

  public async executePollingCycle(userId = 'demo-user-123') {
    try {
      const result = await jobDiscoveryManager.discoverAndProcessJobs(userId, {
        roles: ['Backend Developer', 'Node.js Developer', 'Full Stack Developer'],
        limit: 15
      });
      return result;
    } catch (err) {
      console.warn('Job Discovery Worker polling cycle error:', err);
      return { discoveredCount: 0, newJobs: [], notifications: [] };
    }
  }
}

export const jobDiscoveryWorker = new JobDiscoveryWorker();

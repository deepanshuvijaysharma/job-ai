import { JobSearchQuery, JobSourceAdapter, RawJobData } from './jobSourceAdapter';
import { RemotePreference } from '@jobhunter/types';

export class GreenhouseAdapter implements JobSourceAdapter {
  sourceId = 'greenhouse';
  name = 'Greenhouse ATS Public Board';
  priority = 2; // Priority 2 per spec

  private knownBoards = ['acmecloud', 'stripe', 'figma', 'airbnb', 'vercel'];

  async search(query: JobSearchQuery): Promise<RawJobData[]> {
    const jobs: RawJobData[] = [];
    const limit = query.limit || 10;

    for (const board of this.knownBoards) {
      try {
        const boardJobs = await this.fetchBoardJobs(board, query);
        jobs.push(...boardJobs);
        if (jobs.length >= limit) break;
      } catch (err) {
        console.warn(`Failed to fetch Greenhouse board for ${board}`);
      }
    }

    return jobs.slice(0, limit);
  }

  async getJob(url: string): Promise<RawJobData | null> {
    if (!url.includes('greenhouse.io')) return null;

    const parts = url.split('/');
    const id = parts[parts.length - 1];
    return {
      title: 'Backend Software Engineer (Node.js)',
      companyName: 'Acme Cloud',
      source: 'Greenhouse Public Board',
      sourceId: this.sourceId,
      externalId: id,
      canonicalUrl: url,
      applicationUrl: url,
      location: 'Noida / Remote',
      remoteType: RemotePreference.REMOTE,
      description: 'Build high-performance microservices and REST APIs using Node.js, Express, and PostgreSQL.',
      requiredSkills: ['Node.js', 'Express.js', 'PostgreSQL', 'TypeScript'],
      preferredSkills: ['Redis', 'Docker'],
      experienceMin: 2,
      experienceMax: 4,
      postedAt: new Date().toISOString(),
      discoveredAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      status: 'NEW'
    };
  }

  private async fetchBoardJobs(boardToken: string, query: JobSearchQuery): Promise<RawJobData[]> {
    // Simulated public fetch for Greenhouse board API
    const roles = query.roles || ['Backend Developer'];
    const title = roles[0] || 'Backend Engineer';

    return [
      {
        title: `${title} (Node.js & Microservices)`,
        companyName: boardToken.toUpperCase(),
        source: 'Greenhouse Public Board',
        sourceId: this.sourceId,
        externalId: `gh-${boardToken}-101`,
        canonicalUrl: `https://boards.greenhouse.io/${boardToken}/jobs/101`,
        applicationUrl: `https://boards.greenhouse.io/${boardToken}/jobs/101#apply`,
        location: 'Remote / NCR',
        remoteType: RemotePreference.REMOTE,
        description: `Join ${boardToken} to build scalable Node.js microservices with PostgreSQL and Redis.`,
        requiredSkills: ['Node.js', 'Express.js', 'PostgreSQL', 'TypeScript', 'SQL'],
        preferredSkills: ['Redis', 'Docker'],
        experienceMin: 1,
        experienceMax: 4,
        postedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), // 2 hours ago
        discoveredAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        status: 'NEW'
      }
    ];
  }
}

export const greenhouseAdapter = new GreenhouseAdapter();

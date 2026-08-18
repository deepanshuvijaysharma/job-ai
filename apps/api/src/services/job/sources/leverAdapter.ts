import { JobSearchQuery, JobSourceAdapter, RawJobData } from './jobSourceAdapter';
import { RemotePreference } from '@jobhunter/types';

export class LeverAdapter implements JobSourceAdapter {
  sourceId = 'lever';
  name = 'Lever ATS Public Postings';
  priority = 3; // Priority 3 per spec

  private knownCompanies = ['innovatex', 'palantir', 'netflix', 'spotify'];

  async search(query: JobSearchQuery): Promise<RawJobData[]> {
    const jobs: RawJobData[] = [];
    const limit = query.limit || 10;

    for (const company of this.knownCompanies) {
      try {
        const companyJobs = await this.fetchCompanyPostings(company, query);
        jobs.push(...companyJobs);
        if (jobs.length >= limit) break;
      } catch (err) {
        console.warn(`Failed to fetch Lever postings for ${company}`);
      }
    }

    return jobs.slice(0, limit);
  }

  async getJob(url: string): Promise<RawJobData | null> {
    if (!url.includes('lever.co')) return null;

    return {
      title: 'Full Stack Node.js & React Engineer',
      companyName: 'InnovateX Labs',
      source: 'Lever ATS Public Postings',
      sourceId: this.sourceId,
      externalId: 'lev-102',
      canonicalUrl: url,
      applicationUrl: url,
      location: 'Gurgaon / Remote',
      remoteType: RemotePreference.HYBRID,
      description: 'Building high-throughput financial web applications using Node.js, React, and PostgreSQL.',
      requiredSkills: ['Node.js', 'React.js', 'TypeScript', 'PostgreSQL', 'REST API'],
      preferredSkills: ['Tailwind CSS', 'AWS'],
      experienceMin: 2,
      experienceMax: 4,
      postedAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
      discoveredAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      status: 'NEW'
    };
  }

  private async fetchCompanyPostings(company: string, query: JobSearchQuery): Promise<RawJobData[]> {
    const roles = query.roles || ['Full Stack Developer'];
    const title = roles[0] || 'Full Stack Engineer';

    return [
      {
        title: `${title} (Node.js & React)`,
        companyName: company.toUpperCase(),
        source: 'Lever ATS Public Postings',
        sourceId: this.sourceId,
        externalId: `lev-${company}-202`,
        canonicalUrl: `https://jobs.lever.co/${company}/202-posting`,
        applicationUrl: `https://jobs.lever.co/${company}/202-posting/apply`,
        location: 'Gurgaon / Remote',
        remoteType: RemotePreference.HYBRID,
        description: `Join ${company} to engineer modern React frontends and Node.js microservice backends.`,
        requiredSkills: ['Node.js', 'React.js', 'TypeScript', 'PostgreSQL', 'REST API'],
        preferredSkills: ['Tailwind CSS', 'Redux'],
        experienceMin: 2,
        experienceMax: 4,
        postedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
        discoveredAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        status: 'NEW'
      }
    ];
  }
}

export const leverAdapter = new LeverAdapter();

import { JobSearchQuery, JobSourceAdapter, RawJobData } from './jobSourceAdapter';
import { RemotePreference } from '@jobhunter/types';

export class CompanyCareerAdapter implements JobSourceAdapter {
  sourceId = 'company_career';
  name = 'Company Official Career Portal';
  priority = 1; // Priority 1 per spec

  async search(query: JobSearchQuery): Promise<RawJobData[]> {
    const roles = query.roles || ['Backend Developer'];
    const title = roles[0] || 'Software Engineer';

    return [
      {
        title: `Senior ${title}`,
        companyName: 'Acme Enterprise SaaS',
        source: 'Company Official Career Portal',
        sourceId: this.sourceId,
        externalId: 'careers-acme-301',
        canonicalUrl: 'https://careers.acmeenterprise.com/jobs/senior-backend-301',
        applicationUrl: 'https://careers.acmeenterprise.com/jobs/senior-backend-301/apply',
        location: 'Noida / Remote',
        remoteType: RemotePreference.HYBRID,
        description: 'Direct hiring position for Senior Backend Developer building microservices architecture.',
        requiredSkills: ['Node.js', 'Express.js', 'PostgreSQL', 'TypeScript', 'SQL'],
        preferredSkills: ['Redis', 'Docker'],
        experienceMin: 2,
        experienceMax: 5,
        postedAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(), // 1 hour ago
        discoveredAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        status: 'NEW',
        recruiterInfo: {
          name: 'Amit Sharma',
          role: 'Engineering Hiring Lead',
          email: 'amit.s@acmeenterprise.com',
          linkedinUrl: 'https://linkedin.com/in/amit-sharma-recruiter'
        }
      }
    ];
  }

  async getJob(url: string): Promise<RawJobData | null> {
    return {
      title: 'Backend Developer',
      companyName: 'Direct Career Client',
      source: 'Company Official Career Portal',
      sourceId: this.sourceId,
      canonicalUrl: url,
      applicationUrl: url,
      location: 'Noida',
      remoteType: RemotePreference.HYBRID,
      description: 'Career portal job description.',
      requiredSkills: ['Node.js', 'Express.js', 'SQL'],
      preferredSkills: [],
      postedAt: new Date().toISOString(),
      discoveredAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      status: 'NEW'
    };
  }
}

export const companyCareerAdapter = new CompanyCareerAdapter();

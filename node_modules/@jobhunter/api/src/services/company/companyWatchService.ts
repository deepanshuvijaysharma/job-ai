export interface WatchedCompanyInfo {
  id: string;
  name: string;
  website: string;
  industry: string;
  knownAts: string;
  techStack: string[];
  totalOpenJobs: number;
  matchingJobsCount: number;
  recruitersIdentifiedCount: number;
  newJobsTodayCount: number;
  whyThisCompany: string;
  approachStrategy: string;
}

export class CompanyWatchService {
  private watchedCompanies: Map<string, WatchedCompanyInfo> = new Map();

  constructor() {
    if (process.env.SEED_DEMO_DATA === 'true') {
      this.seedInitialWatches();
    }
  }

  public seedInitialWatches() {
    const defaultWatches: WatchedCompanyInfo[] = [
      {
        id: 'comp-acme',
        name: 'Acme Cloud Technologies',
        website: 'https://acmecloud.com',
        industry: 'Cloud Infrastructure & Enterprise SaaS',
        knownAts: 'Greenhouse',
        techStack: ['Node.js', 'Express', 'TypeScript', 'PostgreSQL', 'Redis', 'Docker'],
        totalOpenJobs: 12,
        matchingJobsCount: 3,
        recruitersIdentifiedCount: 2,
        newJobsTodayCount: 1,
        whyThisCompany: 'Fast-growing Cloud SaaS company with strong engineering culture and microservices focus.',
        approachStrategy: 'Reach out to Technical Recruiter (Amit Sharma) referencing Node.js microservices background.'
      },
      {
        id: 'comp-innovatex',
        name: 'InnovateX Labs',
        website: 'https://innovatex.io',
        industry: 'Fintech & Digital Banking',
        knownAts: 'Lever',
        techStack: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'AWS'],
        totalOpenJobs: 8,
        matchingJobsCount: 2,
        recruitersIdentifiedCount: 1,
        newJobsTodayCount: 1,
        whyThisCompany: 'High-throughput payment gateway architecture with modern React + Node stack.',
        approachStrategy: 'Contact TA Lead (Priya Verma) highlighting React + Node.js full-stack capabilities.'
      },
      {
        id: 'comp-synthetix',
        name: 'Synthetix AI Solutions',
        website: 'https://synthetix.ai',
        industry: 'Generative AI & Enterprise LLMs',
        knownAts: 'Workday',
        techStack: ['Python', 'Node.js', 'FastAPI', 'OpenAI', 'Vector DB'],
        totalOpenJobs: 5,
        matchingJobsCount: 2,
        recruitersIdentifiedCount: 1,
        newJobsTodayCount: 0,
        whyThisCompany: 'Pioneering enterprise AI lab integrating LLM wrappers with high-performance backends.',
        approachStrategy: 'Direct outreach to Hiring Manager (Rohan Gupta) showing AI project experience.'
      }
    ];

    defaultWatches.forEach(c => this.watchedCompanies.set(c.id, c));
  }

  getWatchlist(): WatchedCompanyInfo[] {
    return Array.from(this.watchedCompanies.values());
  }

  addCompanyWatch(name: string, website?: string): WatchedCompanyInfo {
    const id = `comp-watch-${Date.now()}`;
    const cleanName = name.trim();
    const info: WatchedCompanyInfo = {
      id,
      name: cleanName,
      website: website || `https://${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      industry: 'Technology & Software Engineering',
      knownAts: 'Greenhouse / Workday',
      techStack: ['Node.js', 'TypeScript', 'React', 'SQL'],
      totalOpenJobs: 4,
      matchingJobsCount: 2,
      recruitersIdentifiedCount: 1,
      newJobsTodayCount: 1,
      whyThisCompany: `Leading employer in tech sector actively posting for ${cleanName}.`,
      approachStrategy: 'Monitor official career portal daily and contact identified technical recruiters.'
    };

    this.watchedCompanies.set(id, info);
    return info;
  }
}

export const companyWatchService = new CompanyWatchService();

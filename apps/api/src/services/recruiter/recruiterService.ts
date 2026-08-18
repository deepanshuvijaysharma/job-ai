import { RecruiterDTO } from '@jobhunter/types';
import { DiscoveredRecruiter, RecruiterProvider, RecruiterSearchInput } from './recruiterProvider';
import { publicDirectoryProvider } from './directoryProvider';
import { recruiterRankingEngine } from './recruiterRankingEngine';

export interface RecruiterRankingResult {
  recruiter: RecruiterDTO;
  relevanceScore: number;
  reasoning: string[];
  evidence?: {
    source: string;
    sourceUrl?: string;
    lastVerifiedAt?: string;
  };
}

export class RecruiterService {
  private providers: RecruiterProvider[] = [];

  constructor() {
    this.registerProvider(publicDirectoryProvider);
  }

  public registerProvider(provider: RecruiterProvider) {
    this.providers.push(provider);
  }

  async discoverAndRankRecruiters(
    job: { title: string; companyName: string; location: string; requiredSkills?: string[] },
    existingRecruiters: RecruiterDTO[] = []
  ): Promise<RecruiterRankingResult[]> {
    const discoveredMap = new Map<string, DiscoveredRecruiter>();

    // 1. Process existing recruiters attached to job
    existingRecruiters.forEach(rec => {
      const cleanComp = (rec.companyId || job.companyName).toLowerCase().replace(/comp-/, '').replace(/[^a-z0-9]/g, '');
      const sig = `${rec.name.toLowerCase().trim()}_${cleanComp}`;
      const evalRes = recruiterRankingEngine.evaluateRecruiter({
        name: rec.name,
        jobTitle: rec.role,
        company: job.companyName,
        email: rec.email,
        sourceUrl: rec.source,
        isVerified: rec.isVerified
      }, job.title);

      discoveredMap.set(sig, {
        id: rec.id,
        name: rec.name,
        jobTitle: rec.role,
        company: job.companyName,
        profileUrl: rec.linkedinUrl,
        email: rec.email,
        emailSource: rec.source,
        sourceUrl: rec.source,
        location: job.location,
        confidence: rec.confidence,
        isVerified: rec.isVerified,
        lastVerifiedAt: new Date().toISOString(),
        relevanceScore: evalRes.relevanceScore,
        whyRelevant: evalRes.whyRelevant
      });
    });

    // 2. Query registered providers if additional discovery needed
    const searchInput: RecruiterSearchInput = {
      companyName: job.companyName,
      jobTitle: job.title,
      location: job.location
    };

    for (const provider of this.providers) {
      try {
        const found = await provider.searchRecruiters(searchInput);
        found.forEach(rec => {
          const cleanComp = rec.company.toLowerCase().replace(/comp-/, '').replace(/[^a-z0-9]/g, '');
          const sig = `${rec.name.toLowerCase().trim()}_${cleanComp}`;
          if (!discoveredMap.has(sig)) {
            discoveredMap.set(sig, rec);
          }
        });
      } catch (err) {
        console.warn(`Recruiter provider ${provider.name} execution failed:`, err);
      }
    }

    // 3. Convert map to ranked array
    const results: RecruiterRankingResult[] = Array.from(discoveredMap.values()).map(rec => ({
      recruiter: {
        id: rec.id,
        companyId: `comp-${rec.company.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        name: rec.name,
        role: rec.jobTitle,
        linkedinUrl: rec.profileUrl,
        email: rec.email,
        isVerified: rec.isVerified,
        confidence: rec.confidence,
        source: rec.emailSource || rec.sourceUrl || 'Public Directory'
      },
      relevanceScore: rec.relevanceScore,
      reasoning: rec.whyRelevant,
      evidence: {
        source: rec.emailSource || 'Public Directory',
        sourceUrl: rec.sourceUrl,
        lastVerifiedAt: rec.lastVerifiedAt
      }
    }));

    // Sort by relevance score descending
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return results;
  }
}

export const recruiterService = new RecruiterService();

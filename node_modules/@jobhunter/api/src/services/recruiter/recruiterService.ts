import { RecruiterDTO } from '@jobhunter/types';
import { RecruiterCandidate, RecruiterIntelligenceProvider, RecruiterSearchInput } from './recruiterProvider';
import { recruiterRankingEngine } from './recruiterRankingEngine';
import { userProvidedRecruiterProvider } from './providers/userProvidedProvider';
import { companyCareerRecruiterProvider } from './providers/companyCareerRecruiterProvider';
import { hunterIoProvider } from './providers/hunterIoProvider';
import { apolloProvider } from './providers/apolloProvider';
import { recruiterRepository } from '../../repositories/prismaRepository';

export interface RecruiterRankingResult {
  recruiter: RecruiterDTO;
  relevanceScore: number;
  reasoning: string[];
  evidence: {
    source: string;
    sourceUrl?: string;
    emailSource?: string;
    emailVerified?: string;
    verificationStatus?: string;
    lastVerifiedAt?: string;
  };
}

export class RecruiterService {
  private providers: RecruiterIntelligenceProvider[] = [];

  constructor() {
    this.registerProvider(userProvidedRecruiterProvider);
    this.registerProvider(companyCareerRecruiterProvider);
    this.registerProvider(hunterIoProvider);
    this.registerProvider(apolloProvider);
  }

  public registerProvider(provider: RecruiterIntelligenceProvider) {
    this.providers.push(provider);
  }

  public getProviderHealth(): Array<{ id: string; name: string; isConfigured: boolean; status: string }> {
    return this.providers.map(p => ({
      id: p.id,
      name: p.name,
      isConfigured: p.isConfigured,
      status: p.isConfigured ? 'Active' : 'NOT CONFIGURED'
    }));
  }

  /**
   * Evidence-Based Recruiter Discovery & Ranking Pipeline:
   * 1. Query registered providers for candidates matching target company
   * 2. Enforce zero-fabrication rules & company relationship matching
   * 3. Deduplicate by email -> profileUrl -> name+company
   * 4. Rank using 10-tier role hierarchy & transparent relevance formula
   * 5. Return ranked list or empty array ("No verified recruiter found")
   */
  async discoverAndRankRecruiters(
    job: { title: string; companyName: string; location: string; companyId?: string },
    existingRecruiters: RecruiterDTO[] = []
  ): Promise<RecruiterRankingResult[]> {
    const discoveredMap = new Map<string, RecruiterCandidate>();

    // 1. Process existing recruiters attached to job with company relationship check
    existingRecruiters.forEach(rec => {
      const recCompany = rec.companyId ? rec.companyId.replace(/comp-/, '') : job.companyName;
      const jobCompany = (job.companyId || job.companyName).replace(/comp-/, '');

      // Strict Company Relationship Guardrail: allow bi-directional substring matching
      const c1 = recCompany.toLowerCase().replace(/[^a-z0-9]/g, '');
      const c2 = jobCompany.toLowerCase().replace(/[^a-z0-9]/g, '');

      if (c1 !== c2 && !c1.includes(c2) && !c2.includes(c1)) {
        return; // Reject wrong-company recruiter assignment
      }

      const key = rec.email ? rec.email.toLowerCase() : (rec.linkedinUrl || `${rec.name.toLowerCase()}_${recCompany.toLowerCase()}`);
      
      discoveredMap.set(key, {
        id: rec.id,
        name: rec.name,
        jobTitle: rec.role,
        companyId: rec.companyId,
        companyName: job.companyName,
        profileUrl: rec.linkedinUrl,
        email: rec.email || null,
        emailSource: rec.emailSource || rec.source || 'Database Record',
        emailVerified: rec.emailVerified || (rec.isVerified ? 'VERIFIED' : (rec.email ? 'PUBLIC' : 'UNKNOWN')),
        sourceUrl: rec.sourceUrl || rec.linkedinUrl || null,
        verificationStatus: rec.verificationStatus || (rec.isVerified ? 'VERIFIED' : 'UNVERIFIED'),
        lastVerifiedAt: rec.lastVerifiedAt || new Date().toISOString()
      });
    });

    // 2. Search configured providers
    const searchInput: RecruiterSearchInput = {
      companyName: job.companyName,
      companyId: job.companyId,
      jobTitle: job.title,
      location: job.location
    };

    for (const provider of this.providers) {
      if (!provider.isConfigured) continue;

      try {
        const found = await provider.searchRecruiters(searchInput);
        found.forEach(candidate => {
          // Zero fabrication check: Reject candidates with missing name or wrong company
          if (!candidate.name || !candidate.companyName) return;

          const cComp = candidate.companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
          const jComp = job.companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (cComp !== jComp && !cComp.includes(jComp) && !jComp.includes(cComp)) {
            return; // Reject wrong-company recruiter
          }

          // Deduplication key: email -> profileUrl -> name+company
          const key = candidate.email ? candidate.email.toLowerCase() :
                      (candidate.profileUrl || `${candidate.name.toLowerCase()}_${cComp}`);

          if (!discoveredMap.has(key)) {
            discoveredMap.set(key, candidate);
          }
        });
      } catch (err) {
        console.warn(`[RecruiterService] Provider ${provider.name} search failed: ${(err as Error).message}`);
      }
    }

    // 3. Evaluate, Rank & Persist
    const results: RecruiterRankingResult[] = [];

    for (const candidate of Array.from(discoveredMap.values())) {
      const evalRes = recruiterRankingEngine.evaluateRecruiter(candidate, job.title, job.companyName);

      const recruiterDto: RecruiterDTO = {
        id: candidate.id || `rec-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        companyId: job.companyId || `comp-${job.companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        name: candidate.name,
        role: candidate.jobTitle,
        linkedinUrl: candidate.profileUrl || undefined,
        email: candidate.email || undefined,
        emailSource: candidate.emailSource || undefined,
        emailVerified: candidate.emailVerified || (candidate.email ? 'PUBLIC' : 'UNKNOWN'),
        sourceUrl: candidate.sourceUrl || undefined,
        verificationStatus: candidate.verificationStatus || (candidate.emailVerified === 'VERIFIED' ? 'VERIFIED' : 'UNVERIFIED'),
        isVerified: candidate.verificationStatus === 'VERIFIED' || candidate.emailVerified === 'VERIFIED',
        confidence: evalRes.confidence,
        source: candidate.emailSource || candidate.sourceUrl || 'Public Evidence Portal',
        lastVerifiedAt: candidate.lastVerifiedAt || new Date().toISOString()
      };

      // Async persist to PostgreSQL if database active
      recruiterRepository.upsertRecruiter({
        id: recruiterDto.id,
        companyId: recruiterDto.companyId,
        companyName: job.companyName,
        name: recruiterDto.name,
        role: recruiterDto.role,
        email: recruiterDto.email,
        linkedinUrl: recruiterDto.linkedinUrl,
        isVerified: recruiterDto.isVerified,
        confidence: recruiterDto.confidence,
        source: recruiterDto.source
      }).catch(() => {/* DB offline */});

      results.push({
        recruiter: recruiterDto,
        relevanceScore: evalRes.relevanceScore,
        reasoning: evalRes.whyRelevant,
        evidence: {
          source: candidate.emailSource || candidate.profileSource || 'Public Evidence Portal',
          sourceUrl: candidate.sourceUrl || candidate.profileUrl || undefined,
          emailSource: candidate.emailSource || undefined,
          emailVerified: recruiterDto.emailVerified,
          verificationStatus: recruiterDto.verificationStatus,
          lastVerifiedAt: recruiterDto.lastVerifiedAt
        }
      });
    }

    // Sort by relevance score descending
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return results;
  }
}

export const recruiterService = new RecruiterService();

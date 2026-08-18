import { MatchPriority, RemotePreference } from '@jobhunter/types';
import { aiManager } from '../ai/aiProvider';

export interface RawJobData {
  title: string;
  companyName: string;
  companyWebsite?: string;
  source: string;
  sourceId?: string;
  externalId?: string;
  canonicalUrl: string;
  applicationUrl: string;
  location: string;
  remoteType: RemotePreference;
  salaryMin?: number;
  salaryMax?: number;
  experienceMin?: number;
  experienceMax?: number;
  description: string;
  requiredSkills: string[];
  preferredSkills: string[];
  employmentType?: string;
  postedAt?: Date | string;
  recruiterInfo?: {
    name: string;
    role: string;
    linkedinUrl?: string;
    email?: string;
  };
}

export interface JobMatchCalculation {
  overallScore: number;
  priority: MatchPriority;
  skillMatch: number;
  experienceMatch: number;
  roleMatch: number;
  locationMatch: number;
  salaryMatch: number;
  educationMatch: number;
  resumeKeywordMatch: number;
  projectMatch: number;
  whyApply: string[];
  whatHoldsBack: string[];
  recommendedResumeId?: string;
}

export class JobDeduplicationService {
  private seenCanonicalUrls = new Map<string, { id: string; hash: string; lastSeenAt: Date }>();
  private seenSourceJobIds = new Map<string, { id: string; hash: string; lastSeenAt: Date }>();
  private seenSignatures = new Map<string, { id: string; hash: string; lastSeenAt: Date }>();

  generateSignature(companyName: string, title: string, location: string): string {
    const cleanComp = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanLoc = location.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${cleanComp}_${cleanTitle}_${cleanLoc}`;
  }

  generateContentHash(job: RawJobData): string {
    return `${job.title}_${job.location}_${job.description.slice(0, 100)}_${(job.requiredSkills || []).join(',')}`;
  }

  checkJobStatus(job: RawJobData): { isDuplicate: boolean; isUpdated: boolean; existingId?: string } {
    const hash = this.generateContentHash(job);
    const sourceKey = job.sourceId && job.externalId ? `${job.sourceId}_${job.externalId}` : null;
    const sig = this.generateSignature(job.companyName, job.title, job.location);

    const match = this.seenCanonicalUrls.get(job.canonicalUrl) ||
                  (sourceKey ? this.seenSourceJobIds.get(sourceKey) : undefined) ||
                  this.seenSignatures.get(sig);

    if (match) {
      const isUpdated = match.hash !== hash;
      match.lastSeenAt = new Date();
      match.hash = hash;
      return { isDuplicate: true, isUpdated, existingId: match.id };
    }

    const newId = `job-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const record = { id: newId, hash, lastSeenAt: new Date() };

    this.seenCanonicalUrls.set(job.canonicalUrl, record);
    if (sourceKey) this.seenSourceJobIds.set(sourceKey, record);
    this.seenSignatures.set(sig, record);

    return { isDuplicate: false, isUpdated: false, existingId: newId };
  }

  isDuplicate(job: RawJobData): boolean {
    return this.checkJobStatus(job).isDuplicate;
  }
}

import { advancedMatchingEngine } from './advancedMatchingEngine';

export class JobMatchingEngine {
  async calculateMatch(
    candidate: {
      targetRoles: string[];
      secondaryRoles?: string[];
      experienceYears: number;
      skills: Array<{ name: string; yearsExperience: number; proficiencyLevel: string }>;
      preferredLocations: string[];
      remotePref: RemotePreference;
      salaryMin?: number;
      resumes?: Array<{ id: string; title: string; rawText?: string }>;
    },
    job: RawJobData
  ): Promise<JobMatchCalculation> {
    const adv = advancedMatchingEngine.calculateMatch(candidate, {
      title: job.title,
      companyName: job.companyName,
      location: job.location,
      remoteType: job.remoteType,
      description: job.description,
      requiredSkills: job.requiredSkills,
      preferredSkills: job.preferredSkills,
      experienceMin: job.experienceMin,
      experienceMax: job.experienceMax,
      postedAt: job.postedAt,
      hasRecruiter: !!job.recruiterInfo
    });

    return {
      overallScore: adv.overallScore,
      priority: adv.priority,
      skillMatch: adv.breakdown.requiredSkillScore,
      experienceMatch: adv.breakdown.experienceScore,
      roleMatch: adv.breakdown.roleScore,
      locationMatch: adv.breakdown.locationScore,
      salaryMatch: adv.breakdown.salaryScore ?? 85,
      educationMatch: adv.breakdown.educationScore,
      resumeKeywordMatch: adv.breakdown.resumeScore,
      projectMatch: adv.breakdown.projectScore,
      whyApply: adv.whyApply,
      whatHoldsBack: adv.whatHoldsBack
    };
  }
}

export const deduplicationService = new JobDeduplicationService();
export const matchingEngine = new JobMatchingEngine();

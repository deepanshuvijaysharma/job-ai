import { MatchPriority, RemotePreference } from '@jobhunter/types';
import { aiManager } from '../ai/aiProvider';

export interface RawJobData {
  title: string;
  companyName: string;
  companyWebsite?: string;
  source: string;
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
  postedAt?: Date;
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
  private seenCanonicalUrls = new Set<string>();
  private seenSignatures = new Set<string>();

  generateSignature(companyName: string, title: string, location: string): string {
    const cleanComp = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanLoc = location.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${cleanComp}_${cleanTitle}_${cleanLoc}`;
  }

  isDuplicate(job: RawJobData): boolean {
    if (this.seenCanonicalUrls.has(job.canonicalUrl)) {
      return true;
    }

    const sig = this.generateSignature(job.companyName, job.title, job.location);
    if (this.seenSignatures.has(sig)) {
      return true;
    }

    this.seenCanonicalUrls.add(job.canonicalUrl);
    this.seenSignatures.add(sig);
    return false;
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
      skillMatch: adv.breakdown.skillScore,
      experienceMatch: adv.breakdown.experienceScore,
      roleMatch: adv.breakdown.roleScore,
      locationMatch: adv.breakdown.locationScore,
      salaryMatch: adv.breakdown.salaryScore,
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

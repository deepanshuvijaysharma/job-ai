import { DiscoveredRecruiter } from './recruiterProvider';

export class RecruiterRankingEngine {
  /**
   * Score recruiter relevance (0-100) based on role priority, company alignment, and evidence.
   */
  public evaluateRecruiter(
    recruiter: {
      name: string;
      jobTitle: string;
      company: string;
      email?: string;
      sourceUrl?: string;
      isVerified?: boolean;
    },
    targetJobTitle?: string
  ): {
    relevanceScore: number;
    whyRelevant: string[];
    confidence: number;
  } {
    const titleLower = recruiter.jobTitle.toLowerCase();
    const whyRelevant: string[] = [];

    // 1. Role Relevance (Max 45 points)
    let roleScore = 15;
    if (titleLower.includes('technical recruiter') || titleLower.includes('tech recruiter')) {
      roleScore = 45;
      whyRelevant.push('Primary Technical Recruiter specializing in software engineering hires');
    } else if (titleLower.includes('talent acquisition') || titleLower.includes('ta lead')) {
      roleScore = 40;
      whyRelevant.push('Talent Acquisition Lead managing engineering pipeline');
    } else if (titleLower.includes('engineering recruiter') || titleLower.includes('tech talent partner')) {
      roleScore = 42;
      whyRelevant.push('Engineering Talent Partner dedicated to software teams');
    } else if (titleLower.includes('hiring manager') || titleLower.includes('vp of engineering')) {
      roleScore = 38;
      whyRelevant.push('Direct Technical Hiring Manager for role');
    } else if (titleLower.includes('engineering manager') || titleLower.includes('lead engineer')) {
      roleScore = 36;
      whyRelevant.push('Engineering Manager overseeing target department');
    } else if (titleLower.includes('hr') || titleLower.includes('human resources')) {
      roleScore = 20; // Generic HR is penalized relative to technical recruiters
      whyRelevant.push('General HR Contact (lower priority than Technical Recruiter)');
    }

    // 2. Verified Contact Evidence (Max 35 points)
    let contactScore = 10;
    if (recruiter.isVerified && recruiter.email) {
      contactScore = 35;
      whyRelevant.push('Verified corporate email with public source evidence');
    } else if (recruiter.email) {
      contactScore = 20;
      whyRelevant.push('Direct contact email available (unverified)');
    } else {
      whyRelevant.push('Public directory profile identified (email not publicly listed)');
    }

    // 3. Company & Job Title Relevance (Max 20 points)
    let companyScore = 15;
    if (targetJobTitle && titleLower.includes('tech')) {
      companyScore = 20;
    }

    const totalRelevance = roleScore + contactScore + companyScore;
    const relevanceScore = Math.min(98, Math.max(30, totalRelevance));

    const confidence = recruiter.isVerified ? 0.94 : (recruiter.email ? 0.70 : 0.50);

    return {
      relevanceScore,
      whyRelevant,
      confidence
    };
  }
}

export const recruiterRankingEngine = new RecruiterRankingEngine();

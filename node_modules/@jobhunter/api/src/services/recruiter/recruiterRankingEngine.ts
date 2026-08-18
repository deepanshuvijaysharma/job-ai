import { RecruiterCandidate } from './recruiterProvider';

export const RECRUITER_ROLE_HIERARCHY: Array<{ keyword: string; label: string; score: number }> = [
  { keyword: 'technical recruiter', label: 'Technical Recruiter', score: 100 },
  { keyword: 'tech recruiter', label: 'Technical Recruiter', score: 100 },
  { keyword: 'engineering recruiter', label: 'Engineering Recruiter', score: 95 },
  { keyword: 'technical talent acquisition', label: 'Technical Talent Acquisition', score: 90 },
  { keyword: 'tech ta', label: 'Technical Talent Acquisition', score: 90 },
  { keyword: 'talent acquisition partner', label: 'Talent Acquisition Partner', score: 85 },
  { keyword: 'ta lead', label: 'Talent Acquisition Lead', score: 85 },
  { keyword: 'talent partner', label: 'Talent Partner', score: 80 },
  { keyword: 'engineering hiring manager', label: 'Engineering Hiring Manager', score: 75 },
  { keyword: 'vp of engineering', label: 'VP of Engineering', score: 75 },
  { keyword: 'engineering manager', label: 'Engineering Manager', score: 70 },
  { keyword: 'engineering lead', label: 'Engineering Lead', score: 70 },
  { keyword: 'recruiter', label: 'General Recruiter', score: 60 },
  { keyword: 'hr', label: 'HR Contact', score: 50 },
  { keyword: 'human resources', label: 'HR Contact', score: 50 }
];

export class RecruiterRankingEngine {
  /**
   * Transparent 0-100 fit score for recruiters based on role hierarchy, company match,
   * technical recruiting focus, and evidence quality.
   */
  public evaluateRecruiter(
    recruiter: RecruiterCandidate,
    targetJobTitle?: string,
    targetCompanyName?: string
  ): {
    relevanceScore: number;
    whyRelevant: string[];
    confidence: number;
  } {
    const titleLower = recruiter.jobTitle.toLowerCase();
    const whyRelevant: string[] = [];

    // 1. Role Relevance (35% weight)
    let roleScore = 40; // Default for general employee
    let roleLabel = 'Company Contact';

    for (const item of RECRUITER_ROLE_HIERARCHY) {
      if (titleLower.includes(item.keyword)) {
        roleScore = item.score;
        roleLabel = item.label;
        break;
      }
    }

    if (roleScore >= 90) {
      whyRelevant.push(`✓ High priority ${roleLabel} specializing in software engineering hires`);
    } else if (roleScore >= 70) {
      whyRelevant.push(`✓ Engineering lead/manager with hiring authority (${roleLabel})`);
    } else {
      whyRelevant.push(`✓ ${roleLabel} contact`);
    }

    // 2. Company Alignment (25% weight)
    let companyScore = 60;
    if (targetCompanyName && recruiter.companyName) {
      const c1 = targetCompanyName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const c2 = recruiter.companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (c1 === c2 || c1.includes(c2) || c2.includes(c1)) {
        companyScore = 100;
        whyRelevant.push(`✓ Verified direct company affiliation (${recruiter.companyName})`);
      } else {
        companyScore = 30; // Wrong company penalty
        whyRelevant.push(`! Recruiter company (${recruiter.companyName}) differs from target job company (${targetCompanyName})`);
      }
    }

    // 3. Technical Focus & Department Match (15% weight)
    let focusScore = 50;
    if (titleLower.includes('tech') || titleLower.includes('engineer') || titleLower.includes('software') || titleLower.includes('dev')) {
      focusScore = 95;
      whyRelevant.push('✓ Dedicated technical/engineering recruiting focus');
    }

    // 4. Contact & Evidence Quality (15% weight)
    let contactScore = 40;
    if (recruiter.emailVerified === 'VERIFIED' && recruiter.email) {
      contactScore = 100;
      whyRelevant.push(`✓ Verified corporate email (${recruiter.emailSource || 'Public Corporate Portal'})`);
    } else if (recruiter.emailVerified === 'PUBLIC' && recruiter.email) {
      contactScore = 80;
      whyRelevant.push(`✓ Public contact email listed on corporate page`);
    } else if (recruiter.email) {
      contactScore = 60;
      whyRelevant.push(`✓ Direct email address available (${recruiter.email})`);
    } else {
      contactScore = 30;
      whyRelevant.push(`! Email address not publicly listed (Profile available)`);
    }

    // 5. Verification & Recency (10% weight)
    let recencyScore = 50;
    if (recruiter.verificationStatus === 'VERIFIED') {
      recencyScore = 100;
      whyRelevant.push('✓ Verified recruiter status with legitimate evidence');
    } else if (recruiter.verificationStatus === 'PUBLIC') {
      recencyScore = 80;
      whyRelevant.push('✓ Public professional profile verified');
    }

    // 6. Transparent Weighted Score Calculation (Sum = 100%)
    const weightedSum = Math.round(
      roleScore * 0.35 +
      companyScore * 0.25 +
      focusScore * 0.15 +
      contactScore * 0.15 +
      recencyScore * 0.10
    );

    const relevanceScore = Math.min(99, Math.max(10, weightedSum));
    const confidence = recruiter.verificationStatus === 'VERIFIED' ? 0.95 : (recruiter.email ? 0.70 : 0.40);

    return {
      relevanceScore,
      whyRelevant,
      confidence
    };
  }
}

export const recruiterRankingEngine = new RecruiterRankingEngine();

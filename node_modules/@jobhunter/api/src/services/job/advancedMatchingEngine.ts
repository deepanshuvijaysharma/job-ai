import { MatchPriority, RemotePreference } from '@jobhunter/types';
import { normalizeSkillName } from '../skill/skillNormalizationService';

// 1. Synonym Dictionary alias to Step 3 normalizeSkillName
export function normalizeSkill(skill: string): string {
  return normalizeSkillName(skill);
}

// 2. Transferable Skill Category Map for Partial Credit (50% credit)
export const TRANSFERABLE_CATEGORIES: Record<string, string[]> = {
  'database': ['PostgreSQL', 'MySQL', 'MongoDB', 'SQL', 'SQLite', 'Oracle', 'MariaDB', 'DynamoDB', 'Redis'],
  'node_ecosystem': ['Node.js', 'Express.js', 'NestJS', 'Koa.js', 'Fastify'],
  'python_ecosystem': ['Python', 'FastAPI', 'Django', 'Flask'],
  'java_ecosystem': ['Java', 'Spring Boot', 'Spring MVC'],
  'frontend': ['React.js', 'Vue.js', 'Angular', 'Next.js'],
  'cloud': ['AWS', 'GCP', 'Azure'],
  'container': ['Docker', 'Kubernetes']
};

export interface AdvancedMatchResult {
  overallScore: number;
  priority: MatchPriority;
  breakdown: {
    skillScore: number;
    requiredSkillScore: number;
    preferredSkillScore: number;
    roleScore: number;
    experienceScore: number;
    locationScore: number;
    salaryScore: number | null;
    educationScore: number;
    projectScore: number;
    resumeScore: number;
    freshnessScore: number;
  };
  matchedSkills: string[];
  partialSkills: Array<{ jobSkill: string; candidateSkill: string; reason: string }>;
  missingSkills: { required: string[]; preferred: string[] };
  transferableSkills: string[];
  freshnessLabel: 'Very Fresh' | 'Fresh' | 'Recent' | 'Aging' | 'Stale';
  risks: string[];
  whyApply: string[];
  whatHoldsBack: string[];
  recommendation: 'APPLY_NOW' | 'STRONG_MATCH' | 'POSSIBLE' | 'LOW_MATCH';
  recommendationReason?: string;
}

export class AdvancedJobMatchingEngine {
  /**
   * Transparent 0-100 fit engine with exact weight renormalization for undisclosed dimensions:
   * Standard Weights:
   * Required Skill (30%) + Preferred Skill (10%) + Role (15%) + Experience (15%) +
   * Location (10%) + Projects (5%) + Resume (5%) + Salary (5%) + Education (3%) + Freshness (2%) = 100%
   */
  public calculateMatch(
    candidate: {
      targetRoles: string[];
      secondaryRoles?: string[];
      experienceYears: number;
      skills: Array<{ name: string; yearsExperience: number; proficiencyLevel: string }>;
      preferredLocations: string[];
      remotePref: RemotePreference;
      salaryMin?: number;
      salaryMax?: number;
      education?: Array<{ degree: string }>;
      projects?: Array<{ title: string; techStack: string[] }>;
    },
    job: {
      title: string;
      companyName: string;
      location: string;
      remoteType: RemotePreference;
      description: string;
      requiredSkills: string[];
      preferredSkills: string[];
      experienceMin?: number;
      experienceMax?: number;
      salaryMin?: number;
      salaryMax?: number;
      educationRequired?: string;
      postedAt?: string | Date;
      hasRecruiter?: boolean;
    }
  ): AdvancedMatchResult {
    // A. Skill Normalization
    const normalizedReq = (job.requiredSkills || []).map(normalizeSkill);
    const normalizedPref = (job.preferredSkills || []).map(normalizeSkill);

    const candSkillMap = new Map<string, { years: number; proficiency: string }>();
    (candidate.skills || []).forEach(s => {
      candSkillMap.set(normalizeSkill(s.name).toLowerCase(), {
        years: s.yearsExperience,
        proficiency: s.proficiencyLevel
      });
    });

    // B. Required & Preferred Skill Matching
    const matchedSkills: string[] = [];
    const partialSkills: Array<{ jobSkill: string; candidateSkill: string; reason: string }> = [];
    const missingRequired: string[] = [];
    const missingPreferred: string[] = [];
    const transferableSkills: string[] = [];

    let requiredMatchedCount = 0;
    let requiredPartialCount = 0;

    normalizedReq.forEach(reqSkill => {
      const key = reqSkill.toLowerCase();
      if (candSkillMap.has(key)) {
        matchedSkills.push(reqSkill);
        requiredMatchedCount += 1;
      } else {
        let foundTransferable = false;
        for (const [catName, catSkills] of Object.entries(TRANSFERABLE_CATEGORIES)) {
          if (catSkills.some(cs => cs.toLowerCase() === key)) {
            const candHasCatSkill = catSkills.find(cs => candSkillMap.has(cs.toLowerCase()));
            if (candHasCatSkill) {
              partialSkills.push({
                jobSkill: reqSkill,
                candidateSkill: candHasCatSkill,
                reason: `Transferability: ${catName} experience (${candHasCatSkill})`
              });
              transferableSkills.push(`${candHasCatSkill} → ${reqSkill}`);
              requiredPartialCount += 0.5; // Partial credit
              foundTransferable = true;
              break;
            }
          }
        }
        if (!foundTransferable) {
          missingRequired.push(reqSkill);
        }
      }
    });

    let preferredMatchedCount = 0;
    normalizedPref.forEach(prefSkill => {
      const key = prefSkill.toLowerCase();
      if (candSkillMap.has(key)) {
        matchedSkills.push(prefSkill);
        preferredMatchedCount += 1;
      } else {
        missingPreferred.push(prefSkill);
      }
    });

    // 1. Required Skill Score (0-100)
    let requiredSkillScore = 100;
    if (normalizedReq.length > 0) {
      const effectiveMatched = requiredMatchedCount + requiredPartialCount;
      requiredSkillScore = Math.round((effectiveMatched / normalizedReq.length) * 100);
      if (missingRequired.length > 0) {
        requiredSkillScore = Math.max(0, requiredSkillScore - missingRequired.length * 10);
      }
    }

    // 2. Preferred Skill Score (0-100)
    let preferredSkillScore = 100;
    if (normalizedPref.length > 0) {
      preferredSkillScore = Math.round((preferredMatchedCount / normalizedPref.length) * 100);
    }

    // 3. Role Score (0-100)
    const titleLower = job.title.toLowerCase();
    let roleScore = 60;

    if (candidate.targetRoles && candidate.targetRoles.some(tr => titleLower.includes(tr.toLowerCase()) || tr.toLowerCase().includes(titleLower))) {
      roleScore = 95;
    } else if (candidate.secondaryRoles?.some(sr => titleLower.includes(sr.toLowerCase()) || sr.toLowerCase().includes(titleLower))) {
      roleScore = 82;
    } else if (titleLower.includes('software engineer') || titleLower.includes('developer')) {
      roleScore = 75;
    }

    // 4. Experience Score (0-100) & Severe Experience Gap Check
    const reqMinExp = job.experienceMin ?? 0;
    const reqMaxExp = job.experienceMax ?? (reqMinExp + 4);
    let experienceScore = 90;
    const risks: string[] = [];

    const experienceGap = reqMinExp - candidate.experienceYears;
    const isSevereExperienceGap = experienceGap >= 3;

    if (candidate.experienceYears < reqMinExp) {
      if (isSevereExperienceGap) {
        experienceScore = 35; // Severe mismatch penalty
        risks.push(`Candidate has ${candidate.experienceYears} yr experience, but position requires ${reqMinExp}+ yrs`);
      } else {
        experienceScore = Math.max(45, Math.round(90 - experienceGap * 20));
        risks.push(`Experience (${candidate.experienceYears} yrs) below minimum requirement (${reqMinExp} yrs)`);
      }
    } else if (candidate.experienceYears > reqMaxExp + 4) {
      experienceScore = 80;
    }

    // 5. Location Score (0-100)
    let locationScore = 75;
    const jobLocLower = job.location.toLowerCase();

    if (job.remoteType === RemotePreference.REMOTE || candidate.remotePref === RemotePreference.REMOTE) {
      locationScore = 100;
    } else if (candidate.preferredLocations && candidate.preferredLocations.some(pl => jobLocLower.includes(pl.toLowerCase()))) {
      locationScore = 95;
    } else if (jobLocLower.includes('noida') || jobLocLower.includes('gurgaon') || jobLocLower.includes('delhi')) {
      locationScore = 85;
    } else {
      risks.push(`Job location (${job.location}) does not match candidate preferred locations`);
    }

    // 6. Salary Score (null if undisclosed)
    let salaryScore: number | null = null;
    if (job.salaryMin && candidate.salaryMin) {
      if (job.salaryMax && job.salaryMax >= candidate.salaryMin) {
        salaryScore = 100;
      } else if (job.salaryMin >= candidate.salaryMin) {
        salaryScore = 90;
      } else {
        salaryScore = 60;
      }
    }

    // 7. Education Score (100 neutral if not required)
    let educationScore = 100;
    if (job.educationRequired) {
      const hasEdu = candidate.education && candidate.education.length > 0;
      educationScore = hasEdu ? 95 : 60;
    }

    // 8. Improved Project Relevance Score based on Required Skills Overlap
    let projectScore = 40; // Neutral base if candidate has no projects
    if (candidate.projects && candidate.projects.length > 0 && normalizedReq.length > 0) {
      const candidateProjectSkills = new Set<string>();
      candidate.projects.forEach(p => {
        (p.techStack || []).forEach(ts => candidateProjectSkills.add(normalizeSkill(ts).toLowerCase()));
      });

      let matchedProjSkillCount = 0;
      normalizedReq.forEach(req => {
        if (candidateProjectSkills.has(req.toLowerCase())) {
          matchedProjSkillCount++;
        }
      });

      const overlapRatio = matchedProjSkillCount / normalizedReq.length;
      if (overlapRatio >= 0.6) {
        projectScore = 95; // Strong overlap
      } else if (overlapRatio >= 0.3) {
        projectScore = 80; // Moderate overlap
      } else if (overlapRatio > 0) {
        projectScore = 60; // Weak overlap
      } else {
        projectScore = 45; // No overlap
      }
    }

    // 9. Resume Score (0-100)
    const resumeScore = Math.min(100, Math.round(requiredSkillScore * 0.95 + 5));

    // 10. Job Freshness Score & Label
    let freshnessScore = 70;
    let freshnessLabel: 'Very Fresh' | 'Fresh' | 'Recent' | 'Aging' | 'Stale' = 'Recent';

    if (job.postedAt) {
      const postedDate = new Date(job.postedAt).getTime();
      const ageHours = (Date.now() - postedDate) / (1000 * 3600);
      if (ageHours <= 6) {
        freshnessScore = 100;
        freshnessLabel = 'Very Fresh';
      } else if (ageHours <= 24) {
        freshnessScore = 90;
        freshnessLabel = 'Fresh';
      } else if (ageHours <= 72) {
        freshnessScore = 80;
        freshnessLabel = 'Recent';
      } else if (ageHours <= 168) {
        freshnessScore = 60;
        freshnessLabel = 'Aging';
      } else {
        freshnessScore = 40;
        freshnessLabel = 'Stale';
      }
    }

    // 11. Mathematical Weight Renormalization for Undisclosed Salary
    // Standard dimension weights:
    // reqSkill: 0.30, prefSkill: 0.10, role: 0.15, exp: 0.15, loc: 0.10, proj: 0.05, res: 0.05, sal: 0.05, edu: 0.03, fresh: 0.02
    let weightedSum = 
      requiredSkillScore * 0.30 +
      preferredSkillScore * 0.10 +
      roleScore * 0.15 +
      experienceScore * 0.15 +
      locationScore * 0.10 +
      projectScore * 0.05 +
      resumeScore * 0.05 +
      educationScore * 0.03 +
      freshnessScore * 0.02;

    let totalKnownWeight = 0.95; // Excludes salary 0.05 if undisclosed

    if (salaryScore !== null) {
      weightedSum += salaryScore * 0.05;
      totalKnownWeight += 0.05; // 1.00 total
    }

    // Renormalize proportionally back to 100
    const rawOverallScore = Math.round(weightedSum / totalKnownWeight);
    let overallScore = Math.max(10, Math.min(99, rawOverallScore));

    // 12. Critical Mandatory Requirement Override
    let mandatoryOverride = false;
    let recommendationReason: string | undefined;

    if (isSevereExperienceGap) {
      mandatoryOverride = true;
      recommendationReason = `Severe experience gap (${candidate.experienceYears} yrs vs ${reqMinExp}+ yrs required)`;
    } else if (normalizedReq.length > 0 && missingRequired.length > normalizedReq.length / 2) {
      mandatoryOverride = true;
      recommendationReason = 'Mandatory required skills missing';
    }

    let priority: MatchPriority = MatchPriority.POSSIBLE;
    let recommendation: 'APPLY_NOW' | 'STRONG_MATCH' | 'POSSIBLE' | 'LOW_MATCH' = 'POSSIBLE';

    if (overallScore >= 90 && !mandatoryOverride) {
      priority = MatchPriority.APPLY_NOW;
      recommendation = 'APPLY_NOW';
    } else if (overallScore >= 80 && !mandatoryOverride) {
      priority = MatchPriority.STRONG_MATCH;
      recommendation = 'STRONG_MATCH';
    } else if (overallScore >= 65) {
      priority = MatchPriority.POSSIBLE;
      recommendation = 'POSSIBLE';
    } else {
      priority = MatchPriority.LOW_MATCH;
      recommendation = 'LOW_MATCH';
    }

    // Explainable Reasonings
    const whyApply: string[] = [];
    if (matchedSkills.length > 0) {
      whyApply.push(`Direct skill alignment for: ${matchedSkills.slice(0, 3).join(', ')}`);
    }
    if (roleScore >= 80) {
      whyApply.push(`Strong role fit for ${job.title}`);
    }
    if (locationScore >= 90) {
      whyApply.push(`Compatible location setup (${job.location} / ${job.remoteType})`);
    }

    const whatHoldsBack: string[] = [];
    if (missingRequired.length > 0) {
      whatHoldsBack.push(`Missing required skills: ${missingRequired.join(', ')}`);
    }
    if (missingPreferred.length > 0) {
      whatHoldsBack.push(`Missing preferred skills: ${missingPreferred.join(', ')}`);
    }
    if (risks.length > 0) {
      whatHoldsBack.push(risks[0]);
    }

    return {
      overallScore,
      priority,
      breakdown: {
        skillScore: requiredSkillScore,
        requiredSkillScore,
        preferredSkillScore,
        roleScore,
        experienceScore,
        locationScore,
        salaryScore,
        educationScore,
        projectScore,
        resumeScore,
        freshnessScore
      },
      matchedSkills,
      partialSkills,
      missingSkills: {
        required: missingRequired,
        preferred: missingPreferred
      },
      transferableSkills,
      freshnessLabel,
      risks,
      whyApply: whyApply.length > 0 ? whyApply : ['Role posted recently'],
      whatHoldsBack: whatHoldsBack.length > 0 ? whatHoldsBack : ['High competition expected'],
      recommendation,
      recommendationReason
    };
  }
}

export const advancedMatchingEngine = new AdvancedJobMatchingEngine();

import { MatchPriority, RemotePreference } from '@jobhunter/types';

// 1. Maintainable Synonym Dictionary
export const SKILL_SYNONYMS: Record<string, string> = {
  'js': 'JavaScript',
  'javascript': 'JavaScript',
  'ts': 'TypeScript',
  'typescript': 'TypeScript',
  'react': 'React.js',
  'reactjs': 'React.js',
  'react.js': 'React.js',
  'node': 'Node.js',
  'nodejs': 'Node.js',
  'node.js': 'Node.js',
  'express': 'Express.js',
  'expressjs': 'Express.js',
  'postgres': 'PostgreSQL',
  'postgresql': 'PostgreSQL',
  'mongo': 'MongoDB',
  'mongodb': 'MongoDB',
  'rest': 'REST API',
  'restful': 'REST API',
  'rest api': 'REST API',
  'aws': 'AWS',
  'amazon web services': 'AWS',
  'py': 'Python',
  'python': 'Python'
};

// 2. Transferable Skill Category Groups for Partial Credit Matching
export const TRANSFERABLE_CATEGORIES: Record<string, string[]> = {
  'databases': ['PostgreSQL', 'MySQL', 'MongoDB', 'SQL', 'SQLite', 'Oracle', 'MariaDB', 'DynamoDB', 'Redis'],
  'node_frameworks': ['Node.js', 'Express.js', 'NestJS', 'Koa.js', 'Fastify'],
  'python_frameworks': ['Python', 'FastAPI', 'Django', 'Flask'],
  'java_frameworks': ['Java', 'Spring Boot', 'Spring MVC'],
  'frontend_frameworks': ['React.js', 'Vue.js', 'Angular', 'Next.js'],
  'cloud_providers': ['AWS', 'GCP', 'Azure'],
  'containerization': ['Docker', 'Kubernetes', 'Podman']
};

export function normalizeSkill(skill: string): string {
  const clean = skill.trim().toLowerCase();
  return SKILL_SYNONYMS[clean] || skill.trim();
}

export interface AdvancedMatchResult {
  overallScore: number;
  priority: MatchPriority;
  breakdown: {
    skillScore: number;
    roleScore: number;
    experienceScore: number;
    locationScore: number;
    salaryScore: number;
    educationScore: number;
    projectScore: number;
    resumeScore: number;
    freshnessScore: number;
  };
  matchedSkills: string[];
  partialSkills: Array<{ jobSkill: string; candidateSkill: string; reason: string }>;
  missingSkills: { required: string[]; preferred: string[] };
  transferableSkills: string[];
  risks: string[];
  whyApply: string[];
  whatHoldsBack: string[];
  recommendation: 'APPLY_NOW' | 'STRONG_MATCH' | 'POSSIBLE' | 'LOW_MATCH';
}

export class AdvancedJobMatchingEngine {
  /**
   * Advanced 0-100 fit scoring with skill normalization, mandatory skill penalties,
   * experience decay, role matrices, location preferences, freshness & recruiter bonuses.
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
      postedAt?: string | Date;
      hasRecruiter?: boolean;
    }
  ): AdvancedMatchResult {
    // A. Normalize Skills
    const normalizedReq = job.requiredSkills.map(normalizeSkill);
    const normalizedPref = job.preferredSkills.map(normalizeSkill);

    const candSkillMap = new Map<string, { years: number; proficiency: string }>();
    candidate.skills.forEach(s => {
      candSkillMap.set(normalizeSkill(s.name).toLowerCase(), {
        years: s.yearsExperience,
        proficiency: s.proficiencyLevel
      });
    });

    // B. Skill Matching & Transferable Analysis
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
        // Check for Transferable Skill in same category
        let foundTransferable = false;
        for (const [catName, catSkills] of Object.entries(TRANSFERABLE_CATEGORIES)) {
          if (catSkills.some(cs => cs.toLowerCase() === key)) {
            // Find if candidate has ANY skill in this category
            const candHasCatSkill = catSkills.find(cs => candSkillMap.has(cs.toLowerCase()));
            if (candHasCatSkill) {
              partialSkills.push({
                jobSkill: reqSkill,
                candidateSkill: candHasCatSkill,
                reason: `Related ${catName} background (${candHasCatSkill}) provides partial credit`
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

    normalizedPref.forEach(prefSkill => {
      const key = prefSkill.toLowerCase();
      if (candSkillMap.has(key)) {
        matchedSkills.push(prefSkill);
      } else {
        missingPreferred.push(prefSkill);
      }
    });

    // 1. Skill Score (Max 100, heavy penalty for missing mandatory required skills)
    const reqTotal = normalizedReq.length;
    let baseSkillScore = 85;

    if (reqTotal > 0) {
      const effectiveMatched = requiredMatchedCount + requiredPartialCount;
      baseSkillScore = Math.round((effectiveMatched / reqTotal) * 100);
    }

    // Mandatory Skill Penalty: If candidate is missing ALL required skills or major mandatory skills
    let skillPenalty = 0;
    if (missingRequired.length > 0) {
      if (missingRequired.length === reqTotal) {
        skillPenalty = 40; // Heavy penalty if 0 required skills match
      } else {
        skillPenalty = missingRequired.length * 12;
      }
    }
    const skillScore = Math.max(10, Math.min(100, baseSkillScore - skillPenalty));

    // 2. Role Score
    const titleLower = job.title.toLowerCase();
    const allRoles = [...candidate.targetRoles, ...(candidate.secondaryRoles || [])];
    let roleScore = 60;

    if (candidate.targetRoles.some(tr => titleLower.includes(tr.toLowerCase()) || tr.toLowerCase().includes(titleLower))) {
      roleScore = 95; // Direct target role match
    } else if (candidate.secondaryRoles?.some(sr => titleLower.includes(sr.toLowerCase()) || sr.toLowerCase().includes(titleLower))) {
      roleScore = 82; // Secondary role match
    } else if (titleLower.includes('software engineer') || titleLower.includes('developer')) {
      roleScore = 75; // Related engineering role
    }

    // 3. Experience Score & Mismatch Penalty
    const reqMinExp = job.experienceMin ?? 0;
    const reqMaxExp = job.experienceMax ?? 5;
    let experienceScore = 90;
    const risks: string[] = [];

    if (candidate.experienceYears < reqMinExp) {
      const diff = reqMinExp - candidate.experienceYears;
      if (diff >= 4) {
        experienceScore = 30; // Severe mismatch (1 yr vs 5+ yr role)
        risks.push(`Candidate has ${candidate.experienceYears} yr experience, but position requires ${reqMinExp}+ yrs`);
      } else {
        experienceScore = Math.max(45, Math.round(90 - diff * 20));
        risks.push(`Experience (${candidate.experienceYears} yrs) below minimum requirement (${reqMinExp} yrs)`);
      }
    } else if (candidate.experienceYears > reqMaxExp + 3) {
      experienceScore = 78; // Overqualified
    }

    // 4. Location & Remote Matching Score
    let locationScore = 75;
    const jobLocLower = job.location.toLowerCase();

    if (job.remoteType === RemotePreference.REMOTE || candidate.remotePref === RemotePreference.REMOTE) {
      locationScore = 100;
    } else if (candidate.preferredLocations.some(pl => jobLocLower.includes(pl.toLowerCase()))) {
      locationScore = 95;
    } else if (jobLocLower.includes('noida') || jobLocLower.includes('gurgaon') || jobLocLower.includes('delhi')) {
      locationScore = 85; // Regional NCR match
    } else {
      risks.push(`Job location (${job.location}) does not match candidate preferred cities`);
    }

    // 5. Salary Score
    const salaryScore = 85;
    // 6. Education Score
    const educationScore = 90;
    // 7. Project Score
    const projectScore = Math.min(100, Math.round(skillScore * 0.9 + 10));
    // 8. Resume Score
    const resumeScore = Math.min(100, Math.round(skillScore * 0.95 + 5));

    // 9. Job Freshness Score
    let freshnessScore = 70;
    if (job.postedAt) {
      const postedDate = new Date(job.postedAt).getTime();
      const ageHours = (Date.now() - postedDate) / (1000 * 3600);
      if (ageHours <= 6) freshnessScore = 100;
      else if (ageHours <= 24) freshnessScore = 90;
      else if (ageHours <= 72) freshnessScore = 80;
      else freshnessScore = 60;
    }

    // Recruiter Bonus (no penalty if missing)
    const recruiterBonus = job.hasRecruiter ? 4 : 0;

    // 10. Final Weighted Overall Score Calculation
    const weightedSum = Math.round(
      skillScore * 0.35 +
      roleScore * 0.20 +
      experienceScore * 0.15 +
      locationScore * 0.10 +
      resumeScore * 0.10 +
      freshnessScore * 0.05 +
      projectScore * 0.05
    );

    const overallScore = Math.max(10, Math.min(99, weightedSum + recruiterBonus));

    let priority: MatchPriority = MatchPriority.POSSIBLE;
    let recommendation: 'APPLY_NOW' | 'STRONG_MATCH' | 'POSSIBLE' | 'LOW_MATCH' = 'POSSIBLE';

    if (overallScore >= 90) {
      priority = MatchPriority.APPLY_NOW;
      recommendation = 'APPLY_NOW';
    } else if (overallScore >= 80) {
      priority = MatchPriority.STRONG_MATCH;
      recommendation = 'STRONG_MATCH';
    } else if (overallScore >= 65) {
      priority = MatchPriority.POSSIBLE;
      recommendation = 'POSSIBLE';
    } else {
      priority = MatchPriority.LOW_MATCH;
      recommendation = 'LOW_MATCH';
    }

    // Transparent Explainability Reasoning
    const whyApply: string[] = [];
    if (matchedSkills.length > 0) {
      whyApply.push(`Direct skill alignment for core technologies: ${matchedSkills.slice(0, 3).join(', ')}`);
    }
    if (roleScore >= 80) {
      whyApply.push(`Target role fit for ${job.title}`);
    }
    if (locationScore >= 90) {
      whyApply.push(`Ideal working model & location setup (${job.location} / ${job.remoteType})`);
    }
    if (job.hasRecruiter) {
      whyApply.push(`Verified hiring recruiter contact identified for direct outreach`);
    }

    const whatHoldsBack: string[] = [];
    if (missingRequired.length > 0) {
      whatHoldsBack.push(`Missing mandatory required skills: ${missingRequired.join(', ')}`);
    }
    if (missingPreferred.length > 0) {
      whatHoldsBack.push(`Preferred skills not explicitly on profile: ${missingPreferred.join(', ')}`);
    }
    if (risks.length > 0) {
      whatHoldsBack.push(risks[0]);
    }

    return {
      overallScore,
      priority,
      breakdown: {
        skillScore,
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
      risks,
      whyApply: whyApply.length > 0 ? whyApply : ['Position posted recently with potential role alignment'],
      whatHoldsBack: whatHoldsBack.length > 0 ? whatHoldsBack : ['High applicant volume anticipated'],
      recommendation
    };
  }
}

export const advancedMatchingEngine = new AdvancedJobMatchingEngine();

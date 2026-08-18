import { JobDTO, ResumeDTO, ResumeMatchScoreDTO } from '@jobhunter/types';
import { normalizeSkillName } from '../skill/skillNormalizationService';

export interface DetailedResumeMatchExplanation {
  resumeId: string;
  resumeTitle: string;
  targetRole: string;
  matchScore: number;
  isRecommended: boolean;
  explanation: {
    matchedSkills: string[];
    partialSkills: string[];
    missingSkills: string[];
    relevantProjects: string[];
    roleAlignment: 'Strong' | 'Moderate' | 'Weak';
    recommendationReason: string;
  };
}

export class MultiResumeMatcherService {
  /**
   * Evaluate candidate's multiple resume versions against a target job position
   * returns explainable scores for all resumes, e.g.:
   * Backend Resume — 94% (Recommended)
   * Matched: Node.js, Express, SQL
   * Missing: AWS
   */
  public evaluateResumesForJob(resumes: ResumeDTO[], job: JobDTO): {
    bestMatch: DetailedResumeMatchExplanation | null;
    allMatches: DetailedResumeMatchExplanation[];
  } {
    if (!resumes || resumes.length === 0) {
      return { bestMatch: null, allMatches: [] };
    }

    const jobTitleLower = job.title.toLowerCase();
    const requiredSkillsNormalized = (job.requiredSkills || []).map(s => normalizeSkillName(s));
    const preferredSkillsNormalized = (job.preferredSkills || []).map(s => normalizeSkillName(s));

    const matches: DetailedResumeMatchExplanation[] = resumes.map(resume => {
      const resumeTitleLower = (resume.title || '').toLowerCase();
      const targetRoleLower = (resume.targetRole || resume.title || '').toLowerCase();

      // Extract and normalize skills
      const rawResumeSkills: string[] = resume.skills || resume.parsedData?.skills?.map((s: any) => s.name || s) || [];
      const resumeSkillsNormalized = rawResumeSkills.map(s => normalizeSkillName(s));

      // 1. Role Alignment (Max 35 points)
      let roleScore = 15;
      let roleAlignment: 'Strong' | 'Moderate' | 'Weak' = 'Weak';

      if (
        (jobTitleLower.includes('backend') && (resumeTitleLower.includes('backend') || targetRoleLower.includes('backend'))) ||
        (jobTitleLower.includes('full stack') && (resumeTitleLower.includes('full stack') || targetRoleLower.includes('full stack'))) ||
        (jobTitleLower.includes('frontend') && (resumeTitleLower.includes('frontend') || targetRoleLower.includes('frontend'))) ||
        (jobTitleLower.includes('ai') && (resumeTitleLower.includes('ai') || targetRoleLower.includes('ai'))) ||
        (jobTitleLower.includes('support') && (resumeTitleLower.includes('support') || targetRoleLower.includes('support')))
      ) {
        roleScore = 35;
        roleAlignment = 'Strong';
      } else if (
        (jobTitleLower.includes('full stack') && resumeTitleLower.includes('backend')) ||
        (jobTitleLower.includes('backend') && resumeTitleLower.includes('full stack')) ||
        (jobTitleLower.includes('frontend') && resumeTitleLower.includes('full stack'))
      ) {
        roleScore = 27;
        roleAlignment = 'Moderate';
      }

      // 2. Tech Skills Overlap Breakdown (Max 45 points)
      const matchedSkills: string[] = [];
      const partialSkills: string[] = [];
      const missingSkills: string[] = [];

      requiredSkillsNormalized.forEach(reqSkill => {
        if (resumeSkillsNormalized.includes(reqSkill)) {
          matchedSkills.push(reqSkill);
        } else if (resumeSkillsNormalized.some(rs => rs.includes(reqSkill) || reqSkill.includes(rs))) {
          partialSkills.push(reqSkill);
        } else {
          missingSkills.push(reqSkill);
        }
      });

      const matchedRatio = requiredSkillsNormalized.length > 0
        ? (matchedSkills.length + partialSkills.length * 0.5) / requiredSkillsNormalized.length
        : 0.8;

      const skillScore = Math.round(matchedRatio * 45);

      // 3. Relevant Projects (Max 20 points)
      const projects = (resume.projects || resume.parsedData?.projects || []).map((p: any) => p.title || p.name || 'Project');
      const keywordScore = projects.length > 0 ? 18 : 12;

      const rawTotal = roleScore + skillScore + keywordScore;
      const matchScore = Math.min(98, Math.max(40, rawTotal));

      const recommendationReason = `Highest required-skill coverage (${matchedSkills.length}/${requiredSkillsNormalized.length} skills matched) and ${roleAlignment.toLowerCase()} role alignment.`;

      return {
        resumeId: resume.id,
        resumeTitle: resume.title,
        targetRole: resume.targetRole || 'General Developer',
        matchScore,
        isRecommended: false,
        explanation: {
          matchedSkills,
          partialSkills,
          missingSkills,
          relevantProjects: projects.slice(0, 2),
          roleAlignment,
          recommendationReason
        }
      };
    });

    // Sort by matchScore descending
    matches.sort((a, b) => b.matchScore - a.matchScore);

    if (matches.length > 0) {
      matches[0].isRecommended = true;
    }

    return {
      bestMatch: matches[0] || null,
      allMatches: matches
    };
  }
}

export const multiResumeMatcher = new MultiResumeMatcherService();

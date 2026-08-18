import { JobDTO, ResumeDTO, ResumeMatchScoreDTO } from '@jobhunter/types';

export class MultiResumeMatcherService {
  /**
   * Evaluate candidate's multiple resume versions against a target job position
   * returns scores for all resumes, e.g.:
   * Backend Resume: 94% (Recommended)
   * Full Stack Resume: 87%
   * Frontend Resume: 61%
   */
  public evaluateResumesForJob(resumes: ResumeDTO[], job: JobDTO): {
    bestMatch: ResumeMatchScoreDTO | null;
    allMatches: ResumeMatchScoreDTO[];
  } {
    if (!resumes || resumes.length === 0) {
      return { bestMatch: null, allMatches: [] };
    }

    const jobTitleLower = job.title.toLowerCase();
    const jobSkillsLower = (job.requiredSkills || []).map(s => s.toLowerCase());

    const matches: ResumeMatchScoreDTO[] = resumes.map(resume => {
      const resumeTitleLower = (resume.title || '').toLowerCase();
      const targetRoleLower = (resume.targetRole || resume.title || '').toLowerCase();

      // Extract skills from resume object or parsedData
      const resumeSkills: string[] = resume.skills || resume.parsedData?.skills?.map((s: any) => s.name) || [];
      const resumeSkillsLower = resumeSkills.map(s => s.toLowerCase());

      // 1. Target Role & Title Alignment Score (Max 35 points)
      let roleScore = 15;
      if (
        (jobTitleLower.includes('backend') && (resumeTitleLower.includes('backend') || targetRoleLower.includes('backend'))) ||
        (jobTitleLower.includes('full stack') && (resumeTitleLower.includes('full stack') || targetRoleLower.includes('full stack'))) ||
        (jobTitleLower.includes('frontend') && (resumeTitleLower.includes('frontend') || targetRoleLower.includes('frontend'))) ||
        (jobTitleLower.includes('ai') && (resumeTitleLower.includes('ai') || targetRoleLower.includes('ai'))) ||
        (jobTitleLower.includes('support') && (resumeTitleLower.includes('support') || targetRoleLower.includes('support')))
      ) {
        roleScore = 35;
      } else if (jobTitleLower.includes('full stack') && resumeTitleLower.includes('backend')) {
        roleScore = 28;
      } else if (jobTitleLower.includes('backend') && resumeTitleLower.includes('full stack')) {
        roleScore = 28;
      } else if (jobTitleLower.includes('frontend') && resumeTitleLower.includes('full stack')) {
        roleScore = 25;
      }

      // 2. Tech Skills Overlap (Max 45 points)
      let matchingSkillsCount = 0;
      const matchingSkills: string[] = [];
      jobSkillsLower.forEach(js => {
        if (resumeSkillsLower.some(rs => rs.includes(js) || js.includes(rs))) {
          matchingSkillsCount++;
          matchingSkills.push(js);
        }
      });

      const skillRatio = jobSkillsLower.length > 0 ? matchingSkillsCount / jobSkillsLower.length : 0.8;
      const skillScore = Math.round(skillRatio * 45);

      // 3. Keyword / Project Alignment (Max 20 points)
      const keywordScore = resume.keywords && resume.keywords.length > 0 ? 18 : 12;

      const rawTotal = roleScore + skillScore + keywordScore;
      const matchScore = Math.min(98, Math.max(40, rawTotal));

      return {
        resumeId: resume.id,
        resumeTitle: resume.title,
        targetRole: resume.targetRole || 'General Developer',
        matchScore,
        isRecommended: false,
        keyMatchingSkills: matchingSkills
      };
    });

    // Sort by match score descending
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

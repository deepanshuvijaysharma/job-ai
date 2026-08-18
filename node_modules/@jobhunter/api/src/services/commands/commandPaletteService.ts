import { jobMatchRepository, applicationRepository } from '../../repositories/prismaRepository';
import { followUpEngineService } from '../outreach/followUpEngine';
import { dailyStrategyEngine } from '../analytics/dailyStrategyEngine';

export interface CommandResult {
  command: string;
  interpretation: string;
  matchedCount: number;
  data: any[];
}

export class CommandPaletteService {
  async executeCommand(userId: string, query: string): Promise<CommandResult> {
    const qLower = query.toLowerCase().trim();

    // Query database-backed job matches
    const dbMatches = await jobMatchRepository.findMatchesByUserId(userId);
    const validMatches = (dbMatches || []).map((m: any) => {
      const job = m.job || {};
      return {
        id: m.jobId || m.id,
        title: job.title || 'Engineer',
        companyName: job.companyName || job.company?.name || 'Company',
        location: job.location || 'Remote',
        matchScore: m.overallScore,
        postedAgo: dailyStrategyEngine.formatJobFreshness(job.postedAt || m.createdAt),
        recruiterVerified: dailyStrategyEngine.isRecruiterVerified(job.recruiters?.[0]?.recruiter),
        recruiters: job.recruiters || []
      };
    });

    validMatches.sort((a, b) => b.matchScore - a.matchScore);

    if (qLower.includes('best 20') || qLower.includes('top jobs today') || qLower.includes('apply immediately') || qLower.includes('best jobs')) {
      const top20 = validMatches.slice(0, 20);
      return {
        command: query,
        interpretation: "Filtering Top 20 highest-match opportunities from PostgreSQL match repository for immediate application.",
        matchedCount: top20.length,
        data: top20
      };
    }

    if (qLower.includes('85%') || qLower.includes('high match') || qLower.includes('>85')) {
      const highMatches = validMatches.filter(j => j.matchScore >= 85);
      return {
        command: query,
        interpretation: "Filtering all job positions with overall match score >= 85% from PostgreSQL.",
        matchedCount: highMatches.length,
        data: highMatches
      };
    }

    if (qLower.includes('recruiter') || qLower.includes('hr') || qLower.includes('hiring contact')) {
      const withRecruiter = validMatches.filter(j => j.recruiters && j.recruiters.length > 0);
      return {
        command: query,
        interpretation: "Filtering jobs with verified public recruiter contacts identified for direct outreach from PostgreSQL.",
        matchedCount: withRecruiter.length,
        data: withRecruiter
      };
    }

    if (qLower.includes('follow-up') || qLower.includes('due today')) {
      const due = await followUpEngineService.getDueFollowUps(userId);
      return {
        command: query,
        interpretation: "Querying PostgreSQL application timeline matrix for follow-up outreach due today.",
        matchedCount: due.length,
        data: due
      };
    }

    if (qLower.includes('interview') || qLower.includes('this week')) {
      const dbApps = await applicationRepository.findByUserId(userId);
      const interviews = (dbApps || []).filter(a => ['INTERVIEW_SCHEDULED', 'TECHNICAL_ROUND', 'HR_ROUND'].includes(a.status));
      return {
        command: query,
        interpretation: "Querying upcoming interviews from PostgreSQL application pipeline.",
        matchedCount: interviews.length,
        data: interviews
      };
    }

    if (qLower.includes('role') || qLower.includes('best-performing')) {
      const roleStats = await dailyStrategyEngine.getRolePerformance(userId);
      return {
        command: query,
        interpretation: "Querying database-backed role yield analytics.",
        matchedCount: roleStats.length,
        data: roleStats
      };
    }

    // Default fallback database natural language search
    const filtered = validMatches.filter(j => 
      j.title.toLowerCase().includes(qLower) || 
      j.companyName.toLowerCase().includes(qLower)
    );

    return {
      command: query,
      interpretation: `Executed database natural language search for query "${query}".`,
      matchedCount: filtered.length,
      data: filtered
    };
  }
}

export const commandPaletteService = new CommandPaletteService();

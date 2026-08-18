import { JobSearchQuery, JobSourceAdapter, RawJobData } from './sources/jobSourceAdapter';
import { companyCareerAdapter } from './sources/companyCareerAdapter';
import { greenhouseAdapter } from './sources/greenhouseAdapter';
import { leverAdapter } from './sources/leverAdapter';
import { deduplicationService } from './jobIngestionService';
import { advancedMatchingEngine } from './advancedMatchingEngine';
import { memoryStore } from '../store';
import { JobDTO, RemotePreference } from '@jobhunter/types';
import { jobRepository } from '../../repositories/prismaRepository';

export interface JobNotification {
  id: string;
  userId: string;
  jobId: string;
  title: string;
  companyName: string;
  matchScore: number;
  message: string;
  createdAt: string;
}

export interface SourceHealthStatus {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  priority: number;
  status: 'Healthy' | 'Degraded' | 'Disabled';
  lastAttempt?: string;
  lastSuccess?: string;
  lastError?: string;
  lastErrorMessage?: string;
  consecutiveFailures: number;
  jobsDiscoveredCount: number;
}

export class JobDiscoveryManager {
  private adapters: JobSourceAdapter[] = [];
  public notifications: JobNotification[] = [];
  private healthStats = new Map<string, SourceHealthStatus>();

  constructor() {
    // Register adapters in strict priority order per Section 3:
    // Priority 1: Company Career Page
    // Priority 2: Greenhouse Public Board
    // Priority 3: Lever Public Board
    this.registerAdapter(companyCareerAdapter);
    this.registerAdapter(greenhouseAdapter);
    this.registerAdapter(leverAdapter);
  }

  public registerAdapter(adapter: JobSourceAdapter) {
    this.adapters.push(adapter);
    this.adapters.sort((a, b) => a.priority - b.priority);

    this.healthStats.set(adapter.id, {
      id: adapter.id,
      name: adapter.name,
      type: adapter.type,
      enabled: adapter.enabled,
      priority: adapter.priority,
      status: adapter.enabled ? 'Healthy' : 'Disabled',
      consecutiveFailures: 0,
      jobsDiscoveredCount: 0
    });
  }

  public getSourceHealth(): SourceHealthStatus[] {
    return Array.from(this.healthStats.values());
  }

  /**
   * Continuous Discovery Pipeline:
   * 1. Query registered adapters by priority
   * 2. Normalize & deduplicate jobs
   * 3. Calculate candidate match score
   * 4. Save to database / store
   * 5. Generate High Match Notifications for 90%+ match jobs
   */
  public async discoverAndProcessJobs(userId: string, query: JobSearchQuery): Promise<{
    discoveredCount: number;
    newJobs: JobDTO[];
    notifications: JobNotification[];
    sourceHealth: SourceHealthStatus[];
  }> {
    const profile = memoryStore.profiles.get(userId);
    const candidateData = profile ? {
      targetRoles: profile.targetRoles || ['Backend Developer'],
      secondaryRoles: profile.secondaryRoles || [],
      experienceYears: profile.experienceYears || 2.5,
      skills: profile.skills || [],
      preferredLocations: profile.preferredLocations || ['Noida'],
      remotePref: profile.remotePref || RemotePreference.HYBRID
    } : {
      targetRoles: ['Backend Developer'],
      secondaryRoles: ['Full Stack Developer'],
      experienceYears: 2.5,
      skills: [
        { name: 'Node.js', yearsExperience: 2.5, proficiencyLevel: 'STRONG' as const },
        { name: 'Express.js', yearsExperience: 2.5, proficiencyLevel: 'STRONG' as const },
        { name: 'SQL', yearsExperience: 2.0, proficiencyLevel: 'INTERMEDIATE' as const }
      ],
      preferredLocations: ['Noida', 'Remote'],
      remotePref: RemotePreference.HYBRID
    };

    const newJobs: JobDTO[] = [];
    const newNotifications: JobNotification[] = [];

    // Query adapters in priority order
    for (const adapter of this.adapters) {
      if (!adapter.enabled) continue;

      const health = this.healthStats.get(adapter.id)!;
      health.lastAttempt = new Date().toISOString();

      try {
        const rawJobs = await adapter.search(query);
        health.lastSuccess = new Date().toISOString();
        health.consecutiveFailures = 0;
        health.status = 'Healthy';

        for (const raw of rawJobs) {
          const statusCheck = deduplicationService.checkJobStatus(raw as any);
          
          if (statusCheck.isDuplicate && !statusCheck.isUpdated) {
            // Already seen and unchanged
            continue;
          }

          const jobId = statusCheck.existingId || `job-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

          // Advanced Job Match Calculation
          const matchResult = advancedMatchingEngine.calculateMatch(candidateData, {
            title: raw.title,
            companyName: raw.companyName,
            location: raw.location,
            remoteType: raw.remoteType,
            description: raw.description,
            requiredSkills: raw.requiredSkills,
            preferredSkills: raw.preferredSkills,
            experienceMin: raw.experienceMin,
            experienceMax: raw.experienceMax,
            postedAt: raw.postedAt,
            hasRecruiter: !!raw.recruiterInfo
          });

          const jobDto: JobDTO = {
            id: jobId,
            title: raw.title,
            companyId: `comp-${raw.companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
            companyName: raw.companyName,
            source: raw.source,
            canonicalUrl: raw.canonicalUrl,
            applicationUrl: raw.applicationUrl,
            location: raw.location,
            remoteType: raw.remoteType,
            description: raw.description,
            requiredSkills: raw.requiredSkills,
            preferredSkills: raw.preferredSkills,
            postedAt: typeof raw.postedAt === 'string' ? raw.postedAt : (raw.postedAt?.toISOString() || new Date().toISOString()),
            recruiters: raw.recruiterInfo ? [{
              id: `rec-${Date.now()}`,
              companyId: `comp-${raw.companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
              name: raw.recruiterInfo.name,
              role: raw.recruiterInfo.role,
              email: raw.recruiterInfo.email,
              linkedinUrl: raw.recruiterInfo.linkedinUrl,
              isVerified: true,
              confidence: 0.92,
              source: raw.source
            }] : undefined
          };

          // Save Job & Match in memoryStore & PostgreSQL
          memoryStore.jobs.set(jobId, jobDto);
          memoryStore.matches.set(`${userId}_${jobId}`, {
            overallScore: matchResult.overallScore,
            priority: matchResult.priority,
            breakdown: {
              skillMatch: matchResult.breakdown.requiredSkillScore,
              experienceMatch: matchResult.breakdown.experienceScore,
              roleMatch: matchResult.breakdown.roleScore,
              locationMatch: matchResult.breakdown.locationScore,
              salaryMatch: matchResult.breakdown.salaryScore ?? 85,
              educationMatch: matchResult.breakdown.educationScore,
              resumeKeywordMatch: matchResult.breakdown.resumeScore,
              projectMatch: matchResult.breakdown.projectScore
            },
            whyApply: matchResult.whyApply,
            whatHoldsBack: matchResult.whatHoldsBack
          });

          // Async persist to PostgreSQL if DB available
          jobRepository.upsertJob(jobDto).catch(() => {/* Ignore DB offline */});

          health.jobsDiscoveredCount += 1;
          newJobs.push({
            ...jobDto,
            matchScore: memoryStore.matches.get(`${userId}_${jobId}`)
          });

          // Generate High Match Alert for 90%+ jobs
          if (matchResult.overallScore >= 90) {
            const notif: JobNotification = {
              id: `notif-${Date.now()}-${newNotifications.length}`,
              userId,
              jobId,
              title: raw.title,
              companyName: raw.companyName,
              matchScore: matchResult.overallScore,
              message: `🔥 New ${matchResult.overallScore}% match job at ${raw.companyName} (${raw.title})`,
              createdAt: new Date().toISOString()
            };
            this.notifications.unshift(notif);
            newNotifications.push(notif);
          }
        }
      } catch (err) {
        health.lastError = new Date().toISOString();
        health.lastErrorMessage = (err as Error).message;
        health.consecutiveFailures += 1;
        if (health.consecutiveFailures >= 3) {
          health.status = 'Degraded';
        }
        console.warn(`Error running job discovery adapter ${adapter.name}:`, err);
      }
    }

    return {
      discoveredCount: newJobs.length,
      newJobs,
      notifications: newNotifications,
      sourceHealth: this.getSourceHealth()
    };
  }
}

export const jobDiscoveryManager = new JobDiscoveryManager();

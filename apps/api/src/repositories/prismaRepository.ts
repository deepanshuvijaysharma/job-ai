import { prisma } from '@jobhunter/database';
import { 
  ApplicationStatus, 
  CandidateProfileDTO, 
  JobDTO, 
  JobMatchDTO, 
  MatchPriority, 
  RecruiterDTO, 
  RemotePreference, 
  ResumeDTO, 
  UserDTO 
} from '@jobhunter/types';
import { memoryStore } from '../services/store';

export const persistentJobCache = new Map<string, JobDTO>();
export const persistentAppCache = new Map<string, any>();

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://postgres:postgrespassword@localhost:5432/jobhunter_db?schema=public";
}

const executeWithFastTimeout = async <T>(prismaFn: () => Promise<T>): Promise<T> => {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Prisma offline timeout')), 150);
  });

  try {
    const res = await Promise.race([prismaFn(), timeout]);
    clearTimeout(timer!);
    return res;
  } catch (err) {
    clearTimeout(timer!);
    throw err;
  }
};

// ==========================================
// 1. User Repository
// ==========================================
export class UserRepository {
  async findById(id: string) {
    try {
      return await executeWithFastTimeout(() => prisma.user.findUnique({ where: { id } }));
    } catch {
      return memoryStore.users.get(id) || null;
    }
  }

  async findByEmail(email: string) {
    try {
      return await executeWithFastTimeout(() => prisma.user.findUnique({ where: { email } }));
    } catch {
      return memoryStore.users.get(email) || null;
    }
  }

  async create(data: { email: string; name: string; passwordHash?: string }) {
    const user: UserDTO & { passwordHash: string } = {
      id: `user-${Date.now()}`,
      email: data.email,
      name: data.name,
      role: 'USER',
      createdAt: new Date().toISOString(),
      passwordHash: data.passwordHash || ''
    };
    memoryStore.users.set(user.id, user);
    memoryStore.users.set(user.email, user);

    try {
      return await executeWithFastTimeout(() => prisma.user.create({ data: { email: data.email, name: data.name, passwordHash: data.passwordHash, role: 'USER' } }));
    } catch {
      return user;
    }
  }
}

// ==========================================
// 2. Candidate Profile Repository
// ==========================================
export class ProfileRepository {
  async findByUserId(userId: string) {
    try {
      const p = await executeWithFastTimeout(() => prisma.candidateProfile.findUnique({
        where: { userId },
        include: { skills: { include: { skill: true } } }
      }));
      if (p) return p;
    } catch {}
    return memoryStore.profiles.get(userId) || null;
  }

  async upsert(userId: string, profileData: Partial<CandidateProfileDTO>) {
    const existing: CandidateProfileDTO = memoryStore.profiles.get(userId) || {
      id: `profile-${Date.now()}`,
      userId,
      phone: '',
      location: '',
      preferredLocations: [],
      remotePref: RemotePreference.ANY,
      experienceYears: 0,
      currentRole: '',
      targetRoles: [],
      certifications: [],
      skills: []
    };

    const updated: CandidateProfileDTO = {
      ...existing,
      ...profileData,
      certifications: profileData.certifications || existing.certifications || [],
      skills: profileData.skills || existing.skills || [],
      userId
    };
    memoryStore.profiles.set(userId, updated);

    try {
      return await executeWithFastTimeout(() => prisma.candidateProfile.upsert({
        where: { userId },
        create: {
          userId,
          phone: profileData.phone,
          location: profileData.location,
          preferredLocations: profileData.preferredLocations || [],
          remotePref: (profileData.remotePref as any) || RemotePreference.ANY,
          experienceYears: profileData.experienceYears || 0,
          currentRole: profileData.currentRole,
          targetRoles: profileData.targetRoles || [],
          salaryMin: profileData.salaryMin,
          salaryMax: profileData.salaryMax,
          noticePeriodDays: profileData.noticePeriodDays || 30,
          githubUrl: profileData.githubUrl,
          portfolioUrl: profileData.portfolioUrl,
          linkedinUrl: profileData.linkedinUrl,
          naukriUrl: profileData.naukriUrl,
          projects: (profileData.projects as any) || undefined,
          workExperience: (profileData.workExperience as any) || undefined
        },
        update: {
          phone: profileData.phone,
          location: profileData.location,
          preferredLocations: profileData.preferredLocations,
          remotePref: (profileData.remotePref as any),
          experienceYears: profileData.experienceYears,
          currentRole: profileData.currentRole,
          targetRoles: profileData.targetRoles,
          salaryMin: profileData.salaryMin,
          salaryMax: profileData.salaryMax,
          noticePeriodDays: profileData.noticePeriodDays,
          githubUrl: profileData.githubUrl,
          portfolioUrl: profileData.portfolioUrl,
          linkedinUrl: profileData.linkedinUrl,
          naukriUrl: profileData.naukriUrl,
          projects: (profileData.projects as any),
          workExperience: (profileData.workExperience as any)
        }
      }));
    } catch {
      return updated;
    }
  }
}

// ==========================================
// 3. Resume Repository
// ==========================================
export class ResumeRepository {
  async findByUserId(userId: string) {
    try {
      const dbResumes = await executeWithFastTimeout(() => prisma.resume.findMany({ where: { userId } }));
      if (dbResumes.length > 0) return dbResumes;
    } catch {}
    return memoryStore.resumes.get(userId) || [];
  }

  async create(data: { userId: string; title: string; fileUrl: string; fileType: string; rawText?: string; parsedData?: any }) {
    const resumeDTO: ResumeDTO = {
      id: `res-${Date.now()}`,
      userId: data.userId,
      title: data.title,
      fileUrl: data.fileUrl,
      fileType: data.fileType,
      rawText: data.rawText,
      parsedData: data.parsedData,
      isDefault: false,
      createdAt: new Date().toISOString()
    };

    const existingList = memoryStore.resumes.get(data.userId) || [];
    existingList.push(resumeDTO);
    memoryStore.resumes.set(data.userId, existingList);

    try {
      return await executeWithFastTimeout(() => prisma.resume.create({
        data: {
          userId: data.userId,
          title: data.title,
          fileUrl: data.fileUrl,
          fileType: data.fileType,
          rawText: data.rawText,
          parsedData: data.parsedData || undefined
        }
      }));
    } catch {
      return resumeDTO;
    }
  }
}

// ==========================================
// 4. Job & Deduplication Repository
// ==========================================
export class JobRepository {
  async findById(id: string) {
    try {
      const dbJob = await executeWithFastTimeout(() => prisma.job.findUnique({
        where: { id },
        include: { company: true, source: true, recruiters: { include: { recruiter: true } } }
      }));
      if (dbJob) return dbJob;
    } catch {}
    return memoryStore.jobs.get(id) || persistentJobCache.get(id) || null;
  }

  async findByCanonicalUrl(canonicalUrl: string) {
    try {
      const dbJob = await executeWithFastTimeout(() => prisma.job.findUnique({ where: { canonicalUrl } }));
      if (dbJob) return dbJob;
    } catch {}
    return Array.from(memoryStore.jobs.values()).find(j => j.canonicalUrl === canonicalUrl) || persistentJobCache.get(canonicalUrl) || null;
  }

  async findAll() {
    try {
      const dbJobs = await executeWithFastTimeout(() => prisma.job.findMany({
        include: { company: true, source: true, recruiters: { include: { recruiter: true } } }
      }));
      if (dbJobs.length > 0) return dbJobs;
    } catch {}
    return Array.from(memoryStore.jobs.values());
  }

  async upsertJob(jobData: JobDTO) {
    memoryStore.jobs.set(jobData.id, jobData);
    persistentJobCache.set(jobData.id, jobData);
    if (jobData.canonicalUrl) {
      persistentJobCache.set(jobData.canonicalUrl, jobData);
    }

    try {
      const company = await executeWithFastTimeout(() => prisma.company.upsert({
        where: { id: jobData.companyId || `comp-${jobData.companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}` },
        create: {
          id: jobData.companyId || `comp-${jobData.companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
          name: jobData.companyName
        },
        update: { name: jobData.companyName }
      }));

      const source = await executeWithFastTimeout(() => prisma.jobSource.upsert({
        where: { name: jobData.source || 'Direct Import' },
        create: { name: jobData.source || 'Direct Import' },
        update: {}
      }));

      return await executeWithFastTimeout(() => prisma.job.upsert({
        where: { canonicalUrl: jobData.canonicalUrl },
        create: {
          id: jobData.id,
          title: jobData.title,
          companyId: company.id,
          sourceId: source.id,
          canonicalUrl: jobData.canonicalUrl,
          applicationUrl: jobData.applicationUrl,
          location: jobData.location,
          remoteType: (jobData.remoteType as any) || RemotePreference.ANY,
          salaryMin: jobData.salaryMin,
          salaryMax: jobData.salaryMax,
          experienceMin: jobData.experienceMin,
          experienceMax: jobData.experienceMax,
          description: jobData.description,
          requiredSkills: jobData.requiredSkills || [],
          preferredSkills: jobData.preferredSkills || []
        },
        update: {
          title: jobData.title,
          description: jobData.description,
          requiredSkills: jobData.requiredSkills || [],
          preferredSkills: jobData.preferredSkills || []
        }
      }));
    } catch {
      return jobData;
    }
  }
}

// ==========================================
// 5. Job Match Repository
// ==========================================
export class JobMatchRepository {
  async upsertMatch(match: { userId: string; jobId: string; matchData: JobMatchDTO }) {
    memoryStore.matches.set(`${match.userId}_${match.jobId}`, match.matchData);

    try {
      return await executeWithFastTimeout(() => prisma.jobMatch.upsert({
        where: { userId_jobId: { userId: match.userId, jobId: match.jobId } },
        create: {
          userId: match.userId,
          jobId: match.jobId,
          overallScore: match.matchData.overallScore,
          priority: (match.matchData.priority as any) || MatchPriority.STRONG_MATCH,
          skillMatch: match.matchData.breakdown.skillMatch,
          experienceMatch: match.matchData.breakdown.experienceMatch,
          roleMatch: match.matchData.breakdown.roleMatch,
          locationMatch: match.matchData.breakdown.locationMatch,
          salaryMatch: match.matchData.breakdown.salaryMatch,
          educationMatch: match.matchData.breakdown.educationMatch,
          resumeKeywordMatch: match.matchData.breakdown.resumeKeywordMatch,
          projectMatch: match.matchData.breakdown.projectMatch,
          whyApply: match.matchData.whyApply || [],
          whatHoldsBack: match.matchData.whatHoldsBack || [],
          recommendedResumeId: match.matchData.recommendedResumeId
        },
        update: {
          overallScore: match.matchData.overallScore,
          priority: (match.matchData.priority as any),
          skillMatch: match.matchData.breakdown.skillMatch,
          experienceMatch: match.matchData.breakdown.experienceMatch,
          roleMatch: match.matchData.breakdown.roleMatch,
          whyApply: match.matchData.whyApply || []
        }
      }));
    } catch {
      return match.matchData;
    }
  }
}

// ==========================================
// 6. Application & Transactional Event Repository
// ==========================================
export class ApplicationRepository {
  async findByUserId(userId: string) {
    try {
      const dbApps = await executeWithFastTimeout(() => prisma.application.findMany({
        where: { userId },
        include: { job: { include: { company: true } }, events: true }
      }));
      if (dbApps.length > 0) return dbApps;
    } catch {}

    const storeApps = Array.from(memoryStore.applications.values()).filter(a => a.userId === userId);
    if (storeApps.length > 0) return storeApps;
    return Array.from(persistentAppCache.values()).filter(a => a.userId === userId);
  }

  async upsertStatusWithTransaction(userId: string, jobId: string, status: ApplicationStatus, note?: string) {
    const existing = memoryStore.applications.get(`${userId}_${jobId}`) || memoryStore.applications.get(jobId);
    const appRecord = {
      id: existing?.id || `app-${Date.now()}`,
      userId,
      jobId,
      status,
      qualityScore: existing?.qualityScore || 90,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    memoryStore.applications.set(`${userId}_${jobId}`, appRecord);
    memoryStore.applications.set(appRecord.id, appRecord);
    persistentAppCache.set(`${userId}_${jobId}`, appRecord);
    persistentAppCache.set(appRecord.id, appRecord);

    try {
      return await executeWithFastTimeout(() => prisma.$transaction(async (tx) => {
        const existingDb = await tx.application.findUnique({
          where: { userId_jobId: { userId, jobId } }
        });

        const app = await tx.application.upsert({
          where: { userId_jobId: { userId, jobId } },
          create: {
            userId,
            jobId,
            status,
            appliedAt: status === ApplicationStatus.APPLIED ? new Date() : undefined
          },
          update: {
            status,
            updatedAt: new Date()
          }
        });

        await tx.applicationEvent.create({
          data: {
            applicationId: app.id,
            fromStatus: existingDb?.status,
            toStatus: status,
            note: note || `Status updated to ${status}`
          }
        });

        return app;
      }));
    } catch {
      return appRecord;
    }
  }
}

// ==========================================
// 7. Recruiter Repository
// ==========================================
export class RecruiterRepository {
  async upsert(recruiter: RecruiterDTO) {
    try {
      return await prisma.recruiter.create({
        data: {
          id: recruiter.id,
          companyId: recruiter.companyId,
          name: recruiter.name,
          role: recruiter.role,
          linkedinUrl: recruiter.linkedinUrl,
          email: recruiter.email,
          isVerified: recruiter.isVerified,
          confidence: recruiter.confidence,
          source: recruiter.source
        }
      });
    } catch {
      return null;
    }
  }
}

// ==========================================
// 8. Follow-up Repository
// ==========================================
export class FollowUpRepository {
  async findByApplicationId(applicationId: string) {
    try {
      return await prisma.followUp.findMany({ where: { applicationId } });
    } catch {
      return [];
    }
  }

  async create(data: { applicationId: string; scheduledFor: Date; stepNumber: number; suggestedBody?: string }) {
    try {
      return await prisma.followUp.create({
        data: {
          applicationId: data.applicationId,
          scheduledFor: data.scheduledFor,
          stepNumber: data.stepNumber,
          suggestedBody: data.suggestedBody
        }
      });
    } catch {
      return null;
    }
  }
}

// Export singleton repository instances
export const userRepository = new UserRepository();
export const profileRepository = new ProfileRepository();
export const resumeRepository = new ResumeRepository();
export const jobRepository = new JobRepository();
export const jobMatchRepository = new JobMatchRepository();
export const applicationRepository = new ApplicationRepository();
export const recruiterRepository = new RecruiterRepository();
export const followUpRepository = new FollowUpRepository();

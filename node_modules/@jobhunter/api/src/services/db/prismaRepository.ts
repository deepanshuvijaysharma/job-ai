import { prisma } from '@jobhunter/database';
import { ApplicationStatus, MatchPriority, RemotePreference } from '@jobhunter/types';
import { memoryStore } from '../store';

export class PrismaRepository {
  private isPrismaAvailable = false;

  constructor() {
    this.checkDatabaseConnection();
  }

  private async checkDatabaseConnection() {
    if (process.env.DATABASE_URL) {
      try {
        await prisma.$queryRaw`SELECT 1`;
        this.isPrismaAvailable = true;
      } catch (err) {
        console.warn('PostgreSQL database unattached, using in-memory persistent store.');
        this.isPrismaAvailable = false;
      }
    }
  }

  // 1. User CRUD & Authentication Persistence
  async createUser(data: { email: string; name: string; passwordHash: string }) {
    if (this.isPrismaAvailable) {
      return prisma.user.create({
        data: {
          email: data.email,
          name: data.name,
          passwordHash: data.passwordHash
        }
      });
    }

    const id = `usr-${Date.now()}`;
    const userObj = {
      id,
      email: data.email,
      name: data.name,
      role: 'USER',
      passwordHash: data.passwordHash,
      createdAt: new Date().toISOString()
    };
    memoryStore.users.set(id, userObj);
    memoryStore.users.set(data.email, userObj);
    return userObj;
  }

  async findUserByEmail(email: string) {
    if (this.isPrismaAvailable) {
      return prisma.user.findUnique({ where: { email } });
    }
    return memoryStore.users.get(email) || null;
  }

  // 2. Candidate Profile & Resume Persistence
  async upsertProfile(userId: string, profileData: any) {
    if (this.isPrismaAvailable) {
      return prisma.candidateProfile.upsert({
        where: { userId },
        update: {
          phone: profileData.phone,
          location: profileData.location,
          preferredLocations: profileData.preferredLocations || [],
          experienceYears: profileData.experienceYears || 0,
          currentRole: profileData.currentRole,
          targetRoles: profileData.targetRoles || [],
          salaryMin: profileData.salaryMin,
          salaryMax: profileData.salaryMax,
          noticePeriodDays: profileData.noticePeriodDays,
          aiProfileAnalysis: profileData.aiProfileAnalysis
        },
        create: {
          userId,
          phone: profileData.phone,
          location: profileData.location,
          preferredLocations: profileData.preferredLocations || [],
          experienceYears: profileData.experienceYears || 0,
          currentRole: profileData.currentRole,
          targetRoles: profileData.targetRoles || [],
          salaryMin: profileData.salaryMin,
          salaryMax: profileData.salaryMax,
          noticePeriodDays: profileData.noticePeriodDays,
          aiProfileAnalysis: profileData.aiProfileAnalysis
        }
      });
    }

    const existing = memoryStore.profiles.get(userId) || { id: `prof-${userId}`, userId };
    const updated = { ...existing, ...profileData, userId };
    memoryStore.profiles.set(userId, updated);
    return updated;
  }

  async getProfile(userId: string) {
    if (this.isPrismaAvailable) {
      return prisma.candidateProfile.findUnique({
        where: { userId },
        include: { skills: { include: { skill: true } } }
      });
    }
    return memoryStore.profiles.get(userId) || null;
  }

  async createResume(userId: string, data: { title: string; fileUrl: string; fileType: string; rawText: string; parsedData?: any }) {
    if (this.isPrismaAvailable) {
      return prisma.resume.create({
        data: {
          userId,
          title: data.title,
          fileUrl: data.fileUrl,
          fileType: data.fileType,
          rawText: data.rawText,
          parsedData: data.parsedData
        }
      });
    }

    const id = `res-${Date.now()}`;
    const newResume = {
      id,
      userId,
      title: data.title,
      fileUrl: data.fileUrl,
      fileType: data.fileType,
      rawText: data.rawText,
      parsedData: data.parsedData,
      isDefault: false,
      createdAt: new Date().toISOString()
    };
    const list = memoryStore.resumes.get(userId) || [];
    list.push(newResume);
    memoryStore.resumes.set(userId, list);
    return newResume;
  }

  // 3. Job Ingestion & Match Persistence
  async createJob(jobData: any) {
    if (this.isPrismaAvailable) {
      // Ensure company exists
      let company = await prisma.company.findFirst({ where: { name: jobData.companyName } });
      if (!company) {
        company = await prisma.company.create({
          data: { name: jobData.companyName, website: jobData.companyWebsite }
        });
      }

      // Ensure source exists
      let source = await prisma.jobSource.findUnique({ where: { name: jobData.source } });
      if (!source) {
        source = await prisma.jobSource.create({
          data: { name: jobData.source }
        });
      }

      return prisma.job.create({
        data: {
          title: jobData.title,
          companyId: company.id,
          sourceId: source.id,
          canonicalUrl: jobData.canonicalUrl,
          applicationUrl: jobData.applicationUrl,
          location: jobData.location,
          remoteType: jobData.remoteType || RemotePreference.HYBRID,
          description: jobData.description,
          requiredSkills: jobData.requiredSkills || [],
          preferredSkills: jobData.preferredSkills || []
        }
      });
    }

    const id = `job-${Date.now()}`;
    const newJob = {
      id,
      title: jobData.title,
      companyId: `comp-${Date.now()}`,
      companyName: jobData.companyName,
      source: jobData.source,
      canonicalUrl: jobData.canonicalUrl,
      applicationUrl: jobData.applicationUrl,
      location: jobData.location,
      remoteType: jobData.remoteType || RemotePreference.HYBRID,
      description: jobData.description,
      requiredSkills: jobData.requiredSkills || [],
      preferredSkills: jobData.preferredSkills || [],
      postedAt: new Date().toISOString()
    };
    memoryStore.jobs.set(id, newJob);
    return newJob;
  }

  async upsertMatch(userId: string, jobId: string, matchData: any) {
    if (this.isPrismaAvailable) {
      return prisma.jobMatch.upsert({
        where: { userId_jobId: { userId, jobId } },
        update: {
          overallScore: matchData.overallScore,
          priority: matchData.priority,
          skillMatch: matchData.breakdown?.skillMatch || matchData.skillMatch || 90,
          experienceMatch: matchData.breakdown?.experienceMatch || matchData.experienceMatch || 90,
          roleMatch: matchData.breakdown?.roleMatch || matchData.roleMatch || 90,
          locationMatch: matchData.breakdown?.locationMatch || matchData.locationMatch || 90,
          salaryMatch: matchData.breakdown?.salaryMatch || matchData.salaryMatch || 85,
          educationMatch: matchData.breakdown?.educationMatch || matchData.educationMatch || 90,
          resumeKeywordMatch: matchData.breakdown?.resumeKeywordMatch || matchData.resumeKeywordMatch || 90,
          projectMatch: matchData.breakdown?.projectMatch || matchData.projectMatch || 90,
          whyApply: matchData.whyApply || [],
          whatHoldsBack: matchData.whatHoldsBack || []
        },
        create: {
          userId,
          jobId,
          overallScore: matchData.overallScore,
          priority: matchData.priority,
          skillMatch: matchData.breakdown?.skillMatch || matchData.skillMatch || 90,
          experienceMatch: matchData.breakdown?.experienceMatch || matchData.experienceMatch || 90,
          roleMatch: matchData.breakdown?.roleMatch || matchData.roleMatch || 90,
          locationMatch: matchData.breakdown?.locationMatch || matchData.locationMatch || 90,
          salaryMatch: matchData.breakdown?.salaryMatch || matchData.salaryMatch || 85,
          educationMatch: matchData.breakdown?.educationMatch || matchData.educationMatch || 90,
          resumeKeywordMatch: matchData.breakdown?.resumeKeywordMatch || matchData.resumeKeywordMatch || 90,
          projectMatch: matchData.breakdown?.projectMatch || matchData.projectMatch || 90,
          whyApply: matchData.whyApply || [],
          whatHoldsBack: matchData.whatHoldsBack || []
        }
      });
    }

    const key = `${userId}_${jobId}`;
    memoryStore.matches.set(key, matchData);
    return matchData;
  }

  // 4. Application & Outreach Persistence
  async upsertApplication(userId: string, jobId: string, status: ApplicationStatus, notes?: string) {
    if (this.isPrismaAvailable) {
      return prisma.application.upsert({
        where: { userId_jobId: { userId, jobId } },
        update: {
          status,
          notes,
          appliedAt: status === ApplicationStatus.APPLIED ? new Date() : undefined
        },
        create: {
          userId,
          jobId,
          status,
          notes,
          appliedAt: status === ApplicationStatus.APPLIED ? new Date() : undefined
        }
      });
    }

    const key = `${userId}_${jobId}`;
    let existing = memoryStore.applications.get(key);
    if (!existing) {
      existing = {
        id: `app-${Date.now()}`,
        userId,
        jobId,
        status,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notes
      };
    } else {
      existing = {
        ...existing,
        status,
        notes: notes !== undefined ? notes : existing.notes,
        appliedAt: status === ApplicationStatus.APPLIED ? new Date().toISOString() : existing.appliedAt,
        updatedAt: new Date().toISOString()
      };
    }
    memoryStore.applications.set(key, existing);
    return existing;
  }
}

export const dbRepository = new PrismaRepository();

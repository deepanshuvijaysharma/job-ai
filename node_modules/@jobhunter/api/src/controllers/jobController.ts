import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { memoryStore } from '../services/store';
import { deduplicationService, matchingEngine, RawJobData } from '../services/job/jobIngestionService';
import { jobDiscoveryManager } from '../services/job/jobDiscoveryManager';
import { MatchPriority, RemotePreference } from '@jobhunter/types';

export const getJobs = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const { search, priority, remote, location } = req.query;

  let allJobs = Array.from(memoryStore.jobs.values());

  // Attach match score for candidate
  const profile = memoryStore.profiles.get(userId);

  const jobsWithMatches = allJobs.map(job => {
    let match = memoryStore.matches.get(`${userId}_${job.id}`);
    if (!match && profile) {
      // Calculate match dynamically
      const candidateData = {
        targetRoles: profile.targetRoles,
        experienceYears: profile.experienceYears,
        skills: profile.skills,
        preferredLocations: profile.preferredLocations,
        remotePref: profile.remotePref
      };
      const rawJob: RawJobData = {
        title: job.title,
        companyName: job.companyName,
        source: job.source,
        canonicalUrl: job.canonicalUrl,
        applicationUrl: job.applicationUrl,
        location: job.location,
        remoteType: job.remoteType,
        description: job.description,
        requiredSkills: job.requiredSkills,
        preferredSkills: job.preferredSkills
      };
      // fallback synchronous attachment
    }
    return {
      ...job,
      matchScore: match
    };
  });

  let filtered = jobsWithMatches;

  if (search) {
    const q = String(search).toLowerCase();
    filtered = filtered.filter(
      j =>
        j.title.toLowerCase().includes(q) ||
        j.companyName.toLowerCase().includes(q) ||
        j.requiredSkills.some(s => s.toLowerCase().includes(q))
    );
  }

  if (priority) {
    filtered = filtered.filter(j => j.matchScore?.priority === priority);
  }

  if (remote) {
    filtered = filtered.filter(j => j.remoteType === remote);
  }

  // Sort by match score descending
  filtered.sort((a, b) => (b.matchScore?.overallScore || 0) - (a.matchScore?.overallScore || 0));

  return res.json(filtered);
};

export const getBestJobsToday = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const allJobs = Array.from(memoryStore.jobs.values());
  const jobsWithMatches = allJobs.map(job => ({
    ...job,
    matchScore: memoryStore.matches.get(`${userId}_${job.id}`)
  }));

  // Filter top priority jobs
  jobsWithMatches.sort((a, b) => (b.matchScore?.overallScore || 0) - (a.matchScore?.overallScore || 0));
  const top20 = jobsWithMatches.slice(0, 20);

  return res.json(top20);
};

export const getJobById = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const { id } = req.params;
  const job = memoryStore.jobs.get(id);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const match = memoryStore.matches.get(`${userId}_${id}`);
  return res.json({
    ...job,
    matchScore: match
  });
};

export const importJobUrl = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const { url, title, companyName, location, description, requiredSkills } = req.body;

  if (!url || !title || !companyName) {
    return res.status(400).json({ error: 'Job URL, title, and company name are required' });
  }

  const rawJob: RawJobData = {
    title,
    companyName,
    source: 'User Import',
    canonicalUrl: url,
    applicationUrl: url,
    location: location || 'Remote / Flexible',
    remoteType: RemotePreference.HYBRID,
    description: description || `Imported job position for ${title} at ${companyName}.`,
    requiredSkills: requiredSkills && Array.isArray(requiredSkills) ? requiredSkills : ['Node.js', 'TypeScript', 'REST API'],
    preferredSkills: ['PostgreSQL', 'Docker'],
    postedAt: new Date()
  };

  if (deduplicationService.isDuplicate(rawJob)) {
    return res.status(409).json({ error: 'This job opportunity has already been ingested' });
  }

  const newJobId = `job-imp-${Date.now()}`;
  const newJob = {
    id: newJobId,
    title: rawJob.title,
    companyId: `comp-${Date.now()}`,
    companyName: rawJob.companyName,
    companyLogo: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&h=100&fit=crop',
    source: rawJob.source,
    canonicalUrl: rawJob.canonicalUrl,
    applicationUrl: rawJob.applicationUrl,
    location: rawJob.location,
    remoteType: rawJob.remoteType,
    salaryMin: 800000,
    salaryMax: 1300000,
    experienceMin: 1,
    experienceMax: 3,
    description: rawJob.description,
    requiredSkills: rawJob.requiredSkills,
    preferredSkills: rawJob.preferredSkills,
    postedAt: new Date().toISOString(),
    recruiters: [
      {
        id: `rec-imp-${Date.now()}`,
        companyId: `comp-${Date.now()}`,
        name: 'Hiring Lead',
        role: 'Talent Acquisition Partner',
        linkedinUrl: 'https://linkedin.com',
        email: `hr@${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
        isVerified: true,
        confidence: 0.85,
        source: 'Public Web Page'
      }
    ]
  };

  memoryStore.jobs.set(newJobId, newJob);

  // Calculate Match Score
  const profile = memoryStore.profiles.get(userId);
  if (profile) {
    const matchCalc = await matchingEngine.calculateMatch(
      {
        targetRoles: profile.targetRoles,
        experienceYears: profile.experienceYears,
        skills: profile.skills,
        preferredLocations: profile.preferredLocations,
        remotePref: profile.remotePref
      },
      rawJob
    );

    memoryStore.matches.set(`${userId}_${newJobId}`, {
      overallScore: matchCalc.overallScore,
      priority: matchCalc.priority,
      breakdown: {
        skillMatch: matchCalc.skillMatch,
        experienceMatch: matchCalc.experienceMatch,
        roleMatch: matchCalc.roleMatch,
        locationMatch: matchCalc.locationMatch,
        salaryMatch: matchCalc.salaryMatch,
        educationMatch: matchCalc.educationMatch,
        resumeKeywordMatch: matchCalc.resumeKeywordMatch,
        projectMatch: matchCalc.projectMatch
      },
      whyApply: matchCalc.whyApply,
      whatHoldsBack: matchCalc.whatHoldsBack,
      recommendedResumeId: 'res-backend-1',
      recommendedResumeTitle: 'Backend Node.js & Database Resume'
    });
  }

  return res.status(201).json({
    job: newJob,
    matchScore: memoryStore.matches.get(`${userId}_${newJobId}`)
  });
};

export const triggerDiscovery = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const { roles, query } = req.body || {};

  const result = await jobDiscoveryManager.discoverAndProcessJobs(userId, {
    roles: roles || ['Backend Developer', 'Node.js Developer'],
    query: query || ''
  });

  return res.json(result);
};

export const getJobAlerts = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const userNotifs = jobDiscoveryManager.notifications.filter(n => n.userId === userId);
  return res.json(userNotifs);
};

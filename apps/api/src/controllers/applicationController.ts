import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { memoryStore } from '../services/store';
import { ApplicationStatus } from '@jobhunter/types';
import { multiResumeMatcher } from '../services/resume/multiResumeMatcher';

export const getApplications = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const appsMap = memoryStore.applications;

  const userApps = [];
  for (const [key, app] of appsMap.entries()) {
    if (app.userId === userId) {
      const job = memoryStore.jobs.get(app.jobId);
      if (job) {
        userApps.push({
          ...app,
          job: {
            ...job,
            matchScore: memoryStore.matches.get(`${userId}_${job.id}`)
          }
        });
      }
    }
  }

  return res.json(userApps);
};

export const updateApplicationStatus = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const { jobId, status, notes } = req.body;

  if (!jobId || !status) {
    return res.status(400).json({ error: 'jobId and status are required' });
  }

  const key = `${userId}_${jobId}`;
  let existing = memoryStore.applications.get(key);

  if (!existing) {
    existing = {
      id: `app-${Date.now()}`,
      userId,
      jobId,
      status: status as ApplicationStatus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes
    };
  } else {
    existing = {
      ...existing,
      status: status as ApplicationStatus,
      notes: notes !== undefined ? notes : existing.notes,
      appliedAt: status === ApplicationStatus.APPLIED ? new Date().toISOString() : existing.appliedAt,
      updatedAt: new Date().toISOString()
    };
  }

  memoryStore.applications.set(key, existing);
  const job = memoryStore.jobs.get(jobId);

  return res.json({
    ...existing,
    job
  });
};

export const prepareApplicationData = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const { jobId } = req.params;

  const job = memoryStore.jobs.get(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const userResumes = memoryStore.resumes.get(userId) || [];
  const profile = memoryStore.profiles.get(userId);

  // Evaluate multi-resume matching scores
  const multiMatchResult = multiResumeMatcher.evaluateResumesForJob(userResumes, job);
  const recommendedResume = multiMatchResult.bestMatch
    ? userResumes.find(r => r.id === multiMatchResult.bestMatch?.resumeId) || userResumes[0]
    : userResumes[0];

  const suggestedAnswers = [
    {
      question: 'Why are you interested in this position?',
      answer: `I am impressed by ${job.companyName}'s work in technical innovation. My expertise in ${job.requiredSkills.slice(0, 3).join(', ')} directly matches the requirements of ${job.title}, and I have built scalable microservices that align with your team's objectives.`
    },
    {
      question: 'Years of experience with Node.js and Express?',
      answer: `${profile?.experienceYears || 2.5} years of hands-on commercial and production project experience building high-throughput APIs.`
    },
    {
      question: 'What is your current notice period?',
      answer: `${profile?.noticePeriodDays || 30} days notice period, negotiable for immediate high-priority onboarding.`
    },
    {
      question: 'What are your salary expectations?',
      answer: `₹${((profile?.salaryMin || 800000) / 100000).toFixed(1)}L - ₹${((profile?.salaryMax || 1200000) / 100000).toFixed(1)}L per annum, aligned with industry standards for this level.`
    }
  ];

  return res.json({
    job,
    recommendedResume,
    allResumeMatches: multiMatchResult.allMatches,
    suggestedAnswers,
    suggestedKeywordEmphases: job.requiredSkills.concat(job.preferredSkills),
    coverLetterDraft: `Dear Hiring Team at ${job.companyName},\n\nI am writing to express my strong enthusiasm for the ${job.title} position. With my background in ${job.requiredSkills.join(', ')}, I have delivered high-performance web applications and resilient database architectures.\n\nThank you for considering my application.\n\nBest regards,\n${profile?.currentRole || 'Deepanshu Sharma'}`
  });
};

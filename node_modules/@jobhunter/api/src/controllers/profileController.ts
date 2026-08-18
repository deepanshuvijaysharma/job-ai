import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { memoryStore } from '../services/store';
import { resumeParserService } from '../services/resume/resumeParser';
import { ResumeDTO } from '@jobhunter/types';

export const getProfile = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const profile = memoryStore.profiles.get(userId);
  if (!profile) {
    return res.status(404).json({ error: 'Candidate profile not found' });
  }
  return res.json(profile);
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const existing = memoryStore.profiles.get(userId);
  if (!existing) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  const updated = { ...existing, ...req.body, userId };
  memoryStore.profiles.set(userId, updated);
  return res.json(updated);
};

export const getResumes = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const resumes = memoryStore.resumes.get(userId) || [];
  return res.json(resumes);
};

export const uploadResume = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const { title, targetRole, version, rawText } = req.body;
  if (!title || !rawText) {
    return res.status(400).json({ error: 'Resume title and content rawText are required' });
  }

  const parsed = await resumeParserService.parseResumeText(rawText, title);

  const userResumes = memoryStore.resumes.get(userId) || [];

  // Duplicate title/version check: prevent duplicate resume uploads
  const existingDuplicate = userResumes.find(r => r.title.toLowerCase().trim() === title.toLowerCase().trim());
  if (existingDuplicate) {
    existingDuplicate.rawText = rawText;
    existingDuplicate.parsedData = parsed;
    existingDuplicate.skills = parsed.skills.map(s => s.name);
    existingDuplicate.keywords = parsed.keywords;
    return res.status(200).json({
      message: 'Resume updated successfully',
      resume: existingDuplicate,
      parsed
    });
  }

  const newResume: ResumeDTO = {
    id: `res-${Date.now()}`,
    userId,
    title,
    version: version || 'v1.0',
    targetRole: targetRole || parsed.targetRoles[0] || 'Software Engineer',
    fileUrl: `/resumes/uploaded_${Date.now()}.pdf`,
    fileType: 'pdf',
    rawText,
    parsedData: parsed,
    skills: parsed.skills.map(s => s.name),
    keywords: parsed.keywords,
    projects: parsed.projects,
    isDefault: userResumes.length === 0,
    createdAt: new Date().toISOString()
  };

  userResumes.push(newResume);
  memoryStore.resumes.set(userId, userResumes);

  // Update profile AI analysis with newly extracted skills/insights
  const currentProfile = memoryStore.profiles.get(userId);
  if (currentProfile) {
    currentProfile.aiProfileAnalysis = parsed.aiProfileAnalysis;
    memoryStore.profiles.set(userId, currentProfile);
  }

  return res.status(201).json({
    resume: newResume,
    parsed
  });
};

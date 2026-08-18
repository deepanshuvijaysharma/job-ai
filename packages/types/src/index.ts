export enum RemotePreference {
  REMOTE = 'REMOTE',
  HYBRID = 'HYBRID',
  ONSITE = 'ONSITE',
  ANY = 'ANY'
}

export enum MatchPriority {
  APPLY_NOW = 'APPLY_NOW',       // 90-100%
  STRONG_MATCH = 'STRONG_MATCH', // 80-89%
  POSSIBLE = 'POSSIBLE',         // 65-79%
  LOW_MATCH = 'LOW_MATCH'        // <65%
}

export enum ApplicationStatus {
  DISCOVERED = 'DISCOVERED',
  SHORTLISTED = 'SHORTLISTED',
  APPLIED = 'APPLIED',
  RECRUITER_CONTACTED = 'RECRUITER_CONTACTED',
  RECRUITER_RESPONDED = 'RECRUITER_RESPONDED',
  INTERVIEW_SCHEDULED = 'INTERVIEW_SCHEDULED',
  TECHNICAL_ROUND = 'TECHNICAL_ROUND',
  HR_ROUND = 'HR_ROUND',
  OFFER = 'OFFER',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN'
}

export enum EmailClassification {
  RECRUITER = 'RECRUITER',
  INTERVIEW = 'INTERVIEW',
  REJECTION = 'REJECTION',
  CONFIRMATION = 'CONFIRMATION',
  ASSESSMENT = 'ASSESSMENT',
  OFFER = 'OFFER',
  SPAM = 'SPAM',
  OTHER = 'OTHER'
}

export type SkillProficiencyLevel = 'STRONG' | 'INTERMEDIATE' | 'BASIC' | 'LEARNING';

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

export interface CandidateSkillDTO {
  id?: string;
  name: string;
  category?: string;
  yearsExperience: number;
  proficiencyLevel: SkillProficiencyLevel;
}

export interface CandidateProfileDTO {
  id: string;
  userId: string;
  phone?: string;
  location?: string;
  preferredLocations: string[];
  remotePref: RemotePreference;
  experienceYears: number;
  currentRole?: string;
  targetRoles: string[];
  secondaryRoles?: string[];
  salaryMin?: number;
  salaryMax?: number;
  noticePeriodDays?: number;
  education?: Array<{ degree: string; field: string; institution: string; year?: number }>;
  certifications: string[];
  githubUrl?: string;
  portfolioUrl?: string;
  linkedinUrl?: string;
  naukriUrl?: string;
  otherProfiles?: Array<{ platform: string; url: string }>;
  skills: CandidateSkillDTO[];
  projects?: Array<{ title: string; description: string; techStack: string[]; liveUrl?: string; githubUrl?: string }>;
  workExperience?: Array<{ company: string; role: string; duration: string; description: string }>;
  aiProfileAnalysis?: {
    strongSkills: string[];
    weakSkills: string[];
    missingSkills: string[];
    marketableSkills: string[];
    competitiveRoles: string[];
    lowProbabilityRoles: string[];
  };
}

export interface ResumeDTO {
  id: string;
  userId: string;
  title: string;
  version?: string; // e.g. "v1.2"
  targetRole?: string; // e.g. "Backend Developer", "Full Stack", "AI/GenAI", "Frontend", "Support"
  fileUrl: string;
  fileType: string;
  rawText?: string;
  parsedData?: any;
  skills?: string[];
  keywords?: string[];
  projects?: Array<{ title: string; techStack: string[] }>;
  isDefault: boolean;
  createdAt: string;
}

export interface CompanyDTO {
  id: string;
  name: string;
  website?: string;
  logoUrl?: string;
  industry?: string;
  size?: string;
  knownAts?: string;
  techStack: string[];
}

export interface RecruiterDTO {
  id: string;
  companyId: string;
  name: string;
  role: string;
  linkedinUrl?: string;
  email?: string;
  emailSource?: string;
  emailVerified?: 'VERIFIED' | 'PUBLIC' | 'UNVERIFIED' | 'UNKNOWN';
  profileSource?: string;
  sourceUrl?: string;
  location?: string;
  department?: string;
  recruitingFocus?: string;
  verificationStatus?: 'VERIFIED' | 'PUBLIC' | 'UNVERIFIED' | 'NO_CONTACT';
  isVerified: boolean;
  confidence: number;
  source?: string;
  lastVerifiedAt?: string;
}

export interface JobDTO {
  id: string;
  title: string;
  companyId: string;
  companyName: string;
  companyLogo?: string;
  source: string;
  canonicalUrl: string;
  applicationUrl: string;
  location: string;
  remoteType: RemotePreference;
  salaryMin?: number;
  salaryMax?: number;
  experienceMin?: number;
  experienceMax?: number;
  description: string;
  requiredSkills: string[];
  preferredSkills: string[];
  employmentType?: string;
  postedAt: string;
  recruiters?: RecruiterDTO[];
  matchScore?: JobMatchDTO;
}

export interface ResumeMatchScoreDTO {
  resumeId: string;
  resumeTitle: string;
  targetRole: string;
  matchScore: number;
  isRecommended: boolean;
  keyMatchingSkills: string[];
}

export interface JobMatchDTO {
  overallScore: number;
  priority: MatchPriority;
  breakdown: {
    skillMatch: number;
    experienceMatch: number;
    roleMatch: number;
    locationMatch: number;
    salaryMatch: number;
    educationMatch: number;
    resumeKeywordMatch: number;
    projectMatch: number;
  };
  whyApply: string[];
  whatHoldsBack: string[];
  recommendedResumeId?: string;
  recommendedResumeTitle?: string;
  allResumesMatches?: ResumeMatchScoreDTO[];
}

export interface ApplicationDTO {
  id: string;
  userId: string;
  jobId: string;
  job: JobDTO;
  resumeId?: string;
  status: ApplicationStatus;
  appliedAt?: string;
  qualityScore?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailySummaryDTO {
  date: string;
  highMatchJobsCount: number;
  recruitersFoundCount: number;
  followUpsDueCount: number;
  watchedCompanyOpeningsCount: number;
  topJobsToday: JobDTO[];
  recommendedActions: Array<{
    id: string;
    type: 'APPLY' | 'CONTACT_RECRUITER' | 'FOLLOW_UP' | 'INTERVIEW_PREP';
    title: string;
    description: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    actionPayload?: any;
  }>;
}

export interface AnalyticsDashboardDTO {
  funnel: {
    jobsDiscovered: number;
    relevantJobs: number;
    highPriorityJobs: number;
    applications: number;
    recruiterConversations: number;
    interviews: number;
    offers: number;
  };
  metrics: {
    appToResponseRate: number;
    appToInterviewRate: number;
    outreachToResponseRate: number;
    outreachToInterviewRate: number;
  };
  yieldByRole: Array<{ role: string; applications: number; responses: number; rate: number }>;
  yieldBySource: Array<{ source: string; applications: number; interviews: number; rate: number }>;
}

export interface EmailAccountDTO {
  id: string;
  userId: string;
  provider: 'gmail' | 'outlook' | 'smtp';
  emailAddress: string;
  isDefault: boolean;
  isConnected: boolean;
  lastTestedAt?: string;
  createdAt: string;
}

export interface EmailDispatchLogDTO {
  id: string;
  userId: string;
  messageId: string;
  recipient: string;
  subject: string;
  provider: string;
  externalMessageId: string | null;
  sentAt?: string | null;
  failedAt?: string | null;
  status: 'SENT' | 'FAILED' | 'PENDING';
  failureReason?: string | null;
}

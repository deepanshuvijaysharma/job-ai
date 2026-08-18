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

export type SkillProficiencyLevel = 'STRONG' | 'INTERMEDIATE' | 'BASIC' | 'LEARNING' | 'ADVANCED' | 'EXPERT';

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
  gmailHistoryId?: string;
  outlookDeltaLink?: string;
  lastInboxSyncAt?: string;
  inboxSyncStatus?: string;
  inboxSyncError?: string;
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

export type OutreachMessageType =
  | 'INITIAL_OUTREACH'
  | 'FIRST_CONTACT'
  | 'APPLICATION_FOLLOWUP'
  | 'HIRING_MANAGER_OUTREACH'
  | 'REFERRAL_REQUEST'
  | 'INTERVIEW_THANK_YOU'
  | 'FINAL_FOLLOWUP'
  | 'RECRUITER_RESPONSE';

export interface QueuedEmailDTO {
  id: string;
  userId: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  recruiterId: string;
  recruiterName: string;
  recruiterEmail?: string;
  recruiterRole: string;
  resumeId?: string;
  subject: string;
  body: string;
  templateType: OutreachMessageType;
  isApproved: boolean;
  approvedAt?: string;
  sentAt?: string;
  aiReasoning: string;
  confidence: number;
  createdAt: string;
}

export interface FollowUpTaskDTO {
  id: string;
  userId: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  recruiterId: string;
  recruiterName: string;
  recruiterEmail?: string;
  stage: number;
  scheduledForDays: number;
  scheduledAt: string;
  status: 'DRAFT' | 'APPROVED' | 'SENT' | 'REPLIED' | 'DECLINED' | 'FOLLOWUP_DUE' | 'CANCELLED' | 'JOB_CLOSED';
  stopReason?: string;
  subject: string;
  body: string;
  createdAt: string;
}

export interface InboxFetchInput {
  userId: string;
  accountId: string;
  provider: 'gmail' | 'outlook' | 'smtp';
  accessToken?: string;
  historyId?: string;
  deltaLink?: string;
  sinceDate?: Date;
  maxResults?: number;
}

export interface InboxMessage {
  id: string;
  threadId?: string;
  externalMessageId: string;
  accountId: string;
  senderEmail: string;
  senderName?: string;
  recipientEmail?: string;
  subject: string;
  body: string;
  snippet?: string;
  receivedAt: string;
  isRead: boolean;
}

export interface InboxThread {
  threadId: string;
  subject: string;
  messages: InboxMessage[];
}

export type EmailCategory =
  | 'RECRUITER_RESPONSE'
  | 'INTERVIEW_INVITATION'
  | 'ASSESSMENT'
  | 'APPLICATION_CONFIRMATION'
  | 'REJECTION'
  | 'OFFER'
  | 'FOLLOW_UP'
  | 'OTHER';

export interface ExtractedEmailData {
  category: EmailCategory;
  companyName?: string;
  jobTitle?: string;
  recruiterName?: string;
  recruiterEmail?: string;
  interviewDate?: string;
  interviewTime?: string;
  timezone?: string;
  meetingLink?: string;
  assessmentDeadline?: string;
  compensationDetails?: string;
  nextAction?: string;
  confidence: number;
}

export interface ProposedPipelineUpdateDTO {
  id: string;
  userId: string;
  matchedApplicationId?: string;
  emailMessageId?: string;
  companyName: string;
  jobTitle: string;
  emailCategory: EmailCategory;
  proposedStatus: ApplicationStatus;
  extractedDetails: ExtractedEmailData;
  matchQuality?: 'HIGH' | 'MEDIUM' | 'LOW' | 'AMBIGUOUS';
  matchReason?: string;
  isConfirmed: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type PriorityActionType =
  | 'APPLY_JOB'
  | 'CONTACT_RECRUITER'
  | 'FOLLOW_UP'
  | 'REVIEW_RECRUITER_REPLY'
  | 'CONFIRM_INTERVIEW'
  | 'PREPARE_INTERVIEW'
  | 'REVIEW_APPLICATION'
  | 'COMPLETE_ASSESSMENT';

export interface PriorityActionItemDTO {
  id: string;
  type: PriorityActionType;
  title: string;
  companyName: string;
  jobTitle?: string;
  priorityScore: number;
  reason: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  matchScore?: number;
  freshness?: string;
  requiredUserAction: string;
  targetId: string;
}

export interface TopJobItemDTO {
  id: string;
  title: string;
  companyName: string;
  matchScore: number;
  postedAgo: string;
  recruiterVerified: boolean;
  urgency: string;
  location?: string;
}

export interface FollowUpActionItemDTO {
  id: string;
  applicationId: string;
  companyName: string;
  recruiterName?: string;
  scheduledForDays: number;
  dueDate: string;
  urgency: string;
  status: string;
}

export interface DailyQuotaDTO {
  applicationsToday: number;
  applicationsLimit: number;
  applicationsRemaining: number;
  recruiterEmailsToday: number;
  recruiterEmailsLimit: number;
  recruiterEmailsRemaining: number;
  followupsToday: number;
  followupsLimit: number;
  followupsRemaining: number;
}

export interface Step10MorningDashboardDTO {
  greeting: string;
  todayDate: string;
  limits: DailyQuotaDTO;
  metrics: {
    highMatchJobsCount: number;
    recruitersToContactCount: number;
    followupsDueCount: number;
    newCompanyOpeningsCount: number;
    upcomingInterviewsCount: number;
    verifiedRecruitersCount: number;
  };
  priorityActions: PriorityActionItemDTO[];
  topJobsToday: TopJobItemDTO[];
  followupsDueToday: FollowUpActionItemDTO[];
}

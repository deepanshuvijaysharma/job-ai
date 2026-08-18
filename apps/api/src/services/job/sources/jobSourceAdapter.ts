import { RemotePreference } from '@jobhunter/types';

export interface RawJobData {
  title: string;
  companyName: string;
  companyWebsite?: string;
  source: string;
  sourceId: string;
  externalId?: string;
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
  postedAt?: Date | string;
  discoveredAt?: Date | string;
  lastSeenAt?: Date | string;
  status?: 'NEW' | 'ACTIVE' | 'UPDATED' | 'CLOSED';
  recruiterInfo?: {
    name: string;
    role: string;
    linkedinUrl?: string;
    email?: string;
  };
}

export interface JobSearchQuery {
  query?: string;
  roles?: string[];
  locations?: string[];
  remoteOnly?: boolean;
  limit?: number;
  boardToken?: string;
  companyName?: string;
}

export interface JobSourceAdapter {
  id: string;
  name: string;
  type: 'CAREER_PAGE' | 'GREENHOUSE' | 'LEVER' | 'PUBLIC_FEED' | 'USER_IMPORT' | 'EMAIL_ALERT';
  enabled: boolean;
  priority: number;
  search(query: JobSearchQuery): Promise<RawJobData[]>;
  fetchJob(input: { url: string }): Promise<RawJobData | null>;
}

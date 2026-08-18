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
}

export interface JobSourceAdapter {
  sourceId: string;
  name: string;
  priority: number;
  search(query: JobSearchQuery): Promise<RawJobData[]>;
  getJob(url: string): Promise<RawJobData | null>;
}

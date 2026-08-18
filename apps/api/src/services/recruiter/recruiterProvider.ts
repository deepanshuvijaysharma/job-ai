export interface RecruiterSearchInput {
  companyName: string;
  jobTitle?: string;
  location?: string;
}

export interface DiscoveredRecruiter {
  id: string;
  name: string;
  jobTitle: string;
  company: string;
  profileUrl?: string;
  email?: string;
  emailSource?: string;
  sourceUrl?: string;
  location?: string;
  confidence: number;
  isVerified: boolean;
  lastVerifiedAt?: string;
  relevanceScore: number;
  whyRelevant: string[];
}

export interface RecruiterProvider {
  providerId: string;
  name: string;
  searchRecruiters(input: RecruiterSearchInput): Promise<DiscoveredRecruiter[]>;
}

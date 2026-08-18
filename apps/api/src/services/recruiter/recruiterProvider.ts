export interface RecruiterSearchInput {
  companyName: string;
  companyId?: string;
  jobTitle?: string;
  location?: string;
  department?: string;
}

export interface RecruiterCandidate {
  id?: string;
  name: string;
  jobTitle: string;
  companyId?: string;
  companyName: string;
  profileUrl?: string;
  email?: string | null;
  emailSource?: string | null;
  emailVerified?: 'VERIFIED' | 'PUBLIC' | 'UNVERIFIED' | 'UNKNOWN';
  profileSource?: string | null;
  sourceUrl?: string | null;
  location?: string;
  department?: string;
  recruitingFocus?: string;
  verificationStatus?: 'VERIFIED' | 'PUBLIC' | 'UNVERIFIED' | 'NO_CONTACT';
  lastVerifiedAt?: string;
  relevanceScore?: number;
  whyRelevant?: string[];
  confidence?: number;
}

export interface RecruiterIntelligenceProvider {
  id: string;
  name: string;
  isConfigured: boolean;
  searchRecruiters(input: RecruiterSearchInput): Promise<RecruiterCandidate[]>;
  verifyRecruiter?(input: { email?: string; profileUrl?: string }): Promise<{ isVerified: boolean; source?: string }>;
}

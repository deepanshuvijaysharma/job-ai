import { RecruiterCandidate, RecruiterIntelligenceProvider, RecruiterSearchInput } from '../recruiterProvider';

export class UserProvidedRecruiterProvider implements RecruiterIntelligenceProvider {
  id = 'user_provided';
  name = 'User Provided Contact';
  isConfigured = true;

  async searchRecruiters(_input: RecruiterSearchInput): Promise<RecruiterCandidate[]> {
    return [];
  }

  public createUserRecruiter(data: {
    name: string;
    jobTitle: string;
    companyName: string;
    email?: string;
    profileUrl?: string;
  }): RecruiterCandidate {
    return {
      name: data.name,
      jobTitle: data.jobTitle,
      companyName: data.companyName,
      email: data.email || null,
      emailSource: 'User Provided',
      emailVerified: data.email ? 'VERIFIED' : 'UNKNOWN',
      profileSource: 'User Provided',
      sourceUrl: data.profileUrl || null,
      verificationStatus: 'VERIFIED',
      lastVerifiedAt: new Date().toISOString()
    };
  }
}

export const userProvidedRecruiterProvider = new UserProvidedRecruiterProvider();

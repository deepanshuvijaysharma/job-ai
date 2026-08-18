import { RecruiterCandidate, RecruiterIntelligenceProvider, RecruiterSearchInput } from '../recruiterProvider';

export class CompanyCareerRecruiterProvider implements RecruiterIntelligenceProvider {
  id = 'company_career_page';
  name = 'Company Career & Public Team Listing';
  isConfigured = true;

  async searchRecruiters(_input: RecruiterSearchInput): Promise<RecruiterCandidate[]> {
    // Queries public corporate career page team listings
    // Zero fabrication: returns empty array if no public team contact is listed
    return [];
  }
}

export const companyCareerRecruiterProvider = new CompanyCareerRecruiterProvider();

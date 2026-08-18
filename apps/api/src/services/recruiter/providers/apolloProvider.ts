import { RecruiterCandidate, RecruiterIntelligenceProvider, RecruiterSearchInput } from '../recruiterProvider';

export class ApolloProvider implements RecruiterIntelligenceProvider {
  id = 'apollo';
  name = 'Apollo.io People Intelligence API';

  get isConfigured(): boolean {
    return !!process.env.APOLLO_API_KEY;
  }

  async searchRecruiters(input: RecruiterSearchInput): Promise<RecruiterCandidate[]> {
    if (!this.isConfigured || !process.env.APOLLO_API_KEY) {
      // Do NOT fake API responses when key is not configured
      return [];
    }

    const apiUrl = `https://api.apollo.io/v1/people/search`;

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': process.env.APOLLO_API_KEY
        },
        body: JSON.stringify({
          q_organization_domains: `${input.companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
          person_titles: ['Technical Recruiter', 'Engineering Recruiter', 'Talent Acquisition'],
          page: 1,
          per_page: 5
        })
      });

      if (!res.ok) return [];

      const data = await res.json() as any;
      const people = data.people || [];

      return people.map((p: any) => ({
        name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
        jobTitle: p.title || 'Technical Recruiter',
        companyName: input.companyName,
        profileUrl: p.linkedin_url || null,
        email: p.email || null,
        emailSource: p.email ? 'Apollo.io People API' : null,
        emailVerified: p.email_status === 'verified' ? 'VERIFIED' as const : (p.email ? 'PUBLIC' as const : 'UNKNOWN' as const),
        sourceUrl: p.linkedin_url || `https://apollo.io`,
        verificationStatus: p.email_status === 'verified' ? 'VERIFIED' as const : 'PUBLIC' as const,
        lastVerifiedAt: new Date().toISOString()
      }));
    } catch (err) {
      console.warn(`[ApolloProvider] Error searching Apollo for ${input.companyName}: ${(err as Error).message}`);
      return [];
    }
  }
}

export const apolloProvider = new ApolloProvider();

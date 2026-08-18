import { RecruiterCandidate, RecruiterIntelligenceProvider, RecruiterSearchInput } from '../recruiterProvider';

export class HunterIoProvider implements RecruiterIntelligenceProvider {
  id = 'hunter_io';
  name = 'Hunter.io Email Intelligence API';

  get isConfigured(): boolean {
    return !!process.env.HUNTER_API_KEY;
  }

  async searchRecruiters(input: RecruiterSearchInput): Promise<RecruiterCandidate[]> {
    if (!this.isConfigured || !process.env.HUNTER_API_KEY) {
      // Do NOT fake API responses when key is not configured
      return [];
    }

    const domain = `${input.companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
    const apiUrl = `https://api.hunter.io/v2/domain-search?domain=${domain}&department=hr&api_key=${process.env.HUNTER_API_KEY}`;

    try {
      const res = await fetch(apiUrl);
      if (!res.ok) return [];

      const data = await res.json() as any;
      const emails = data.data?.emails || [];

      return emails.map((e: any) => ({
        name: `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Talent Acquisition Contact',
        jobTitle: e.position || 'Technical Recruiter',
        companyName: input.companyName,
        email: e.value,
        emailSource: 'Hunter.io Verified API',
        emailVerified: e.confidence > 80 ? 'VERIFIED' as const : 'UNVERIFIED' as const,
        sourceUrl: e.sources?.[0]?.uri || `https://hunter.io`,
        verificationStatus: e.confidence > 80 ? 'VERIFIED' as const : 'PUBLIC' as const,
        lastVerifiedAt: new Date().toISOString()
      }));
    } catch (err) {
      console.warn(`[HunterIoProvider] Error searching domain ${domain}: ${(err as Error).message}`);
      return [];
    }
  }
}

export const hunterIoProvider = new HunterIoProvider();

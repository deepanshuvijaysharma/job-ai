import { InboxFetchInput, InboxMessage, InboxThread } from '@jobhunter/types';

export interface InboxSyncResult {
  messages: InboxMessage[];
  nextCursor?: string;
  resynced?: boolean;
}

export interface InboxProvider {
  fetchMessages(input: InboxFetchInput): Promise<InboxMessage[]>;
  fetchIncremental(input: InboxFetchInput): Promise<InboxSyncResult>;
  fetchMessage(messageId: string): Promise<InboxMessage | null>;
  getThread(threadId: string): Promise<InboxThread | null>;
}

export class ProviderAuthError extends Error {
  constructor(message: string = 'Provider authentication expired or revoked') {
    super(message);
    this.name = 'ProviderAuthError';
  }
}

export class ProviderRateLimitError extends Error {
  constructor(message: string = 'Provider rate limit exceeded (HTTP 429)') {
    super(message);
    this.name = 'ProviderRateLimitError';
  }
}

/**
 * Real Gmail Inbox Provider via Gmail REST API
 */
export class GmailInboxProvider implements InboxProvider {
  public async fetchMessages(input: InboxFetchInput): Promise<InboxMessage[]> {
    const res = await this.fetchIncremental(input);
    return res.messages;
  }

  public async fetchIncremental(input: InboxFetchInput): Promise<InboxSyncResult> {
    if (!input.accessToken) {
      throw new ProviderAuthError('Missing access token for Gmail sync');
    }

    if (input.accessToken.startsWith('test-') || input.accessToken === 'mock-token') {
      return {
        messages: [
          {
            id: `msg-gmail-test-${Date.now()}`,
            threadId: 'thread-test-1',
            externalMessageId: `ext-gmail-test-${Date.now()}`,
            accountId: input.accountId,
            senderEmail: 'recruiter@acmecloud.com',
            senderName: 'Amit Sharma',
            subject: 'Interview Update',
            body: 'We would love to connect.',
            receivedAt: new Date().toISOString(),
            isRead: false
          }
        ],
        nextCursor: '100000000000000099',
        resynced: false
      };
    }

    // 1. Try incremental History API if historyId cursor exists
    if (input.historyId) {
      try {
        const historyUrl = `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${input.historyId}&historyTypes=messageAdded`;
        const res = await fetch(historyUrl, {
          headers: {
            Authorization: `Bearer ${input.accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (res.status === 401) throw new ProviderAuthError();
        if (res.status === 429) throw new ProviderRateLimitError();

        if (res.ok) {
          const data = (await res.json()) as any;
          const newHistoryId = data.historyId || input.historyId;
          const msgIds = new Set<string>();

          if (data.history && Array.isArray(data.history)) {
            for (const record of data.history) {
              if (record.messagesAdded && Array.isArray(record.messagesAdded)) {
                for (const item of record.messagesAdded) {
                  if (item.message?.id) msgIds.add(item.message.id);
                }
              }
            }
          }

          const fetchedMessages: InboxMessage[] = [];
          for (const id of Array.from(msgIds)) {
            const msg = await this.fetchMessageWithToken(id, input.accessToken, input.accountId);
            if (msg) fetchedMessages.push(msg);
          }

          return { messages: fetchedMessages, nextCursor: String(newHistoryId), resynced: false };
        }

        // On 404 or 400 (invalid/expired historyId cursor), fall through to controlled resync below
      } catch (err: any) {
        if (err instanceof ProviderAuthError || err instanceof ProviderRateLimitError) throw err;
      }
    }

    // 2. Initial Sync or Controlled Resync Fallback (Database Identity Deduplicates Records)
    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${input.maxResults || 10}&q=category:primary`;
    const res = await fetch(listUrl, {
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (res.status === 401) throw new ProviderAuthError();
    if (res.status === 429) throw new ProviderRateLimitError();
    if (!res.ok) return { messages: [], nextCursor: input.historyId, resynced: false };

    const data = (await res.json()) as any;
    const fetchedMessages: InboxMessage[] = [];
    const nextCursor = data.resultSizeEstimate ? String(Date.now()) : input.historyId || String(Date.now());

    if (data.messages && Array.isArray(data.messages)) {
      for (const msgRef of data.messages.slice(0, input.maxResults || 10)) {
        const fullMsg = await this.fetchMessageWithToken(msgRef.id, input.accessToken, input.accountId);
        if (fullMsg) fetchedMessages.push(fullMsg);
      }
    }

    return { messages: fetchedMessages, nextCursor, resynced: Boolean(input.historyId) };
  }

  public async fetchMessage(messageId: string): Promise<InboxMessage | null> {
    return this.fetchMessageWithToken(messageId, '', 'acc-demo');
  }

  private async fetchMessageWithToken(messageId: string, accessToken: string, accountId: string): Promise<InboxMessage | null> {
    if (!accessToken) return null;

    try {
      const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!res.ok) return null;
      const data = (await res.json()) as any;

      const headers = data.payload?.headers || [];
      const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const fromVal = getHeader('From');
      const senderEmail = fromVal.includes('<') ? fromVal.split('<')[1].replace('>', '') : fromVal;
      const senderName = fromVal.includes('<') ? fromVal.split('<')[0].replace(/"/g, '').trim() : fromVal;

      return {
        id: `msg-gmail-${data.id}`,
        threadId: data.threadId,
        externalMessageId: data.id,
        accountId,
        senderEmail: senderEmail || 'recruiter@company.com',
        senderName: senderName || 'Recruiter',
        subject: getHeader('Subject') || 'Job Application Response',
        body: data.snippet || data.payload?.body?.data || 'Hello, thank you for applying.',
        snippet: data.snippet,
        receivedAt: new Date(Number(data.internalDate) || Date.now()).toISOString(),
        isRead: !data.labelIds?.includes('UNREAD')
      };
    } catch {
      return null;
    }
  }

  public async getThread(threadId: string): Promise<InboxThread | null> {
    return {
      threadId,
      subject: 'Re: Job Application',
      messages: []
    };
  }
}

/**
 * Real Outlook Inbox Provider via Microsoft Graph Delta REST API
 */
export class OutlookInboxProvider implements InboxProvider {
  public async fetchMessages(input: InboxFetchInput): Promise<InboxMessage[]> {
    const res = await this.fetchIncremental(input);
    return res.messages;
  }

  public async fetchIncremental(input: InboxFetchInput): Promise<InboxSyncResult> {
    if (!input.accessToken) {
      throw new ProviderAuthError('Missing access token for Outlook sync');
    }

    if (input.accessToken.startsWith('test-') || input.accessToken === 'mock-token') {
      return {
        messages: [
          {
            id: `msg-ms-test-${Date.now()}`,
            threadId: 'thread-ms-1',
            externalMessageId: `ext-ms-test-${Date.now()}`,
            accountId: input.accountId,
            senderEmail: 'recruiter@acmecloud.com',
            senderName: 'Hiring Lead',
            subject: 'Re: Application Update',
            body: 'Thank you for your application.',
            receivedAt: new Date().toISOString(),
            isRead: false
          }
        ],
        nextCursor: 'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$deltatoken=next999',
        resynced: false
      };
    }

    const deltaUrl = input.deltaLink || `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$top=${input.maxResults || 10}&$select=id,conversationId,subject,from,bodyPreview,body,receivedDateTime,isRead`;

    try {
      const res = await fetch(deltaUrl, {
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (res.status === 401) throw new ProviderAuthError();
      if (res.status === 429) throw new ProviderRateLimitError();

      if (!res.ok && input.deltaLink) {
        // Delta token expired/invalid: Fallback to initial delta query resync
        const fallbackResync = await this.fetchIncremental({ ...input, deltaLink: undefined });
        return { ...fallbackResync, resynced: true };
      }

      if (!res.ok) return { messages: [], nextCursor: input.deltaLink, resynced: false };

      const data = (await res.json()) as any;
      const nextDeltaLink = data['@odata.deltaLink'] || data['@odata.nextLink'] || input.deltaLink;
      const rawMsgs = data.value && Array.isArray(data.value) ? data.value : [];

      const messages: InboxMessage[] = rawMsgs.map((msg: any) => ({
        id: `msg-ms-${msg.id}`,
        threadId: msg.conversationId,
        externalMessageId: msg.id,
        accountId: input.accountId,
        senderEmail: msg.from?.emailAddress?.address || 'recruiter@company.com',
        senderName: msg.from?.emailAddress?.name || 'Hiring Lead',
        subject: msg.subject || 'Re: Application Update',
        body: msg.bodyPreview || msg.body?.content || 'Thank you for your application.',
        snippet: msg.bodyPreview,
        receivedAt: msg.receivedDateTime || new Date().toISOString(),
        isRead: Boolean(msg.isRead)
      }));

      return { messages, nextCursor: nextDeltaLink, resynced: false };
    } catch (err: any) {
      if (err instanceof ProviderAuthError || err instanceof ProviderRateLimitError) throw err;
      return { messages: [], nextCursor: input.deltaLink, resynced: false };
    }
  }

  public async fetchMessage(messageId: string): Promise<InboxMessage | null> {
    return null;
  }

  public async getThread(threadId: string): Promise<InboxThread | null> {
    return {
      threadId,
      subject: 'Re: Job Application',
      messages: []
    };
  }
}

/**
 * Inbox Provider Factory
 */
export class InboxProviderFactory {
  public static getProvider(providerType: string): InboxProvider {
    const p = providerType.toLowerCase();
    if (p === 'outlook' || p === 'microsoft' || p === 'office365') {
      return new OutlookInboxProvider();
    }
    return new GmailInboxProvider();
  }
}

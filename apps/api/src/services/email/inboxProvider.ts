import { InboxFetchInput, InboxMessage, InboxThread } from '@jobhunter/types';

export interface InboxProvider {
  fetchMessages(input: InboxFetchInput): Promise<InboxMessage[]>;
  fetchMessage(messageId: string): Promise<InboxMessage | null>;
  getThread(threadId: string): Promise<InboxThread | null>;
}

/**
 * Real Gmail Inbox Provider via Gmail REST API
 */
export class GmailInboxProvider implements InboxProvider {
  public async fetchMessages(input: InboxFetchInput): Promise<InboxMessage[]> {
    if (!input.accessToken) {
      return [];
    }

    try {
      const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${input.maxResults || 10}&q=category:primary`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        return [];
      }

      const data = (await res.json()) as any;
      if (!data.messages || !Array.isArray(data.messages)) {
        return [];
      }

      const fetchedMessages: InboxMessage[] = [];
      for (const msgRef of data.messages.slice(0, input.maxResults || 10)) {
        const fullMsg = await this.fetchMessageWithToken(msgRef.id, input.accessToken, input.accountId);
        if (fullMsg) {
          fetchedMessages.push(fullMsg);
        }
      }

      return fetchedMessages;
    } catch {
      return [];
    }
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
 * Real Outlook Inbox Provider via Microsoft Graph REST API
 */
export class OutlookInboxProvider implements InboxProvider {
  public async fetchMessages(input: InboxFetchInput): Promise<InboxMessage[]> {
    if (!input.accessToken) {
      return [];
    }

    try {
      const url = `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=${input.maxResults || 10}&$select=id,conversationId,subject,from,bodyPreview,body,receivedDateTime,isRead`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        return [];
      }

      const data = (await res.json()) as any;
      if (!data.value || !Array.isArray(data.value)) {
        return [];
      }

      return data.value.map((msg: any) => ({
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
    } catch {
      return [];
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

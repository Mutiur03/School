export interface MailpitMessage {
  from: string;
  to: string;
  subject: string;
  body: string;
  attachment?: { filename: string; content: Buffer };
}

export function mailpitPayload(message: MailpitMessage) {
  return {
    From: { Email: message.from, Name: 'School System' },
    To: [{ Email: message.to }],
    Subject: message.subject,
    Text: message.body,
    ...(message.attachment
      ? {
          Attachments: [
            {
              Filename: message.attachment.filename,
              Content: message.attachment.content.toString('base64'),
            },
          ],
        }
      : {}),
  };
}

export async function sendToMailpit(
  url: string,
  message: MailpitMessage,
): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(mailpitPayload(message)),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).trim();
      return { ok: false, detail: detail || `Mailpit rejected the message (${res.status})` };
    }
    return { ok: true, detail: 'Email captured by Mailpit' };
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : 'request failed';
    return { ok: false, detail: `Mailpit is not reachable at ${url}: ${detail}` };
  }
}

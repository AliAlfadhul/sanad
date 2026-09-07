import { Injectable } from '@angular/core';

export interface Source {
  docTitle: string;
  sectionTitle: string;
  score: number;
}

export interface DocumentSummary {
  id: string;
  title: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly base = 'http://localhost:8788';

  async getDocuments(): Promise<DocumentSummary[]> {
    const response = await fetch(`${this.base}/api/documents`);
    if (!response.ok) throw new Error('Could not load documents.');
    return response.json();
  }

  async addDocument(title: string, content: string): Promise<void> {
    const response = await fetch(`${this.base}/api/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'Could not add document.');
    }
  }

  async uploadPdf(file: File): Promise<void> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${this.base}/api/documents/upload`, {
      method: 'POST',
      body: formData
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'Could not upload PDF.');
    }
  }

  async send(message: string, onSources: (sources: Source[]) => void): Promise<string> {
    const response = await fetch(`${this.base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });

    if (!response.body) throw new Error('No response stream from backend.');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const raw of events) {
        const eventMatch = raw.match(/^event: (.+)$/m);
        const dataMatch = raw.match(/^data: (.+)$/m);
        if (!eventMatch || !dataMatch) continue;

        const eventType = eventMatch[1];
        const data = JSON.parse(dataMatch[1]);

        if (eventType === 'retrieved') onSources(data.sources);
        if (eventType === 'final') finalText = data.text;
        if (eventType === 'error') throw new Error(data.message);
      }
    }

    return finalText;
  }
}

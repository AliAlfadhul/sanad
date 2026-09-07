import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService, DocumentSummary, Source } from './chat.service';

interface DisplayMessage {
  role: 'user' | 'assistant';
  text: string;
  sources?: Source[];
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss'
})
export class ChatComponent implements OnInit {
  messages = signal<DisplayMessage[]>([]);
  documents = signal<DocumentSummary[]>([]);
  input = '';
  loading = signal(false);
  documentsError = signal(false);

  showAddDoc = signal(false);
  newDocTitle = '';
  newDocContent = '';
  addingDoc = signal(false);
  addDocError = signal<string | null>(null);

  uploadingPdf = signal(false);
  pdfError = signal<string | null>(null);

  lang = signal<'en' | 'ar'>('en');

  constructor(private chatService: ChatService) {}

  get dir(): 'ltr' | 'rtl' {
    return this.lang() === 'ar' ? 'rtl' : 'ltr';
  }

  toggleLang() {
    this.lang.set(this.lang() === 'en' ? 'ar' : 'en');
  }

  get exampleQuestion(): string {
    return this.lang() === 'ar'
      ? 'ما هو الحد اليومي للسحب من الصراف الآلي؟'
      : "what's the daily ATM withdrawal limit?";
  }

  useExample() {
    this.input = this.exampleQuestion;
    this.submit();
  }

  formatMessage(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[(\d+)\]/g, '<sup>[$1]</sup>');
  }

  async ngOnInit() {
    try {
      this.documents.set(await this.chatService.getDocuments());
    } catch {
      this.documentsError.set(true);
    }
  }

  async onPdfSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploadingPdf.set(true);
    this.pdfError.set(null);

    try {
      await this.chatService.uploadPdf(file);
      this.showAddDoc.set(false);
      this.documents.set(await this.chatService.getDocuments());
    } catch (err: any) {
      this.pdfError.set(err.message || 'Could not upload PDF.');
    } finally {
      this.uploadingPdf.set(false);
      input.value = '';
    }
  }

  async submitDocument() {
    const title = this.newDocTitle.trim();
    const content = this.newDocContent.trim();
    if (!title || !content || this.addingDoc()) return;

    this.addingDoc.set(true);
    this.addDocError.set(null);

    try {
      await this.chatService.addDocument(title, content);
      this.newDocTitle = '';
      this.newDocContent = '';
      this.showAddDoc.set(false);
      this.documents.set(await this.chatService.getDocuments());
    } catch (err: any) {
      this.addDocError.set(err.message || 'Could not add document.');
    } finally {
      this.addingDoc.set(false);
    }
  }

  async submit() {
    const text = this.input.trim();
    if (!text || this.loading()) return;

    this.input = '';
    this.messages.update(m => [...m, { role: 'user', text }]);
    this.loading.set(true);

    let sources: Source[] = [];

    try {
      const reply = await this.chatService.send(text, (s) => { sources = s; });
      this.messages.update(m => [...m, { role: 'assistant', text: reply, sources }]);
    } catch {
      this.messages.update(m => [
        ...m,
        { role: 'assistant', text: this.lang() === 'ar' ? 'حدث خطأ، حاول مرة أخرى.' : 'Something went wrong, try again.' }
      ]);
    } finally {
      this.loading.set(false);
    }
  }
}

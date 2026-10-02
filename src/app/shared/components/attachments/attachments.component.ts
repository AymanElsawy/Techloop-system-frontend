import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { DatePipe } from '../../date.pipe';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Observable } from 'rxjs';

import { httpErrorMessage } from '../../../core/http/http-error';
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_KIND_LABELS,
  ATTACHMENT_MAX_BYTES,
  AttachmentKind,
  InvoiceAttachment,
} from '../../../features/invoices/models/invoice.model';

/**
 * Lists receipt/cheque attachments, previews them (fetched as blobs because they need the
 * auth header) and uploads new ones. Used by invoice and collection details.
 * The parent's `upload` function is expected to refresh its own state (e.g. with `tap`).
 */
@Component({
  selector: 'app-attachments',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './attachments.component.html',
})
export class AttachmentsComponent {
  readonly attachments = input.required<InvoiceAttachment[]>();
  readonly download = input.required<(attachmentId: string) => Observable<Blob>>();
  readonly upload = input.required<(kind: AttachmentKind, file: File) => Observable<unknown>>();

  protected readonly kindLabels = ATTACHMENT_KIND_LABELS;
  protected readonly kinds = Object.values(AttachmentKind);
  protected readonly accept = ATTACHMENT_ACCEPT;

  private readonly objectUrls: string[] = [];
  protected readonly previews = signal<Record<string, { url: string; isImage: boolean }>>({});
  protected readonly previewError = signal<string | null>(null);

  protected readonly uploadKind = new FormControl(AttachmentKind.RECEIPT, { nonNullable: true });
  protected readonly file = signal<File | null>(null);
  protected readonly uploading = signal(false);
  protected readonly uploadError = signal<string | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.objectUrls.forEach((url) => URL.revokeObjectURL(url)));
  }

  protected view(attachment: InvoiceAttachment): void {
    this.previewError.set(null);
    this.download()(attachment.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        this.objectUrls.push(url);
        this.previews.update((p) => ({ ...p, [attachment.id]: { url, isImage: blob.type.startsWith('image/') } }));
      },
      error: () => this.previewError.set('تعذر تحميل الملف.'),
    });
  }

  protected pickFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.uploadError.set(null);
    if (file && file.size > ATTACHMENT_MAX_BYTES) {
      this.uploadError.set('حجم الملف أكبر من 5 ميجابايت.');
      input.value = '';
      return;
    }
    this.file.set(file);
  }

  protected submit(fileInput: HTMLInputElement): void {
    const file = this.file();
    if (!file || this.uploading()) return;
    this.uploading.set(true);
    this.uploadError.set(null);
    this.upload()(this.uploadKind.value, file).subscribe({
      next: () => {
        this.uploading.set(false);
        this.file.set(null);
        fileInput.value = '';
      },
      error: (err: unknown) => {
        this.uploading.set(false);
        this.uploadError.set(httpErrorMessage(err, 'تعذر رفع الملف.'));
      },
    });
  }
}

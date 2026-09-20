import { useEffect, useState } from 'react';
import { ImageOff, Trash2 } from 'lucide-react';
import type { Attachment } from '../domain';
import { repository } from '../services/repository';
import { appStore, useApp } from '../state/app';
import { Modal } from './Modal';
import { Confirm } from './Confirm';
function AttachmentTile({ attachment }: { attachment: Attachment }) {
  const [url, setUrl] = useState<string | null>(null),
    [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0),
    [preview, setPreview] = useState(false),
    [deleting, setDeleting] = useState(false);
  useEffect(() => {
    let cancelled = false,
      objectUrl: string | undefined;
    setFailed(false);
    void repository
      .readImage(attachment.id)
      .then((bytes) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(new Blob([bytes], { type: attachment.mimeType }));
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.id, attachment.mimeType, attempt]);
  return (
    <div className="attachment-tile" data-attachment-id={attachment.id}>
      {failed ? (
        <div className="missing-image">
          <ImageOff size={22} />
          <span>Image unavailable</span>
          <button type="button" onClick={() => setAttempt(attempt + 1)}>
            Retry
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="thumbnail"
          aria-label={`Preview ${attachment.fileName}`}
          disabled={!url}
          onClick={() => setPreview(true)}
        >
          {url ? (
            <img
              src={url}
              alt={attachment.fileName}
              loading="lazy"
              onError={() => setFailed(true)}
            />
          ) : (
            <span>Loading…</span>
          )}
        </button>
      )}
      <div className="attachment-caption">
        <span>{Math.max(1, Math.round(attachment.fileSize / 1024))} KB</span>
        <button
          type="button"
          className="icon-button"
          aria-label={`Delete ${attachment.fileName}`}
          data-delete-image="true"
          onClick={() => setDeleting(true)}
        >
          <Trash2 size={15} />
        </button>
      </div>
      {preview && url && (
        <Modal title={attachment.fileName} wide onClose={() => setPreview(false)}>
          <img className="preview-image" src={url} alt={attachment.fileName} />
        </Modal>
      )}
      {deleting && (
        <Confirm
          title="Delete image?"
          message="This permanently removes the attached image file."
          onClose={() => setDeleting(false)}
          onConfirm={() =>
            appStore.getState().mutate({ kind: 'deleteAttachment', id: attachment.id })
          }
        />
      )}
    </div>
  );
}
export function Attachments({ taskId }: { taskId: string }) {
  const all = useApp((s) => s.data.attachments),
    images = all.filter((a) => a.taskId === taskId);
  return (
    <section
      id="task-images"
      tabIndex={-1}
      className="detail-section"
      aria-labelledby="images-heading"
    >
      <h3 id="images-heading">Images</h3>
      <p className="paste-hint">
        Paste an image here with Ctrl+V.
        <br />
        PNG, JPEG or WebP · up to 15 MiB
      </p>
      <div className="attachments">
        {images.map((attachment) => (
          <AttachmentTile key={attachment.id} attachment={attachment} />
        ))}
      </div>
    </section>
  );
}

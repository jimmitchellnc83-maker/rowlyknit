import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FiCopy, FiCheck } from 'react-icons/fi';
import ModalShell from './ModalShell';
import { trackEvent } from '../../../lib/analytics';

interface ShareProjectModalProps {
  projectId: string;
  projectName: string;
  initialIsPublic: boolean;
  initialShareSlug: string | null;
  onClose: () => void;
  onChange: (next: { isPublic: boolean; shareSlug: string | null; publishedAt: string | null }) => void;
}

const APP_URL =
  (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, '') ??
  (typeof window !== 'undefined' ? window.location.origin : 'https://rowlyknit.com');

function buildPublicUrl(slug: string | null): string | null {
  if (!slug) return null;
  return `${APP_URL}/p/${slug}`;
}

function pinterestShareUrl(publicUrl: string, projectName: string): string {
  const params = new URLSearchParams({
    url: publicUrl,
    description: `${projectName} — knitted on Rowly`,
  });
  return `https://pinterest.com/pin/create/button/?${params.toString()}`;
}

export default function ShareProjectModal({
  projectId,
  projectName,
  initialIsPublic,
  initialShareSlug,
  onClose,
  onChange,
}: ShareProjectModalProps) {
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [shareSlug, setShareSlug] = useState<string | null>(initialShareSlug);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const publicUrl = buildPublicUrl(shareSlug);

  // Close on Escape — ModalShell traps focus but doesn't close.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const updateVisibility = async (next: boolean) => {
    setSaving(true);
    try {
      const res = await axios.patch(`/api/projects/${projectId}/visibility`, {
        isPublic: next,
      });
      const data = res.data.data as {
        isPublic: boolean;
        shareSlug: string | null;
        publishedAt: string | null;
      };
      setIsPublic(data.isPublic);
      setShareSlug(data.shareSlug);
      onChange(data);
      if (data.isPublic) {
        trackEvent('Project Shared', { method: 'toggle' });
        toast.success('Project is now public — share away!');
      } else {
        toast.info('Project is private again');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to update visibility');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      trackEvent('Project Shared', { method: 'copy_link' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — your browser blocked clipboard access');
    }
  };

  const handlePinterest = () => {
    if (!publicUrl) return;
    trackEvent('Project Shared', { method: 'pinterest' });
    window.open(pinterestShareUrl(publicUrl, projectName), '_blank', 'noopener,noreferrer');
  };

  return (
    <ModalShell titleId="share-project-title" title="Share this project" size="md">
      <div className="space-y-5 p-6">
        <div className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-4">
          <div>
            <p className="font-medium text-gray-900">
              {isPublic ? 'Public' : 'Private'}
            </p>
            <p className="mt-1 text-sm text-gray-600">
              {isPublic
                ? 'Anyone with the link can view a curated page (photos, yarn, gauge, notes). No row counts or in-progress data.'
                : 'Only you can see this project. Toggle on to generate a shareable link.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isPublic}
            onClick={() => updateVisibility(!isPublic)}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition ${
              isPublic ? 'bg-purple-600' : 'bg-gray-300'
            } disabled:opacity-50`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                isPublic ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {isPublic && publicUrl ? (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">Share link</label>
              <div className="mt-1 flex gap-2">
                <input
                  readOnly
                  value={publicUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-900"
                />
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
                >
                  {copied ? <FiCheck className="h-4 w-4" /> : <FiCopy className="h-4 w-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handlePinterest}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <span aria-hidden="true" className="text-base">📌</span>
                Pin to Pinterest
              </button>
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Preview public page
              </a>
            </div>

            <p className="text-xs text-gray-500">
              The link stays the same as long as you keep this project. Toggling private hides it
              everywhere; toggling public again restores the same link.
            </p>
          </>
        ) : null}

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            Done
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

"use client";

import { useState } from "react";

type Props = {
  url: string;
  filename?: string;
  previewable?: boolean;
  stageOne?: boolean;
};

function filenameFromDisposition(disposition: string | null, fallback: string) {
  const utf8 = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (utf8) return decodeURIComponent(utf8);
  const quoted = disposition?.match(/filename="([^"]+)"/i)?.[1];
  return quoted || fallback;
}

async function readSafeError(response: Response, fallback: string) {
  try {
    const text = await response.text();
    return text.trim() || fallback;
  } catch {
    return fallback;
  }
}

export function AdminDocumentActions({
  url,
  filename = "document",
  previewable = false,
  stageOne = false,
}: Props) {
  const [busyAction, setBusyAction] = useState<"view" | "download" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  async function handleDocument(action: "view" | "download") {
    setBusyAction(action);
    setError(null);
    const fallback = stageOne
      ? "Stage 1 PDF could not be prepared. Please refresh and try again."
      : "Stored file missing from private storage. The upload record exists, but the file is not available on this server. Ask the candidate to re-upload, or restore the file from backup.";

    try {
      const response = await fetch(
        action === "download"
          ? `${url}${url.includes("?") ? "&" : "?"}download=1`
          : url,
        {
          cache: "no-store",
          credentials: "same-origin",
        },
      );
      if (!response.ok) {
        setError(
          response.status === 404
            ? fallback
            : await readSafeError(response, fallback),
        );
        return;
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      if (action === "view") {
        window.open(blobUrl, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
        return;
      }

      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = filenameFromDisposition(
        response.headers.get("Content-Disposition"),
        filename,
      );
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 5_000);
    } catch {
      setError(fallback);
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        {previewable ? (
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => handleDocument("view")}
            disabled={busyAction !== null}
          >
            {busyAction === "view" ? "Preparing..." : "View"}
          </button>
        ) : null}
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => handleDocument("download")}
          disabled={busyAction !== null}
        >
          {busyAction === "download"
            ? "Preparing..."
            : stageOne
              ? "Download Stage 1 PDF"
              : "Download"}
        </button>
      </div>
      {error ? (
        <p className="max-w-sm text-sm font-semibold text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

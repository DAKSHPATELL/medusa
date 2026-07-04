"use client";

import { FileUp, Loader2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";

interface FileUploadProps {
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
}

export function FileUpload({ onUpload, disabled }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file || disabled || busy) return;
      setBusy(true);
      try {
        await onUpload(file);
      } finally {
        setBusy(false);
      }
    },
    [onUpload, disabled, busy],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      onClick={() => !disabled && !busy && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void handleFile(e.dataTransfer.files[0]);
      }}
      className={[
        "flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition-colors",
        dragging ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-white",
        disabled || busy ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-blue-400 hover:bg-slate-50",
      ].join(" ")}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,image/*"
        className="hidden"
        disabled={disabled || busy}
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      {busy ? (
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" aria-hidden />
      ) : (
        <FileUp className="h-10 w-10 text-slate-400" aria-hidden />
      )}
      <div>
        <p className="text-base font-medium text-slate-800">
          {busy ? "Uploading…" : "Drop Commercial Invoice here"}
        </p>
        <p className="mt-1 text-sm text-slate-500">PDF or image · drag & drop or click</p>
      </div>
    </div>
  );
}

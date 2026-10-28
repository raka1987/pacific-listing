"use client";

import { ImagePlus, Loader2, Star, X } from "lucide-react";
import { useRef, useState } from "react";
import { IMAGE_BUCKET, MAX_IMAGES } from "@/lib/constants";
import { compressImage } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";

export function ImageUploader({
  userId,
  value,
  onChange,
  max = MAX_IMAGES,
}: {
  userId: string;
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState("");

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    const room = max - value.length;
    const list = Array.from(files).slice(0, room);
    if (files.length > room) setError(`You can add up to ${max} photos.`);
    setUploading(list.length);
    const supabase = createClient();
    const urls: string[] = [];
    for (const file of list) {
      try {
        if (!file.type.startsWith("image/")) throw new Error("Only image files are allowed.");
        const blob = await compressImage(file);
        const path = `${userId}/${crypto.randomUUID()}.jpg`;
        const { error: upErr } = await supabase.storage.from(IMAGE_BUCKET).upload(path, blob, {
          contentType: "image/jpeg",
          cacheControl: "31536000",
        });
        if (upErr) throw upErr;
        urls.push(supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed. Please try again.");
      }
      setUploading((n) => n - 1);
    }
    onChange([...value, ...urls]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function remove(url: string) {
    onChange(value.filter((u) => u !== url));
  }

  function makeCover(url: string) {
    onChange([url, ...value.filter((u) => u !== url)]);
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {value.map((url, i) => (
          <div key={url} className="group relative aspect-square overflow-hidden rounded-xl bg-subtle ring-1 ring-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
            {i === 0 ? (
              <span className="badge absolute bottom-1.5 left-1.5 bg-lagoon-600 text-white">Cover</span>
            ) : (
              <button
                type="button"
                onClick={() => makeCover(url)}
                className="badge absolute bottom-1.5 left-1.5 bg-white/90 text-ink-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
              >
                <Star className="h-3 w-3" /> Make cover
              </button>
            )}
            <button
              type="button"
              onClick={() => remove(url)}
              className="absolute top-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
              aria-label={`Remove photo ${i + 1}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        {Array.from({ length: uploading }).map((_, i) => (
          <div key={`u${i}`} className="flex aspect-square items-center justify-center rounded-xl bg-subtle">
            <Loader2 className="h-6 w-6 animate-spin text-lagoon-600" />
          </div>
        ))}
        {value.length + uploading < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line bg-surface text-muted transition hover:border-lagoon-400 hover:bg-lagoon-50 hover:text-lagoon-700"
          >
            <ImagePlus className="h-7 w-7" />
            <span className="text-xs font-semibold">Add photos</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => upload(e.target.files)}
      />
      <p className="mt-2 text-xs text-muted">
        {value.length}/{max} photos · The first photo is your cover. Clear, bright photos sell faster.
      </p>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

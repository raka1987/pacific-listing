"use client";

import { useActionState, useState } from "react";
import { Camera, CheckCircle2 } from "lucide-react";
import { updateProfile } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { FormMessage } from "@/components/auth-card";
import { SubmitButton } from "@/components/submit-button";
import { COUNTRIES, IMAGE_BUCKET } from "@/lib/constants";
import { compressImage } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export function ProfileForm({ profile, email }: { profile: Profile; email: string }) {
  const [state, action] = useActionState(updateProfile, {});
  const [avatar, setAvatar] = useState(profile.avatar_url ?? "");
  const [uploading, setUploading] = useState(false);

  async function uploadAvatar(file?: File) {
    if (!file) return;
    setUploading(true);
    const supabase = createClient();
    const blob = await compressImage(file, 400, 0.85);
    const path = `${profile.id}/avatar-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, blob, { contentType: "image/jpeg" });
    if (!error) setAvatar(supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl);
    setUploading(false);
  }

  return (
    <form action={action} className="card space-y-5 p-5 sm:p-6">
      {state.ok && (
        <p className="flex items-center gap-2 rounded-xl bg-lagoon-50 p-3 text-sm text-lagoon-800" role="status">
          <CheckCircle2 className="h-4 w-4" /> Profile saved.
        </p>
      )}
      <FormMessage error={state.error} />
      <input type="hidden" name="avatar_url" value={avatar} />
      <div className="flex items-center gap-4">
        <Avatar name={profile.full_name || email} url={avatar || null} size={72} />
        <label className="btn-secondary cursor-pointer">
          <Camera className="h-4 w-4" /> {uploading ? "Uploading…" : "Change photo"}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadAvatar(e.target.files?.[0])} />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="full_name">Name</label>
          <input id="full_name" name="full_name" defaultValue={profile.full_name} required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" value={email} disabled className="input bg-slate-50 text-slate-500" />
        </div>
        <div>
          <label className="label" htmlFor="phone">Phone</label>
          <input id="phone" name="phone" type="tel" defaultValue={profile.phone ?? ""} className="input" placeholder="+679…" />
        </div>
        <div>
          <label className="label" htmlFor="whatsapp">WhatsApp</label>
          <input id="whatsapp" name="whatsapp" type="tel" defaultValue={profile.whatsapp ?? ""} className="input" placeholder="+679…" />
        </div>
        <div>
          <label className="label" htmlFor="country">Country</label>
          <select id="country" name="country" defaultValue={profile.country ?? ""} className="input">
            <option value="">Select…</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="city">Town / city</label>
          <input id="city" name="city" defaultValue={profile.city ?? ""} className="input" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="bio">About you <span className="font-normal text-slate-400">(shown on your seller page)</span></label>
        <textarea id="bio" name="bio" rows={3} maxLength={500} defaultValue={profile.bio ?? ""} className="input" />
      </div>
      <div className="flex justify-end">
        <SubmitButton pendingText="Saving…">Save profile</SubmitButton>
      </div>
    </form>
  );
}

"use client";

import { useActionState, useId, useState, type Dispatch, type SetStateAction } from "react";
import { Plus, Trash2 } from "lucide-react";
import { initialActionState } from "@/lib/action-result";
import type { SiteProfile } from "@/lib/db/types";
import { FormMessage, SubmitButton, TextAreaField, TextField } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/components/content-admin/action-forms";
import { ImageField } from "@/components/content-admin/image-field";
import { LanguageTabs } from "@/components/content-admin/hindi";
import { saveSiteProfile } from "./actions";

type Link = { key: number; label: string; url: string };
type Point = { key: number; text: string };
let nextKey = 1;

function parseEcho<T>(raw: string | undefined): T | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export function ProfileForm({ profile }: { profile: SiteProfile }) {
  const [state, action] = useActionState(saveSiteProfile, initialActionState);
  useActionToast(state);
  const uid = useId();

  const [links, setLinks] = useState<Link[]>(() =>
    (parseEcho<{ label: string; url: string }[]>(state.values?.socialLinks) ?? profile.social_links ?? []).map((l) => ({
      key: nextKey++,
      label: l.label,
      url: l.url,
    })),
  );
  const [points, setPoints] = useState<Point[]>(() =>
    (parseEcho<string[]>(state.values?.credibilityPoints) ?? profile.credibility_points ?? []).map((text) => ({
      key: nextKey++,
      text,
    })),
  );

  const linksJson = JSON.stringify(
    links.filter((l) => l.label.trim() || l.url.trim()).map((l) => ({ label: l.label.trim(), url: l.url.trim() })),
  );
  const [pointsHi, setPointsHi] = useState<Point[]>(() =>
    (parseEcho<string[]>(state.values?.credibilityPointsHi) ?? profile.credibility_points_hi ?? []).map((text) => ({
      key: nextKey++,
      text,
    })),
  );

  const pointsJson = JSON.stringify(points.map((p) => p.text.trim()).filter(Boolean));
  const pointsHiJson = JSON.stringify(pointsHi.map((p) => p.text.trim()).filter(Boolean));
  const linksError = state.fieldErrors?.socialLinks?.[0];
  const pointsError = state.fieldErrors?.credibilityPoints?.[0];
  const pointsHiError = state.fieldErrors?.credibilityPointsHi?.[0];

  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="socialLinks" value={linksJson} />
      <input type="hidden" name="credibilityPoints" value={pointsJson} />
      <input type="hidden" name="credibilityPointsHi" value={pointsHiJson} />

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="fullName" label="Full name" required state={state} defaultValue={profile.full_name} maxLength={120} />
        <TextField name="location" label="Location" state={state} defaultValue={profile.location} maxLength={120} />
      </div>
      <LanguageTabs
        label="Profile text language"
        state={state}
        englishFields={["headline", "shortBio", "longBio", "approach"]}
        hindiFields={["locationHi", "headlineHi", "shortBioHi", "longBioHi", "approachHi"]}
        hindiFilled={Boolean(profile.headline_hi || profile.short_bio_hi || profile.long_bio_hi || profile.approach_hi)}
        english={
          <>
            <TextField
              name="headline"
              label="Headline"
              required
              state={state}
              defaultValue={profile.headline}
              maxLength={200}
              description="Shown on the home page, e.g. your role and who you help."
            />
            <TextAreaField name="shortBio" label="Short biography" required rows={3} state={state} defaultValue={profile.short_bio} maxLength={600} />
            <TextAreaField
              name="longBio"
              label="Full biography (Markdown)"
              rows={8}
              state={state}
              defaultValue={profile.long_bio}
              maxLength={6000}
            />
            <TextAreaField name="approach" label="Your approach (Markdown)" rows={5} state={state} defaultValue={profile.approach} maxLength={3000} />
          </>
        }
        hindi={
          <>
            <TextField name="locationHi" label="Location (Hindi)" lang="hi" state={state} defaultValue={profile.location_hi} maxLength={120} />
            <TextField name="headlineHi" label="Headline (Hindi)" lang="hi" state={state} defaultValue={profile.headline_hi} maxLength={200} />
            <TextAreaField
              name="shortBioHi"
              label="Short biography (Hindi)"
              lang="hi"
              rows={3}
              state={state}
              defaultValue={profile.short_bio_hi}
              maxLength={600}
            />
            <TextAreaField
              name="longBioHi"
              label="Full biography (Hindi, Markdown)"
              lang="hi"
              rows={8}
              state={state}
              defaultValue={profile.long_bio_hi}
              maxLength={6000}
            />
            <TextAreaField
              name="approachHi"
              label="Your approach (Hindi, Markdown)"
              lang="hi"
              rows={5}
              state={state}
              defaultValue={profile.approach_hi}
              maxLength={3000}
            />
          </>
        }
      />

      <ImageField
        key={profile.photo_url ?? "none"}
        label="Profile photo"
        fileName="photoFile"
        urlName="photoUrl"
        defaultUrl={profile.photo_url}
        state={state}
        description="A square photo works best."
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="contactEmail" label="Public contact email" type="email" state={state} defaultValue={profile.contact_email} />
        <TextField name="contactPhone" label="Public contact phone" type="tel" state={state} defaultValue={profile.contact_phone} />
      </div>

      <fieldset className="grid gap-3 rounded-lg p-3 ring-1 ring-border" aria-describedby={linksError ? "social-error" : undefined}>
        <legend className="px-1 text-sm font-medium">Social links</legend>
        {links.length === 0 ? <p className="text-sm text-muted-foreground">No links yet.</p> : null}
        {links.map((l, i) => (
          <div key={l.key} className="grid gap-2 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
            <div className="grid gap-1">
              <Label htmlFor={`${uid}-link-label-${i}`} className="text-xs">
                Label
              </Label>
              <Input
                id={`${uid}-link-label-${i}`}
                value={l.label}
                maxLength={40}
                placeholder="LinkedIn"
                onChange={(e) => setLinks((all) => all.map((x) => (x.key === l.key ? { ...x, label: e.target.value } : x)))}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor={`${uid}-link-url-${i}`} className="text-xs">
                URL
              </Label>
              <Input
                id={`${uid}-link-url-${i}`}
                type="url"
                value={l.url}
                maxLength={500}
                placeholder="https://"
                onChange={(e) => setLinks((all) => all.map((x) => (x.key === l.key ? { ...x, url: e.target.value } : x)))}
              />
            </div>
            <Button type="button" variant="ghost" size="icon-lg" onClick={() => setLinks((all) => all.filter((x) => x.key !== l.key))}>
              <Trash2 aria-hidden />
              <span className="sr-only">Remove link {i + 1}</span>
            </Button>
          </div>
        ))}
        {linksError ? (
          <p id="social-error" className="text-xs font-medium text-destructive">
            Check the social links: each needs a label and an http(s) URL.
          </p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={links.length >= 8}
          onClick={() => setLinks((all) => [...all, { key: nextKey++, label: "", url: "" }])}
        >
          <Plus aria-hidden /> Add link
        </Button>
      </fieldset>

      <fieldset className="grid gap-3 rounded-lg p-3 ring-1 ring-border" aria-describedby="points-help">
        <legend className="px-1 text-sm font-medium">Credibility points</legend>
        <p id="points-help" className="text-xs text-muted-foreground">
          Short, verifiable facts (e.g. years of experience, qualifications you actually hold). Up to 8.
        </p>
        <LanguageTabs
          label="Credibility points language"
          state={state}
          englishFields={["credibilityPoints"]}
          hindiFields={["credibilityPointsHi"]}
          hindiFilled={(profile.credibility_points_hi ?? []).length > 0}
          english={<PointList idPrefix={`${uid}-point`} points={points} setPoints={setPoints} error={pointsError} />}
          hindi={
            <>
              <p className="text-xs text-muted-foreground">
                If you add any Hindi points, the Hindi site shows only this list (in this order) instead of the English one.
              </p>
              <PointList
                idPrefix={`${uid}-point-hi`}
                points={pointsHi}
                setPoints={setPointsHi}
                error={pointsHiError}
                lang="hi"
                labelSuffix=" (Hindi)"
              />
            </>
          }
        />
      </fieldset>

      <div className="flex justify-end">
        <SubmitButton className="h-10 px-5">Save profile</SubmitButton>
      </div>
    </form>
  );
}

function PointList({
  idPrefix,
  points,
  setPoints,
  error,
  lang,
  labelSuffix = "",
}: {
  idPrefix: string;
  points: Point[];
  setPoints: Dispatch<SetStateAction<Point[]>>;
  error?: string;
  lang?: string;
  labelSuffix?: string;
}) {
  return (
    <div className="grid gap-3">
      {points.map((p, i) => (
        <div key={p.key} className="flex items-end gap-2">
          <div className="grid flex-1 gap-1">
            <Label htmlFor={`${idPrefix}-${i}`} className="text-xs">
              Point {i + 1}
              {labelSuffix}
            </Label>
            <Input
              id={`${idPrefix}-${i}`}
              value={p.text}
              lang={lang}
              maxLength={200}
              onChange={(e) => setPoints((all) => all.map((x) => (x.key === p.key ? { ...x, text: e.target.value } : x)))}
            />
          </div>
          <Button type="button" variant="ghost" size="icon-lg" onClick={() => setPoints((all) => all.filter((x) => x.key !== p.key))}>
            <Trash2 aria-hidden />
            <span className="sr-only">
              Remove point {i + 1}
              {labelSuffix}
            </span>
          </Button>
        </div>
      ))}
      {error ? <p className="text-xs font-medium text-destructive">Each point needs 2–200 characters.</p> : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={points.length >= 8}
        onClick={() => setPoints((all) => [...all, { key: nextKey++, text: "" }])}
      >
        <Plus aria-hidden /> Add point{labelSuffix}
      </Button>
    </div>
  );
}

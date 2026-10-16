"use client";

import { useEffect, useState } from "react";
import { ImageIcon, X } from "lucide-react";
import type { ActionState } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Image picker for the public-media bucket: either upload a PNG/JPEG/WebP file
 * (sent as `fileName`) or paste an https URL (sent as `urlName`). An uploaded
 * file takes precedence on the server.
 */
export function ImageField({
  label,
  fileName,
  urlName,
  defaultUrl,
  state,
  description,
}: {
  label: string;
  fileName: string;
  urlName: string;
  defaultUrl?: string | null;
  state?: ActionState;
  description?: string;
}) {
  const [url, setUrl] = useState(state?.values?.[urlName] ?? defaultUrl ?? "");
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState(0);

  // Parents pass `key={savedUrl}` so the field remounts after a successful save.
  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    };
  }, [filePreview]);

  const fileError = state?.fieldErrors?.[fileName]?.[0];
  const urlError = state?.fieldErrors?.[urlName]?.[0];
  const preview = filePreview ?? (/^https:\/\//i.test(url) ? url : null);

  return (
    <fieldset className="grid gap-3 rounded-lg p-3 ring-1 ring-border">
      <legend className="px-1 text-sm font-medium">{label}</legend>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex aspect-video w-full shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted sm:w-48">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="size-full object-cover" />
          ) : (
            <ImageIcon className="size-8 text-muted-foreground/60" aria-hidden />
          )}
        </div>
        <div className="grid min-w-0 flex-1 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor={`field-${fileName}`}>Upload image</Label>
            <input
              key={inputKey}
              id={`field-${fileName}`}
              name={fileName}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-invalid={fileError ? true : undefined}
              aria-describedby={`field-${fileName}-help`}
              onChange={(e) => {
                const f = e.target.files?.[0];
                setFilePreview(f ? URL.createObjectURL(f) : null);
              }}
              className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
            <p id={`field-${fileName}-help`} className="text-xs text-muted-foreground">
              PNG, JPEG or WebP, up to 4 MB. {description}
            </p>
            {fileError ? <p className="text-xs font-medium text-destructive">{fileError}</p> : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`field-${urlName}`}>…or image URL</Label>
            <div className="flex gap-2">
              <Input
                id={`field-${urlName}`}
                name={urlName}
                type="url"
                inputMode="url"
                placeholder="https://"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                aria-invalid={urlError ? true : undefined}
                aria-describedby={urlError ? `field-${urlName}-error` : undefined}
              />
              {url || filePreview ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setUrl("");
                    setFilePreview(null);
                    setInputKey((k) => k + 1);
                  }}
                >
                  <X aria-hidden />
                  <span className="sr-only">Remove image</span>
                </Button>
              ) : null}
            </div>
            {urlError ? (
              <p id={`field-${urlName}-error`} className="text-xs font-medium text-destructive">
                {urlError}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </fieldset>
  );
}

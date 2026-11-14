"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { addCompetitor, removeCompetitor } from "@/features/competitors/data";
import { deleteUserData } from "@/features/channel/store";
import { removeIdea, saveIdea, setCardState } from "@/features/feed/data";
import { forgetKeyword } from "@/features/keywords/data";
import { GOALS } from "@/features/onboarding/options";
import { getDb } from "@/lib/db";
import { logEvent } from "@/lib/log";
import { MODE_COOKIE } from "@/lib/mode";
import { SESSION_MAX_AGE } from "@/lib/session";
import { ensureUser, getViewer } from "@/lib/viewer";

const str = (form: FormData, key: string, max = 200) => String(form.get(key) ?? "").trim().slice(0, max);

/** Path of the page the form was submitted from, so actions can return to it. Same-origin only. */
async function backPath(fallback: string) {
  const h = await headers();
  const referer = h.get("referer");
  const host = h.get("host");
  try {
    if (referer) {
      const url = new URL(referer);
      if (url.host === host) return url.pathname + url.search;
    }
  } catch {
    // Malformed referer: use the fallback.
  }
  return fallback;
}

export async function setMode(form: FormData) {
  const mode = form.get("mode") === "live" ? "live" : "demo";
  (await cookies()).set(MODE_COOKIE, mode, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  revalidatePath("/", "layout");
  redirect(await backPath("/feed"));
}

export async function actOnCard(form: FormData) {
  const viewer = await getViewer();
  const status = str(form, "status");
  if (status !== "saved" && status !== "dismissed" && status !== "none") return;
  setCardState(
    viewer,
    { key: str(form, "key"), kind: str(form, "kind") as never, title: str(form, "title", 300), why: str(form, "why", 600), href: str(form, "href", 500) },
    status,
  );
  revalidatePath("/feed");
  revalidatePath("/saved");
}

export async function saveIdeaAction(form: FormData) {
  const viewer = await getViewer();
  const title = str(form, "title", 300);
  if (!title) return;
  saveIdea(viewer, { ref: str(form, "ref") || `idea:${title}`, kind: str(form, "kind") || "idea", title, body: str(form, "body", 600), href: str(form, "href", 500) });
  revalidatePath("/saved");
  redirect(await backPath("/saved"));
}

export async function removeIdeaAction(form: FormData) {
  removeIdea(await getViewer(), Number(form.get("id")));
  revalidatePath("/saved");
  revalidatePath("/feed");
}

export async function forgetKeywordAction(form: FormData) {
  forgetKeyword(await getViewer(), str(form, "phrase"));
  revalidatePath("/keywords");
}

export async function addCompetitorAction(form: FormData) {
  const error = await addCompetitor(await getViewer(), str(form, "channel", 300));
  revalidatePath("/competitors");
  redirect(error ? `/competitors?error=${encodeURIComponent(error)}` : "/competitors?added=1");
}

export async function removeCompetitorAction(form: FormData) {
  removeCompetitor(await getViewer(), str(form, "channelId"));
  revalidatePath("/competitors");
}

export async function savePreferences(form: FormData) {
  const viewer = await getViewer();
  ensureUser(viewer.userId);
  const step = str(form, "step");
  const db = getDb();
  if (step === "3") {
    const tz = str(form, "timezone", 60);
    let timezone: string | null = null;
    try {
      if (tz) timezone = new Intl.DateTimeFormat("en", { timeZone: tz }).resolvedOptions().timeZone;
    } catch {
      // Unknown timezone from the browser: keep the default.
    }
    db.prepare("UPDATE users SET niche = ?, language = ?, timezone = COALESCE(?, timezone) WHERE id = ?").run(
      str(form, "niche", 80) || null,
      str(form, "language", 10) || null,
      timezone,
      viewer.userId,
    );
    redirect("/onboarding?step=4");
  }
  if (step === "4") {
    const goal = str(form, "goal", 80);
    db.prepare("UPDATE users SET goal = ?, onboarded_at = datetime('now') WHERE id = ?").run(
      (GOALS as readonly string[]).includes(goal) ? goal : null,
      viewer.userId,
    );
    revalidatePath("/", "layout");
    redirect("/onboarding?step=5");
  }
  redirect("/onboarding");
}

export async function deleteMyData() {
  const viewer = await getViewer();
  deleteUserData(viewer.userId, viewer.channelId);
  logEvent("info", "privacy.data_deleted");
  revalidatePath("/", "layout");
  redirect("/settings?deleted=1");
}

// Daftar notulen dari IndexedDB untuk halaman Semua rapat / Kalender / Anggota / Arsip.
import { useEffect, useState } from "react";
import { deleteSession, getSession, listSessions, saveSession, type SessionRecord } from "./db";
import { asrWorker, persist } from "./engine";
import { DEFAULT_DURATION, speakerLabel, useStore, NOTE_SPEAKER } from "../store";

export const changed = () => window.dispatchEvent(new Event("sessions-changed"));

export function useSessions() {
  const [items, setItems] = useState<SessionRecord[]>([]);
  useEffect(() => {
    const refresh = () => listSessions().then(setItems).catch(() => setItems([]));
    refresh();
    window.addEventListener("sessions-changed", refresh);
    return () => window.removeEventListener("sessions-changed", refresh);
  }, []);
  return items;
}

export const when = (r: SessionRecord) => r.meetingAt ?? r.createdAt;
export const whenEnd = (r: SessionRecord) => r.meetingEndAt ?? when(r) + DEFAULT_DURATION;

/** Peserta = speaker yang benar-benar bicara di notulen ini (catatan manual tidak dihitung). */
export const participants = (r: Pick<SessionRecord, "segments" | "speakerNames">) =>
  [...new Set(r.segments.filter((s) => s.speaker !== NOTE_SPEAKER).map((s) => s.speaker))].map((i) => speakerLabel(r.speakerNames, i));

/** Notulen yang sedang terbuka → kosongkan dulu supaya autosave tidak menulisnya ulang. */
function leaveIfOpen(id: string) {
  if (id !== useStore.getState().sessionId) return;
  useStore.getState().newSession();
  asrWorker.postMessage({ type: "reset" });
}

export async function removeSession(id: string) {
  leaveIfOpen(id);
  await deleteSession(id);
  changed();
}

export async function setArchived(id: string, archived: boolean) {
  if (archived && id === useStore.getState().sessionId) {
    await persist(true); // simpan perubahan terakhir dulu, baru tandai diarsipkan
    leaveIfOpen(id);
  }
  const r = await getSession(id);
  if (!r) return;
  await saveSession({ ...r, archived });
  changed();
}

export const sameDay = (a: number, b: Date) => {
  const d = new Date(a);
  return d.getFullYear() === b.getFullYear() && d.getMonth() === b.getMonth() && d.getDate() === b.getDate();
};

export const fmtDate = (t: number, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) =>
  new Date(t).toLocaleDateString("id-ID", opts);
export const fmtClock = (t: number) => new Date(t).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
/** "19.30–20.30" */
export const fmtRange = (start: number, end: number) => `${fmtClock(start)}–${fmtClock(end)}`;

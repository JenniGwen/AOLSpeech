import { useEffect, useState } from "react";
import LoadingScreen from "./components/LoadingScreen";
import { sources, type Recorder } from "./components/RecordControls";
import { useRecorder, type Source } from "./audio/useRecorder";
import { persist, startEngine } from "./lib/engine";
import Archive from "./pages/Archive";
import Calendar from "./pages/Calendar";
import MeetingRoom from "./pages/MeetingRoom";
import Meetings from "./pages/Meetings";
import Members from "./pages/Members";
import Settings from "./pages/Settings";
import { useStore } from "./store";
import Sidebar, { MobileNav } from "./ui/Sidebar";

export default function App() {
  const title = useStore((s) => s.title);
  const meetingAt = useStore((s) => s.meetingAt);
  const meetingEndAt = useStore((s) => s.meetingEndAt);
  const status = useStore((s) => s.status);
  const page = useStore((s) => s.page);
  // perekam hidup di App supaya rekaman tetap berjalan saat pindah halaman
  const { start, stop } = useRecorder();
  const [source, setSource] = useState<Source>(sources[0].value);
  const rec: Recorder = { start, stop, source, setSource };

  useEffect(() => startEngine(), []);
  useEffect(() => { persist(); }, [title, meetingAt, meetingEndAt]);
  useEffect(() => { window.scrollTo(0, 0); }, [page]);

  if (status === "loading" || status === "error") return <LoadingScreen />;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1 pb-20 lg:pb-0">
        {page === "rapat" && <MeetingRoom rec={rec} />}
        {page === "semua" && <Meetings />}
        {page === "kalender" && <Calendar />}
        {page === "anggota" && <Members />}
        {page === "arsip" && <Archive />}
        {page === "pengaturan" && <Settings />}
      </main>
      <MobileNav />
    </div>
  );
}

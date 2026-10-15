import { useEffect } from "react";
import RecordControls from "./components/RecordControls";
import LiveTranscript from "./components/LiveTranscript";
import ModeSwitch from "./components/ModeSwitch";
import StatsBar from "./components/StatsBar";
import ExportButton from "./components/ExportButton";
import History from "./components/History";
import Banner from "./components/Banner";
import { persist, startEngine } from "./lib/engine";
import { useStore } from "./store";

export default function App() {
  const title = useStore((s) => s.title);
  useEffect(() => startEngine(), []);
  useEffect(() => { persist(); }, [title]);

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Live Notulen UKM</h1>
          <p className="text-sm text-slate-500">Transkrip live meeting Indonesia + English · Whisper-base fine-tuned · berjalan lokal di browser</p>
        </div>
      </header>

      <Banner />

      <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_280px]">
        <main className="flex min-w-0 flex-col gap-3">
          <RecordControls />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ModeSwitch />
            <ExportButton />
          </div>
          <LiveTranscript />
          <StatsBar />
        </main>
        <History />
      </div>
    </div>
  );
}

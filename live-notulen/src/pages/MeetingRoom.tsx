import Banner from "../components/Banner";
import ExportButton from "../components/ExportButton";
import TranscriptCard from "../components/LiveTranscript";
import { AgendaCard, TasksCard } from "../components/Planning";
import { MeetingMeta, RecordButton, SourceCard, type Recorder } from "../components/RecordControls";
import { useStore } from "../store";
import Topbar, { LangToggle } from "../ui/Topbar";

export default function MeetingRoom({ rec }: { rec: Recorder }) {
  const { title, setTitle, recording } = useStore();
  return (
    <>
      <Topbar
        crumb={recording ? "Rapat berjalan" : "Ruang rapat"}
        title={
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Judul rapat"
            className="-ml-2 w-full rounded-lg border border-transparent px-2 text-2xl font-bold tracking-tight outline-none hover:border-slate-200 focus:border-brand-400"
          />
        }
      >
        <LangToggle />
        <ExportButton />
        <RecordButton rec={rec} />
      </Topbar>
      <div className="space-y-6 px-5 py-7 sm:px-10">
        <MeetingMeta />
        <Banner />
        <SourceCard rec={rec} />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          <TranscriptCard />
          <div className="space-y-6">
            <TasksCard />
            <AgendaCard />
          </div>
        </div>
      </div>
    </>
  );
}

// Panel kanan ruang rapat: Tindak lanjut (tugas + PIC + tenggat) dan Agenda rapat. Disimpan bersama notulen.
import { useState } from "react";
import { persist } from "../lib/engine";
import { participants } from "../lib/sessions";
import { newId, useStore, type AgendaItem, type Task } from "../store";
import Avatar, { toneOf } from "../ui/Avatar";
import Icon from "../ui/Icon";

const save = () => persist();

function Check({ on, onClick, label }: { on: boolean; onClick(): void; label: string }) {
  return (
    <button onClick={onClick} aria-pressed={on} aria-label={label}
      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${on ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white hover:border-brand-400"}`}>
      {on && <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} />}
    </button>
  );
}

/** "Besok", "Hari ini", "17 Okt" (merah kalau sudah lewat/dekat). */
function dueLabel(due: string) {
  if (!due) return null;
  const d = new Date(`${due}T00:00`), today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  const text = diff === 0 ? "Hari ini" : diff === 1 ? "Besok" : diff === -1 ? "Kemarin" : d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  return { text, urgent: diff <= 2 };
}

function TaskForm({ onDone }: { onDone(): void }) {
  const { segments, speakerNames, tasks, setTasks } = useStore();
  const [text, setText] = useState(""), [who, setWho] = useState(""), [due, setDue] = useState("");
  const names = participants({ segments, speakerNames }).filter((n) => !/^Speaker \d+$/.test(n));
  const submit = () => {
    if (!text.trim()) return;
    setTasks([...tasks, { id: newId(), text: text.trim(), who: who.trim(), due, done: false }]);
    save();
    onDone();
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="mb-3 space-y-2 rounded-xl bg-slate-50 p-3">
      <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Tugas, mis. Kirim formulir peminjaman aula" className="field w-full bg-white" />
      <div className="flex gap-2">
        <input value={who} onChange={(e) => setWho(e.target.value)} list="task-people" placeholder="PIC" className="field min-w-0 flex-1 bg-white" />
        <datalist id="task-people">{names.map((n) => <option key={n} value={n} />)}</datalist>
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="field bg-white" aria-label="Tenggat" />
      </div>
      <div className="flex justify-end gap-2 text-xs">
        <button type="button" onClick={onDone} className="rounded-lg px-3 py-1.5 font-semibold text-slate-500 hover:bg-white">Batal</button>
        <button type="submit" disabled={!text.trim()} className="rounded-lg bg-brand-500 px-3 py-1.5 font-semibold text-white hover:bg-brand-600 disabled:opacity-40">Tambah</button>
      </div>
    </form>
  );
}

export function TasksCard() {
  const { tasks, setTasks } = useStore();
  const [adding, setAdding] = useState(false);
  const [all, setAll] = useState(false);
  const update = (id: string, patch: Partial<Task> | null) => {
    setTasks(patch ? tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) : tasks.filter((t) => t.id !== id));
    save();
  };
  const open = tasks.filter((t) => !t.done).length;
  const shown = all ? tasks : tasks.slice(0, 4);

  return (
    <section className="card p-6">
      <div className="mb-4 flex items-center gap-3">
        <h3 className="text-lg font-bold">Tindak lanjut</h3>
        <span className="chip bg-slate-100 text-slate-500">{open} tugas</span>
        <button onClick={() => setAdding(true)} className="icon-btn ml-auto h-9 w-9" aria-label="Tambah tugas"><Icon name="plus" className="h-4 w-4" /></button>
      </div>
      {adding && <TaskForm onDone={() => setAdding(false)} />}
      {!tasks.length && !adding && <p className="py-4 text-sm text-slate-400">Belum ada tugas. Catat siapa mengerjakan apa supaya tidak terlupa.</p>}
      <ul className="divide-y divide-slate-100">
        {shown.map((t) => {
          const due = dueLabel(t.due);
          return (
            <li key={t.id} className="group flex gap-3 py-4 first:pt-1">
              <Check on={t.done} onClick={() => update(t.id, { done: !t.done })} label={`Tandai selesai: ${t.text}`} />
              <div className="min-w-0 flex-1">
                <div className={`text-sm font-semibold ${t.done ? "text-slate-400 line-through" : ""}`}>{t.text}</div>
                {(t.who || due) && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                    {t.who && <Avatar name={t.who} tone={toneOf(t.who)} size="h-6 w-6 text-[9px]" />}
                    {t.who && <span>{t.who.split(" ")[0]}</span>}
                    {t.who && due && <span>·</span>}
                    {due && <span className={`font-semibold ${due.urgent && !t.done ? "text-rose-500" : ""}`}>{due.text}</span>}
                  </div>
                )}
              </div>
              <button onClick={() => update(t.id, null)} className="h-7 w-7 shrink-0 rounded-lg text-slate-300 opacity-0 hover:bg-slate-100 hover:text-rose-500 group-hover:opacity-100" aria-label="Hapus tugas">
                <Icon name="x" className="mx-auto h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>
      {tasks.length > 4 && (
        <button onClick={() => setAll((a) => !a)} className="mt-2 flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700">
          {all ? "Tampilkan lebih sedikit" : "Lihat semua tugas"} <Icon name="right" className="h-4 w-4" />
        </button>
      )}
    </section>
  );
}

export function AgendaCard() {
  const { agenda, setAgenda } = useStore();
  const [text, setText] = useState("");
  const update = (id: string, patch: Partial<AgendaItem> | null) => {
    setAgenda(patch ? agenda.map((a) => (a.id === id ? { ...a, ...patch } : a)) : agenda.filter((a) => a.id !== id));
    save();
  };
  const add = () => {
    if (!text.trim()) return;
    setAgenda([...agenda, { id: newId(), text: text.trim(), done: false }]);
    setText("");
    save();
  };
  const done = agenda.filter((a) => a.done).length;

  return (
    <section className="card p-6">
      <div className="mb-4 flex items-center gap-3">
        <h3 className="text-lg font-bold">Agenda rapat</h3>
        {agenda.length > 0 && <span className="chip bg-slate-100 text-slate-500">{done} dari {agenda.length} selesai</span>}
      </div>
      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all" style={{ width: `${agenda.length ? (done / agenda.length) * 100 : 0}%` }} />
      </div>
      <ol className="space-y-1">
        {agenda.map((a, i) => (
          <li key={a.id} className="group flex items-center gap-3 rounded-lg py-1.5">
            <button onClick={() => update(a.id, { done: !a.done })} aria-pressed={a.done} aria-label={`Tandai dibahas: ${a.text}`}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition ${a.done ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500 hover:bg-brand-100 hover:text-brand-600"}`}>
              {a.done ? <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.5} /> : i + 1}
            </button>
            <span className={`flex-1 text-sm ${a.done ? "text-slate-400 line-through" : ""}`}>{a.text}</span>
            <button onClick={() => update(a.id, null)} className="h-7 w-7 rounded-lg text-slate-300 opacity-0 hover:bg-slate-100 hover:text-rose-500 group-hover:opacity-100" aria-label="Hapus agenda">
              <Icon name="x" className="mx-auto h-4 w-4" />
            </button>
          </li>
        ))}
      </ol>
      <form onSubmit={(e) => { e.preventDefault(); add(); }} className="mt-3 flex items-center gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Tambah poin agenda…" className="field flex-1" />
        <button type="submit" disabled={!text.trim()} className="icon-btn h-9 w-9" aria-label="Tambah agenda"><Icon name="plus" className="h-4 w-4" /></button>
      </form>
    </section>
  );
}

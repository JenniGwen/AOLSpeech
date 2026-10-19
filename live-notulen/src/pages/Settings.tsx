import { HF_REPO } from "../config";
import { useStore, type Profile } from "../store";
import Topbar from "../ui/Topbar";

const FIELDS: { key: keyof Profile; label: string }[] = [
  { key: "name", label: "Nama" },
  { key: "role", label: "Jabatan" },
  { key: "org", label: "Organisasi / UKM" },
  { key: "campus", label: "Kampus" },
];

export default function Settings() {
  const { profile, setProfile, backend } = useStore();
  return (
    <>
      <Topbar crumb="Pengaturan" title="Pengaturan" />
      <div className="grid gap-6 px-5 py-7 sm:px-10 xl:grid-cols-2">
        <section className="card p-7">
          <h2 className="text-lg font-semibold">Profil & organisasi</h2>
          <p className="mb-5 text-xs text-slate-500">Disimpan di browser ini saja.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <label key={f.key} className="text-sm font-medium text-slate-600">
                {f.label}
                <input value={profile[f.key]} onChange={(e) => setProfile({ [f.key]: e.target.value })} className="field mt-1.5 w-full" />
              </label>
            ))}
          </div>
        </section>
        <section className="card p-7">
          <h2 className="text-lg font-semibold">Model pengenalan suara</h2>
          <p className="mb-5 text-xs text-slate-500">Semua proses berjalan lokal — audio tidak dikirim ke server.</p>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Model ASR</dt><dd className="truncate font-semibold">{HF_REPO}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Backend</dt><dd className="font-semibold">{backend ? (backend === "webgpu" ? "WebGPU" : "WASM") : "–"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Penyimpanan notulen</dt><dd className="font-semibold">IndexedDB (browser ini)</dd></div>
          </dl>
        </section>
      </div>
    </>
  );
}

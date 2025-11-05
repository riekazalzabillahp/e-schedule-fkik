import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import Header from "./components/Header";
import Footer from "./components/Footer";
import Login from "./pages/Login";
import RoomUsageCarouselPerFloor from "./components/RoomUsageCarouselPerFloor";

/* ======================== Konstanta ======================== */
const HARI = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
const HARI_ORDER = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"];
const HARI_SET = new Set(HARI_ORDER.map(h=>h.toLowerCase()));

const START_TIME = "07:00";
const END_TIME   = "18:00";
const PAGE_SIZE  = 10;


// YYYY-MM-DD versi LOKAL (bukan UTC)
const toLocalISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const PRODI = [
  "KEPERAWATAN","KESEHATAN MASYARAKAT","FARMASI","KEBIDANAN (D3)", "PENDIDIKAN DOKTER",
  "PROFESI NERS","KEBIDANAN (S1)","PROFESI APOTEKER","PENDIDIKAN PROFESI BIDAN", "PROFESI DOKTER",
];
const PRODI_COLORS = {
  "KEPERAWATAN": "hsl(200 80% 90%)",
  "KESEHATAN MASYARAKAT": "hsl(20 80% 90%)",
  "FARMASI": "hsl(140 80% 90%)",
  "KEBIDANAN (D3)": "hsl(320 80% 90%)",
  "PENDIDIKAN DOKTER" : "hsla(201, 53%, 89%, 1.00)",
  "PROFESI NERS": "hsl(260 80% 90%)",
  "KEBIDANAN (S1)": "hsl(80 80% 90%)",
  "PROFESI APOTEKER": "hsl(0 80% 90%)",
  "PENDIDIKAN PROFESI BIDAN": "hsl(100 80% 90%)",
  "PROFESI DOKTER" : "hsla(185, 26%, 90%, 1.00)"
};
const prodiColor = (p)=> PRODI_COLORS[p] || "hsl(200 20% 95%)";
const ProdiBadge = ({p}) => (
  <span className="inline-block px-2 py-0.5 rounded-full text-[11px] border"
        style={{background: prodiColor(p), borderColor:"#ddd"}}>{p}</span>
);
const normStr = v => (v==null? "" : String(v).trim());
const normProdi = v => normStr(v).toUpperCase();
const slugify = (s)=> String(s||"").toLowerCase().replace(/\s+/g,"-").replace(/[()]/g,"");
const findProdiBySlug = (slug)=> PRODI.find(p => slugify(p) === slug);
const normHari = v => {
  const map={senin:"Senin",selasa:"Selasa",rabu:"Rabu",kamis:"Kamis",jumat:"Jumat",sabtu:"Sabtu",minggu:"Minggu"};
  const key=normStr(v).toLowerCase(); return map[key]||normStr(v);
};
// di file React yang ada dropdown gedung (mis. App.jsx / ScheduleForm)
const GEDUNG_OPTIONS = ["Gedung B", "Gedung AB", "Gedung C"];
// NEW: asset helper agar aman terhadap base path Vite
const asset = (p) => `${import.meta.env.BASE_URL}${p}`;
/** pakai proxy vite (lihat vite.config.js) */
const API = "/api/jadwal";
// tampilkan hanya tanggal (apapun bentuk inputnya)
const dateOnly = (v) => (v ? String(v).slice(0, 10) : "");
// --- 1) Fallback via NAMA (untuk kasus tanpa NIP) ---
const _normPerson = (s) =>
  String(s || "")
    .replace(/\./g, " ")     // rapikan gelar/initial
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const _splitDosen = (s) =>
  String(s || "")
    .split(/[,&;/]+/g)       // dukung "A, B", "A/B", "A & B"
    .map(_normPerson)
    .filter(Boolean);

const _splitNip = (s) =>
  String(s || "")
    .split(/[,&;/\s]+/g)
    .map(x => x.replace(/\D/g, "").trim())  // hanya digit
    .filter(Boolean);
/* ======================== FUNGSI ======================== */
function compactPages(current, total, radius = 2) {
  const s = new Set([1, total]);
  for (let i = current - radius; i <= current + radius; i++) {
    if (i >= 1 && i <= total) s.add(i);
  }
  return Array.from(s).sort((a, b) => a - b);
}

function toMinutes(t){
  if(t==null) return NaN;
  if(t instanceof Date) return t.getHours()*60+t.getMinutes();
  if(typeof t==="number"){
    if(t>=0 && t<=1) return Math.round(t*24*60);
    if(t>59 && t<2400){const h=Math.floor(t/100), m=Math.round(t%100); if(h>=0&&h<24&&m>=0&&m<60) return h*60+m;}
    if(t>=0 && t<=24*60) return t;
  }
  if(typeof t==="string"){
    let s=t.trim(); if(!s) return NaN;
    s=s.replace(/\s+/g,"").replace(/(WIB|WITA|WIT)/ig,"").replace(/,/g,".").replace(/[.\-]/g,":");
    let m=s.match(/^([0-1]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/); if(m) return parseInt(m[1],10)*60+parseInt(m[2],10);
    m=s.match(/^([0-2]?\d)([0-5]\d)$/); if(m){const h=parseInt(m[1],10), mm=parseInt(m[2],10); if(h>=0&&h<24&&mm>=0&&mm<60) return h*60+mm;}
    const f=Number(s); if(!Number.isNaN(f)){ if(f<24 && f%1!==0) return Math.round(f*60); if(f>=0 && f<24 && Number.isInteger(f)) return f*60; }
  }
  return NaN;
}
function minutesToLabel(m){ if(!isFinite(m)) return "--:--"; return String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0"); }
function getTodayName(){ return new Date().toLocaleDateString("id-ID",{weekday:"long"}).replace(/^./,c=>c.toUpperCase()); }
function formatTodayID(d=new Date()){ return d.toLocaleDateString("id-ID",{weekday:"long",day:"2-digit",month:"short",year:"numeric"}); }
function useNow(){const [n,setN]=useState(new Date()); useEffect(()=>{const id=setInterval(()=>setN(new Date()),60e3); return ()=>clearInterval(id);},[]); return n;}

// Excel serial number -> 'YYYY-MM-DD'
function excelSerialToISO(n) {
  // Excel epoch 1899-12-30
  const base = new Date(Date.UTC(1899, 11, 30));
  const d = new Date(base.getTime() + Number(n) * 86400000);
  return d.toISOString().slice(0, 10);
}

function parseHariAktif(input){
  if (!input) return [];
  let s = String(input).trim().toLowerCase();
  s = s.replace(/\s*s\.?d\.?\s*/g, "-").replace(/[–—]/g,"-").replace(/\s+to\s+/g,"-").replace(/\s+/g," ");
  const uc1 = x => x.replace(/^./, c=>c.toUpperCase());
  const normOne = (x) => {
    const t = x.trim();
    const found = HARI_ORDER.find(h => h.toLowerCase() === t);
    return found || uc1(t);
  };
  const range = s.match(/^([a-z]+)\s*-\s*([a-z]+)$/i);
  if (range){
    const a = normOne(range[1]), b = normOne(range[2]);
    const ia = HARI_ORDER.indexOf(a), ib = HARI_ORDER.indexOf(b);
    if (ia>-1 && ib>-1){
      const out = [];
      for (let i=ia; ; i=(i+1)%HARI_ORDER.length){
        out.push(HARI_ORDER[i]);
        if (i===ib) break;
      }
      return out.filter(h => HARI_SET.has(h.toLowerCase()));
    }
  }
  const parts = s.split(/[,;|/]+|\s+/).filter(Boolean);
  const out = parts.map(normOne).filter(h => HARI_SET.has(h.toLowerCase()));
  return Array.from(new Set(out)).sort((a,b)=>HARI_ORDER.indexOf(a)-HARI_ORDER.indexOf(b));
}

function parseDate(v){
  if (v == null || v === "") return "";
  // Excel serial (angka murni, biasanya > 30000)
  if (typeof v === "number" && isFinite(v)) {
    return excelSerialToISO(v);
  }
  const s = String(v).trim();
  const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m1) return s;
  const m2 = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (m2) {
    const [_, d, mo, y] = m2;
    return `${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  }
  // fallback: kalau ada timestamp ISO, ambil 10 char pertama
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0,10);
  return "";
}

function isActiveOnDay(item, dayLabel, dateObj){
  const tipe = String(item.tipe || 'mingguan');
  if (tipe !== 'blok') {
    return normHari(item.hari) === dayLabel;
  }
  const dStr = toLocalISO(dateObj);
  if (item.tgl_mulai && dStr < item.tgl_mulai) return false;
  if (item.tgl_selesai && dStr > item.tgl_selesai) return false;
  const aktif = (item.hari_aktif || '').split(',').map(s=>s.trim()).filter(Boolean);
  return aktif.length ? aktif.includes(dayLabel) : true;
}

function Pagination({ page, setPage, totalPages }) {
  if (totalPages <= 1) return null;

  // ===== Compact mode for very small screens =====
  const [compact, setCompact] = React.useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 380px)").matches : false
  );
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 380px)");
    const onChange = () => setCompact(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const radius = compact ? 1 : 2;
  const pages = compactPages(page, totalPages, radius);

  const btnBase =
    "min-w-[44px] h-11 sm:h-9 px-3 rounded-lg border text-sm " +
    "active:scale-[.98] transition select-none " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 " +
    "disabled:opacity-50 disabled:cursor-not-allowed";

  const goFirst = () => setPage(1);
  const goPrev  = () => setPage((p) => Math.max(1, p - 1));
  const goNext  = () => setPage((p) => Math.min(totalPages, p + 1));
  const goLast  = () => setPage(totalPages);

  // Keyboard arrows support
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
      if (e.key === "ArrowRight") { e.preventDefault(); goNext(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [totalPages, page]);

  return (
    <nav
      className="mt-3 flex items-center justify-center gap-1 sm:gap-1.5"
      aria-label="Pagination"
      role="navigation"
    >
      {/* First */}
      <button
        onClick={goFirst}
        disabled={page === 1}
        className={btnBase}
        aria-label="Halaman pertama"
        title="Halaman pertama"
      >
        «
      </button>

      {/* Prev */}
      <button
        onClick={goPrev}
        disabled={page === 1}
        className={btnBase}
        aria-label="Sebelumnya"
        title="Sebelumnya"
      >
        ‹
      </button>

      {/* Numbers */}
      {pages.map((n, i) => {
        const prev = pages[i - 1];
        const isCurrent = page === n;
        return (
          <React.Fragment key={n}>
            {i > 0 && n - prev > 1 && (
              <span className="px-2 text-gray-500 select-none" aria-hidden="true">
                …
              </span>
            )}
            <button
              onClick={() => setPage(n)}
              className={`${btnBase} ${isCurrent ? "bg-black text-white" : "bg-white hover:bg-gray-50"}`}
              aria-label={`Halaman ${n}`}
              aria-current={isCurrent ? "page" : undefined}
              title={`Halaman ${n}`}
            >
              {n}
            </button>
          </React.Fragment>
        );
      })}

      {/* Next */}
      <button
        onClick={goNext}
        disabled={page === totalPages}
        className={btnBase}
        aria-label="Berikutnya"
        title="Berikutnya"
      >
        ›
      </button>

      {/* Last */}
      <button
        onClick={goLast}
        disabled={page === totalPages}
        className={btnBase}
        aria-label="Halaman terakhir"
        title="Halaman terakhir"
      >
        »
      </button>
    </nav>
  );
}

// ==== Bentrok (conflict) helpers ====
function _timeOverlap(S1, E1, S2, E2) {
  return S1 < E2 && S2 < E1; // ada irisan
}
function _activeDaysForItem(it) {
  // Set hari aktif item (Senin..Sabtu)
  if (String(it.tipe || 'mingguan') === 'blok') {
    const days = (it.hari_aktif && parseHariAktif(it.hari_aktif)) || HARI;
    return new Set(days.map(normHari));
  }
  return new Set([normHari(it.hari)]);
}
function _dateRangeOverlap(a, b) {
  // mingguan = selalu aktif (anggap 0000..9999)
  const aStart = a.tipe === 'blok' && a.tgl_mulai ? a.tgl_mulai : '0000-01-01';
  const aEnd   = a.tipe === 'blok' && a.tgl_selesai ? a.tgl_selesai : '9999-12-31';
  const bStart = b.tipe === 'blok' && b.tgl_mulai ? b.tgl_mulai : '0000-01-01';
  const bEnd   = b.tipe === 'blok' && b.tgl_selesai ? b.tgl_selesai : '9999-12-31';
  return !(aEnd < bStart || bEnd < aStart);
}

function _sameDosen(a, b) {
  const A = new Set(_splitDosen(a.dosen));
  if (A.size === 0) return false;
  for (const d of _splitDosen(b.dosen)) if (A.has(d)) return true;
  return false;
}

function _sameDosenByNip(a, b) {
  const A = new Set(_splitNip(a.nip));
  if (A.size === 0) return false;
  for (const n of _splitNip(b.nip)) if (A.has(n)) return true;
  return false;
}

function isSameLecturer(a, b) {
  const Ahas = _splitNip(a.nip).length > 0;
  const Bhas = _splitNip(b.nip).length > 0;
  if (Ahas && Bhas) return _sameDosenByNip(a, b); // prioritas NIP
  return _sameDosen(a, b);                        // fallback ke nama
}
/**
 * detectConflicts(rows) -> object { [id]: [{id, reason, day}] }
 * Reason: 'ruangan' (gedung+ruangan sama) atau 'kelas' (prodi+kelas sama).
 */
function detectConflicts(rows) {
  const out = new Map(); // id -> details[]
  const N = rows.length;

  for (let i = 0; i < N; i++) {
    const a = rows[i];
    const Sa = toMinutes(a.jam_mulai), Ea = toMinutes(a.jam_selesai);
    if (!isFinite(Sa) || !isFinite(Ea) || Ea <= Sa) continue;

    const daysA = _activeDaysForItem(a);
    const roomAKey = (normStr(a.gedung) + '|' + normStr(a.ruangan)).toLowerCase();
    const hasRoomA = !!(normStr(a.gedung) || normStr(a.ruangan));
    const classAKey = (normProdi(a.prodi) + '|' + normStr(a.kelas)).toLowerCase();
    const hasClassA = !!(normProdi(a.prodi) && normStr(a.kelas));

    for (let j = i + 1; j < N; j++) {
      const b = rows[j];
      const Sb = toMinutes(b.jam_mulai), Eb = toMinutes(b.jam_selesai);
      if (!isFinite(Sb) || !isFinite(Eb) || Eb <= Sb) continue;

      if (!_dateRangeOverlap(a, b)) continue;

      // irisan hari
      const daysB = _activeDaysForItem(b);
      let sharedDay = null;
      for (const d of daysA) { if (daysB.has(d)) { sharedDay = d; break; } }
      if (!sharedDay) continue;

      // irisan waktu
      if (!_timeOverlap(Sa, Ea, Sb, Eb)) continue;

      // alasan bentrok
      const roomBKey = (normStr(b.gedung) + '|' + normStr(b.ruangan)).toLowerCase();
      const hasRoomB = !!(normStr(b.gedung) || normStr(b.ruangan));
      const classBKey = (normProdi(b.prodi) + '|' + normStr(b.kelas)).toLowerCase();
      const hasClassB = !!(normProdi(b.prodi) && normStr(b.kelas));

      const reasons = [];
      if (hasRoomA && hasRoomB && roomAKey === roomBKey) reasons.push('ruangan');
      if (hasClassA && hasClassB && classAKey === classBKey) reasons.push('kelas');

      // Prioritas NIP → kalau dua2nya kosong, jatuh ke nama
      if (isSameLecturer(a, b)) reasons.push('dosen');

      if (!reasons.length) continue;

      const add = (id, other, reason) => {
        const arr = out.get(id) || [];
        arr.push({ id: other.id, reason, day: sharedDay });
        out.set(id, arr);
      };
      add(a.id, b, reasons.join('+'));
      add(b.id, a, reasons.join('+'));
    }
  }

  const obj = {};
  for (const [k, v] of out) obj[k] = v;
  return obj;
}

function ConflictDetails({ data }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState({ ruangan: true, kelas: true, dosen: true });
  const tsFile = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

  const conflictsMap = useMemo(() => detectConflicts(data), [data]);
  const byId = useMemo(() => {
    const m = new Map();
    data.forEach(d => m.set(String(d.id), d));
    return m;
  }, [data]);

  const pairs = useMemo(() => {
    const seen = new Set();
    const rows = [];

    for (const [aid, arr] of Object.entries(conflictsMap)) {
      arr.forEach(({ id: bid, reason, day }) => {
        const a = String(aid), b = String(bid);
        const key = [a < b ? a : b, a < b ? b : a, reason, day].join("|");
        if (seen.has(key)) return;
        seen.add(key);

        const A = byId.get(a), B = byId.get(b);
        if (!A || !B) return;

        const Sa = toMinutes(A.jam_mulai), Ea = toMinutes(A.jam_selesai);
        const Sb = toMinutes(B.jam_mulai), Eb = toMinutes(B.jam_selesai);

        rows.push({ A, B, reason, day, Sa, Ea, Sb, Eb });
      });
    }

    const order = new Map(HARI.map((h, i) => [h, i]));
    rows.sort((x, y) => {
      const dx = (order.get(normHari(x.day)) ?? 99) - (order.get(normHari(y.day)) ?? 99);
      if (dx !== 0) return dx;
      const s1 = Math.min(x.Sa, x.Sb), s2 = Math.min(y.Sa, y.Sb);
      if (s1 !== s2) return s1 - s2;
      return String(x.reason).localeCompare(String(y.reason));
    });
    return rows;
  }, [conflictsMap, byId]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return pairs.filter(p => {
      const tokens = String(p.reason).split("+");
      if (!tokens.some(t => filter[t])) return false;

      if (!qq) return true;
      const hay =
        (p.A.mata_kuliah || "") + " " + (p.A.prodi || "") + " " + (p.A.kelas || "") + " " +
        (p.A.gedung || "") + " " + (p.A.ruangan || "") + " " + (p.A.dosen || "") + " " +
        (p.B.mata_kuliah || "") + " " + (p.B.prodi || "") + " " + (p.B.kelas || "") + " " +
        (p.B.gedung || "") + " " + (p.B.ruangan || "") + " " + (p.B.dosen || "");
      return hay.toLowerCase().includes(qq);
    });
  }, [pairs, q, filter]);

  // ==== EXPORT ====
  const buildExportRows = () => filtered.map(p => ({
    Hari: p.day,
    Alasan: p.reason.replace(/\+/g, " + "),
    Mulai: minutesToLabel(Math.min(p.Sa, p.Sb)),
    Selesai: minutesToLabel(Math.max(p.Ea, p.Eb)),
    "MK A": p.A.mata_kuliah || "",
    "Prodi A": p.A.prodi || "",
    "Kelas A": p.A.kelas || "",
    "Semester A": p.A.semester || "",
    "Gedung A": p.A.gedung || "",
    "Ruang A": p.A.ruangan || "",
    "Dosen A": p.A.dosen || "",
    "NIP A": p.A.nip || "",
    "MK B": p.B.mata_kuliah || "",
    "Prodi B": p.B.prodi || "",
    "Kelas B": p.B.kelas || "",
    "Semester B": p.B.semester || "",
    "Gedung B": p.B.gedung || "",
    "Ruang B": p.B.ruangan || "",
    "Dosen B": p.B.dosen || "",
    "NIP B": p.B.nip || "",
  }));

  const exportCSV = () => {
    const rows = buildExportRows();
    if (!rows.length) return alert("Tidak ada data untuk diekspor.");
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bentrok");
    XLSX.writeFile(wb, `bentrok_jadwal_${tsFile()}.csv`, { bookType: "csv" });
  };

  const exportXLSX = () => {
    const rows = buildExportRows();
    if (!rows.length) return alert("Tidak ada data untuk diekspor.");
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bentrok");
    XLSX.writeFile(wb, `bentrok_jadwal_${tsFile()}.xlsx`);
  };

  const totalPairs = pairs.length;

  const ReasonBadge = ({ r }) => {
    const label = r.replace(/\+/g, " + ");
    const cls =
      r.includes("ruangan") ? "bg-orange-100 text-orange-700" :
      r.includes("dosen")   ? "bg-purple-100 text-purple-700" :
      r.includes("kelas")   ? "bg-blue-100 text-blue-700" :
                              "bg-gray-100 text-gray-700";
    return <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${cls}`}>{label}</span>;
  };

  // Pagination
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [q, filter, pairs]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <section className="bg-white rounded-2xl p-4 border">
      {/* Toolbar (mobile-first) */}
      <div className="mb-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Detail Bentrok</span>
            <span className="text-sm text-gray-600">• Ditemukan <b>{totalPairs}</b> pasangan</span>
          </div>

          {/* Filter chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {["ruangan","kelas","dosen"].map(key => (
              <button
                key={key}
                onClick={() => setFilter(f => ({ ...f, [key]: !f[key] }))}
                className={`px-2.5 py-1 rounded-full text-xs border transition
                  ${filter[key] ? "bg-black text-white border-black" : "bg-white text-gray-700 hover:bg-gray-50"}`}
              >
                {key[0].toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>

          {/* Right tools → wrap on mobile */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:ml-auto">
            <input
              className="border rounded-lg px-3 py-2 text-sm w-full sm:w-64"
              placeholder="Cari prodi/kelas/mk/ruang/dosen…"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                onClick={exportCSV}
                className="px-3 py-2 rounded-md border text-sm hover:bg-gray-50"
                title="Ekspor hasil filter ke CSV"
              >
                CSV
              </button>
              <button
                onClick={exportXLSX}
                className="px-3 py-2 rounded-md bg-emerald-700 text-white text-sm hover:opacity-90"
                title="Ekspor hasil filter ke Excel"
              >
                Excel
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE CARDS */}
      <div className="sm:hidden space-y-3">
        {pageRows.length === 0 ? (
          <div className="p-4 text-center text-gray-500 border rounded-xl">
            Tidak ada bentrok yang cocok dengan filter.
          </div>
        ) : (
          pageRows.map((p, idx) => (
            <div key={idx} className="rounded-xl border bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">{normHari(p.day)}</div>
                <div className="text-xs text-gray-600">
                  {minutesToLabel(Math.min(p.Sa, p.Sb))}–{minutesToLabel(Math.max(p.Ea, p.Eb))}
                </div>
              </div>
              <div className="mt-1"><ReasonBadge r={p.reason} /></div>

              <div className="mt-2">
                <div className="text-[13px] font-medium">Item A</div>
                <div className="text-sm">{p.A.mata_kuliah} {p.A.fase ? <span className="text-xs text-gray-500">({p.A.fase})</span> : null}</div>
                <div className="mt-1 flex flex-wrap gap-1 text-[12px] text-gray-700">
                  <ProdiBadge p={p.A.prodi} />
                  <span className="px-2 py-0.5 rounded-full border">Kelas {p.A.kelas}</span>
                  {(p.A.gedung || p.A.ruangan) && (
                    <span className="px-2 py-0.5 rounded-full border">
                      {p.A.gedung || "-"} {p.A.ruangan ? `• ${p.A.ruangan}` : ""}
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-gray-500 mt-0.5">
                  {(p.A.dosen || "-")}{p.A.nip ? ` • NIP: ${p.A.nip}` : ""}
                </div>
              </div>

              <div className="mt-3">
                <div className="text-[13px] font-medium">Item B</div>
                <div className="text-sm">{p.B.mata_kuliah} {p.B.fase ? <span className="text-xs text-gray-500">({p.B.fase})</span> : null}</div>
                <div className="mt-1 flex flex-wrap gap-1 text-[12px] text-gray-700">
                  <ProdiBadge p={p.B.prodi} />
                  <span className="px-2 py-0.5 rounded-full border">Kelas {p.B.kelas}</span>
                  {(p.B.gedung || p.B.ruangan) && (
                    <span className="px-2 py-0.5 rounded-full border">
                      {p.B.gedung || "-"} {p.B.ruangan ? `• ${p.B.ruangan}` : ""}
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-gray-500 mt-0.5">
                  {(p.B.dosen || "-")}{p.B.nip ? ` • NIP: ${p.B.nip}` : ""}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* DESKTOP TABLE */}
      <div className="hidden sm:block overflow-auto rounded-xl border mt-2">
        {pageRows.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            Tidak ada bentrok yang cocok dengan filter.
          </div>
        ) : (
          <table className="min-w-[980px] text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-3 text-left">Hari</th>
                <th className="p-3 text-left">Alasan</th>
                <th className="p-3 text-left">Waktu</th>
                <th className="p-3 text-left w-[45%]">Item A</th>
                <th className="p-3 text-left w-[45%]">Item B</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((p, idx) => (
                <tr key={idx} className="border-t bg-white align-top">
                  <td className="p-3 whitespace-nowrap">{normHari(p.day)}</td>
                  <td className="p-3"><ReasonBadge r={p.reason} /></td>
                  <td className="p-3 whitespace-nowrap">
                    {minutesToLabel(Math.min(p.Sa, p.Sb))}–{minutesToLabel(Math.max(p.Ea, p.Eb))}
                  </td>
                  <td className="p-3">
                    <div className="font-medium">
                      {p.A.mata_kuliah} {p.A.fase ? <span className="text-xs text-gray-500">({p.A.fase})</span> : null}
                    </div>
                    <div className="text-[12px] text-gray-700 flex flex-wrap gap-1">
                      <ProdiBadge p={p.A.prodi} />
                      <span className="px-2 py-0.5 rounded-full border text-[11px]">Kelas {p.A.kelas}</span>
                      {p.A.gedung || p.A.ruangan ? (
                        <span className="px-2 py-0.5 rounded-full border text-[11px]">
                          {p.A.gedung || "-"} {p.A.ruangan ? `• ${p.A.ruangan}` : ""}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[12px] text-gray-500 mt-0.5">
                      {(p.A.dosen || "-")}{p.A.nip ? ` • NIP: ${p.A.nip}` : ""}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="font-medium">
                      {p.B.mata_kuliah} {p.B.fase ? <span className="text-xs text-gray-500">({p.B.fase})</span> : null}
                    </div>
                    <div className="text-[12px] text-gray-700 flex flex-wrap gap-1">
                      <ProdiBadge p={p.B.prodi} />
                      <span className="px-2 py-0.5 rounded-full border text-[11px]">Kelas {p.B.kelas}</span>
                      {p.B.gedung || p.B.ruangan ? (
                        <span className="px-2 py-0.5 rounded-full border text-[11px]">
                          {p.B.gedung || "-"} {p.B.ruangan ? `• ${p.B.ruangan}` : ""}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[12px] text-gray-500 mt-0.5">
                      {(p.B.dosen || "-")}{p.B.nip ? ` • NIP: ${p.B.nip}` : ""}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Pagination page={page} setPage={setPage} totalPages={totalPages} />
    </section>
  );
}

/* ======================== Tabel & Modal ======================== */
function ListTable({ data }) {
  return (
    <>
      {/* TABLE: ≥ sm */}
      <div className="hidden sm:block overflow-auto rounded-2xl border mt-4">
        <table className="min-w-[1220px] text-sm">
          {/* KUNCI LEBAR KOLOM */}
          <colgroup>
            <col style={{ width: 110 }} />  {/* Jam */}
            <col />                          {/* Mata Kuliah (fleksibel) */}
            <col style={{ width: 70 }} />   {/* Kelas */}
            <col style={{ width: 190 }} />  {/* Prodi */}
            <col style={{ width: 90 }} />   {/* Semester */}
            <col style={{ width: 110 }} />  {/* Hari */}
            <col style={{ width: 260 }} />  {/* Dosen */}
            <col style={{ width: 120 }} />  {/* Gedung */}
            <col style={{ width: 95 }} />   {/* Ruangan */}
            <col style={{ width: 70 }} />   {/* SKS */}
          </colgroup>

          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="p-3 text-left">Jam</th>
              <th className="p-3 text-left">Mata Kuliah</th>
              <th className="p-3 text-left">Kelas</th>
              <th className="p-3 text-left">Prodi</th>
              <th className="p-3 text-left">Semester</th>
              <th className="p-3 text-left">Hari</th>
              <th className="p-3 text-left">Dosen</th>
              <th className="p-3 text-left">Gedung</th>
              <th className="p-3 text-left">Ruangan</th>
              <th className="p-3 text-left">SKS</th>
            </tr>
          </thead>

          <tbody>
            {data.map(r => (
              <tr key={r.id} className="border-t bg-white">
                {/* Jam */}
                <td className="p-3 whitespace-nowrap tabular-nums">
                  {minutesToLabel(toMinutes(r.jam_mulai))}–{minutesToLabel(toMinutes(r.jam_selesai))}
                </td>

                {/* Mata kuliah */}
                <td className="p-3">
                  <div className="font-medium truncate">
                    {r.mata_kuliah}{" "}
                    {r.fase ? <span className="text-[11px] text-gray-500">({r.fase})</span> : null}
                  </div>
                </td>

                {/* Kelas */}
                <td className="p-3 whitespace-nowrap">
                  <span className="px-2 py-0.5 rounded border">{r.kelas}</span>
                </td>

                {/* Prodi */}
                <td className="p-3">
                  <div className="truncate max-w-[180px]">
                    <ProdiBadge p={r.prodi} />
                  </div>
                </td>

                {/* Semester */}
                <td className="p-3 whitespace-nowrap">{r.semester}</td>

                {/* Hari / Periode (tetap gunakan "Hari") */}
                <td className="p-3 whitespace-nowrap">
                  {r.tipe === "blok"
                    ? (
                      <>
                        BLOK{" "}
                        <span className="text-xs text-gray-500">
                          ({dateOnly(r.tgl_mulai)}–{dateOnly(r.tgl_selesai)}{r.hari_aktif ? `, ${r.hari_aktif}` : ""})
                        </span>
                      </>
                    )
                    : normHari(r.hari)}
                </td>

                {/* Dosen */}
                <td className="p-3">
                  <div className="truncate max-w-[240px] text-gray-800">
                    {r.dosen || "-"}
                  </div>
                </td>

                {/* Gedung */}
                <td className="p-3 whitespace-nowrap">{r.gedung || "-"}</td>

                {/* Ruangan */}
                <td className="p-3 whitespace-nowrap text-gray-800">{r.ruangan}</td>

                {/* SKS */}
                <td className="p-3 whitespace-nowrap">{r.sks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CARDS: < sm */}
      <div className="sm:hidden space-y-3 mt-4">
        {data.map(r => (
          <div key={r.id} className="rounded-xl border bg-white p-3">
            <div className="font-semibold">
              {r.mata_kuliah} {r.fase ? <span className="text-xs text-gray-500">({r.fase})</span> : null}
            </div>
            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[13px]">
              <div className="text-gray-500">Jam</div>
              <div className="tabular-nums">
                {minutesToLabel(toMinutes(r.jam_mulai))}–{minutesToLabel(toMinutes(r.jam_selesai))}
              </div>

              <div className="text-gray-500">Kelas</div><div>{r.kelas}</div>
              <div className="text-gray-500">Prodi</div><div><ProdiBadge p={r.prodi} /></div>
              <div className="text-gray-500">Semester</div><div>{r.semester}</div>

              <div className="text-gray-500">Hari</div>
              <div>
                {r.tipe === "blok"
                  ? <>{dateOnly(r.tgl_mulai)}–{dateOnly(r.tgl_selesai)}{r.hari_aktif ? ` (${r.hari_aktif})` : ""}</>
                  : normHari(r.hari)}
              </div>

              <div className="text-gray-500">Gedung</div><div>{r.gedung || "-"}</div>
              <div className="text-gray-500">Ruangan</div><div>{r.ruangan}</div>
              <div className="text-gray-500">Dosen</div><div>{r.dosen || "-"}</div>
              <div className="text-gray-500">SKS</div><div>{r.sks}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}



function DetailModal({ item, onClose }) {
  useEffect(() => {
    const onEsc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl p-4 sm:p-6 max-w-sm sm:max-w-md w-[86%] sm:w-full shadow-2xl overflow-y-auto max-h-[80vh]">
        <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 text-center text-emerald-700">
          Detail Mata Kuliah
        </h3>

        <ul className="space-y-1 text-[13px] sm:text-sm text-gray-700">
          <li><b>Mata Kuliah:</b> {item.mata_kuliah} {item.fase ? `(${item.fase})` : ""}</li>
          <li><b>Kelas:</b> {item.kelas}</li>
          <li><b>Prodi:</b> {item.prodi}</li>
          <li><b>Semester:</b> {item.semester}</li>
          <li><b>Dosen:</b> {item.dosen}</li>
          <li><b>Mode:</b> {item.tipe === "blok" ? "Blok" : "Mingguan"}</li>

          {item.tipe === "blok" ? (
            <li>
              <b>Periode:</b> {dateOnly(item.tgl_mulai)} – {dateOnly(item.tgl_selesai)}{" "}
              {item.hari_aktif ? `(${item.hari_aktif})` : ""}
            </li>
          ) : (
            <li><b>Hari:</b> {normHari(item.hari)}</li>
          )}

          <li>
            <b>Jam:</b> {minutesToLabel(toMinutes(item.jam_mulai))} –{" "}
            {minutesToLabel(toMinutes(item.jam_selesai))}
          </li>
          <li><b>Gedung:</b> {item.gedung || "-"}</li>
          <li><b>Ruangan:</b> {item.ruangan || "-"}</li>
          <li><b>SKS:</b> {item.sks || "-"}</li>
        </ul>

        <div className="mt-4 sm:mt-5 text-center">
          <button
            onClick={onClose}
            className="px-4 sm:px-5 py-1.5 sm:py-2 rounded-xl bg-emerald-700 text-white text-sm sm:text-base font-medium hover:bg-emerald-800 transition active:scale-[.97]"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminScheduleTable({ data, onEdit, onDelete }) {
  const [page, setPage] = useState(1);
  const [onlyConflicts, setOnlyConflicts] = useState(false);

  // Search (debounced)
  const [qRaw, setQRaw] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setQ(qRaw.trim().toLowerCase()), 250);
    return () => clearTimeout(id);
  }, [qRaw]);

  const orderHari = useMemo(() => new Map(HARI.map((h, i) => [h, i])), []);
  const conflictsMap = useMemo(() => detectConflicts(data), [data]);

  // helper
  const norm = (v) => String(v ?? "").toLowerCase();

  // ===== base sort + filter "hanya bentrok" =====
  const base = useMemo(() => {
    const arr = [...data].sort((a, b) => {
      const ta = String(a.tipe || "mingguan");
      const tb = String(b.tipe || "mingguan");

      // urutkan blok berdasarkan tanggal mulai
      if (ta === "blok" || tb === "blok") {
        const aStart = a.tgl_mulai || "9999-99-99";
        const bStart = b.tgl_mulai || "9999-99-99";
        if (aStart !== bStart) return aStart.localeCompare(bStart);
      }

      // lalu urutkan hari → jam mulai
      const ha = orderHari.get(normHari(a.hari)) ?? 99;
      const hb = orderHari.get(normHari(b.hari)) ?? 99;
      if (ha !== hb) return ha - hb;

      return (toMinutes(a.jam_mulai) ?? 1e9) - (toMinutes(b.jam_mulai) ?? 1e9);
    });

    return onlyConflicts
      ? arr.filter((r) => (conflictsMap[r.id] || []).length > 0)
      : arr;
  }, [data, onlyConflicts, conflictsMap, orderHari]);

  // ===== filter by query =====
  const filtered = useMemo(() => {
    if (!q) return base;
    return base.filter((r) => {
      const hay = [
        r.mata_kuliah,
        r.fase,
        r.kelas,
        r.prodi,
        r.semester,
        r.hari,
        r.gedung,
        r.ruangan,
        r.dosen,
        r.nip,
      ]
        .map((x) => x ?? "")
        .join(" ");
      return norm(hay).includes(q);
    });
  }, [base, q]);

  // ===== counts (informasi toolbar) =====
  const totalConflictedItems = useMemo(
    () => data.reduce((acc, r) => acc + ((conflictsMap[r.id] || []).length > 0 ? 1 : 0), 0),
    [data, conflictsMap]
  );
  const filteredConflictedItems = useMemo(
    () => filtered.reduce((acc, r) => acc + ((conflictsMap[r.id] || []).length > 0 ? 1 : 0), 0),
    [filtered, conflictsMap]
  );

  // ===== pagination =====
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  // ===== mobile card row (for small screens) =====
  const RowCard = ({ r, c }) => {
    const isConflict = c.length > 0;
    const tips = c.map((x) => `• ${x.reason} (${x.day})`).join("\n");
    return (
      <div
        className={`rounded-xl border p-3 ${isConflict ? "bg-red-50" : "bg-white"}`}
        title={isConflict ? `Bentrok dengan:\n${tips}` : ""}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm font-semibold">
            {r.tipe === "blok" ? (
              <>BLOK <span className="text-xs text-gray-500">({dateOnly(r.tgl_mulai)}–{dateOnly(r.tgl_selesai)}{r.hari_aktif ? `, ${r.hari_aktif}` : ""})</span></>
            ) : (
              normHari(r.hari)
            )}
          </div>
          <div className="text-xs text-gray-600 whitespace-nowrap">
            {minutesToLabel(toMinutes(r.jam_mulai))}–{minutesToLabel(toMinutes(r.jam_selesai))}
          </div>
        </div>

        <div className="mt-1 text-[13px] font-medium break-words">
          {r.mata_kuliah} {r.fase ? <span className="text-xs text-gray-500">({r.fase})</span> : null}
        </div>

        <div className="mt-1 flex flex-wrap gap-1.5 text-[12px] text-gray-700">
          <ProdiBadge p={r.prodi} />
          <span className="px-2 py-0.5 rounded-full border">Kelas {r.kelas}</span>
          {r.semester ? <span className="px-2 py-0.5 rounded-full border">Smt {r.semester}</span> : null}
          {(r.gedung || r.ruangan) && (
            <span className="px-2 py-0.5 rounded-full border">
              {r.gedung || "-"} {r.ruangan ? `• ${r.ruangan}` : ""}
            </span>
          )}
        </div>

        <div className="mt-1 text-[12px] text-gray-600">
          {(r.dosen || "-")}{r.nip ? ` • NIP: ${r.nip}` : ""}
        </div>

        <div className="mt-2 flex items-center justify-between">
          {isConflict ? (
            <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">
              {c.length} konflik
            </span>
          ) : (
            <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700">
              aman
            </span>
          )}

          <div className="flex items-center gap-2">
            <button onClick={() => onEdit(r)} className="px-2 py-1 rounded-md border hover:bg-gray-50 text-sm">Edit</button>
            <button onClick={() => onDelete(r.id)} className="px-2 py-1 rounded-md border text-red-600 hover:bg-red-50 text-sm">Hapus</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Toolbar */}
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyConflicts}
            onChange={(e) => {
              setPage(1);
              setOnlyConflicts(e.target.checked);
            }}
          />
          <span>Hanya tampilkan yang <b>bentrok</b></span>
        </label>

        <div className="text-xs text-gray-500">
          Bentrok (semua data): <b>{totalConflictedItems}</b> item
          <span className="mx-1">•</span>
          Bentrok (setelah filter): <b>{filteredConflictedItems}</b> item
        </div>

        <div className="sm:ml-auto flex items-center gap-2">
          <div className="relative">
            <input
              value={qRaw}
              onChange={(e) => {
                setPage(1);
                setQRaw(e.target.value);
              }}
              placeholder="Cari prodi/kelas/mk/ruang/dosen/NIP…"
              className="w-72 border rounded-lg pl-3 pr-9 py-2 text-sm"
            />
            {qRaw && (
              <button
                onClick={() => { setQRaw(""); setQ(""); setPage(1); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                aria-label="Bersihkan pencarian"
                title="Bersihkan"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MOBILE (cards) */}
      <div className="sm:hidden space-y-2">
        {pageRows.length === 0 ? (
          <div className="p-4 text-center text-gray-500 border rounded-xl">Tidak ada data.</div>
        ) : (
          pageRows.map((r) => (
            <RowCard key={r.id} r={r} c={conflictsMap[r.id] || []} />
          ))
        )}
      </div>

      {/* DESKTOP (table) */}
      <div className="hidden sm:block overflow-auto rounded-2xl border">
        <table className="min-w-[1100px] text-sm">
          <colgroup>
            <col style={{ width: "10%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "12%" }} />
          </colgroup>
          <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10">
            <tr>
              <th className="p-3 text-left">Hari/Periode</th>
              <th className="p-3 text-left">Jam</th>
              <th className="p-3 text-left">Prodi</th>
              <th className="p-3 text-left">Mata Kuliah</th>
              <th className="p-3 text-left">Kelas</th>
              <th className="p-3 text-left">Semester</th>
              <th className="p-3 text-left">Gedung</th>
              <th className="p-3 text-left">Ruangan</th>
              <th className="p-3 text-left">Dosen</th>
              <th className="p-3 text-left">NIP</th>
              <th className="p-3 text-left">Bentrok</th>
              <th className="p-3 text-left">Aksi</th>
            </tr>
          </thead>
          <tbody className="[&>tr:hover]:bg-gray-50">
            {pageRows.map((r) => {
              const c = conflictsMap[r.id] || [];
              const isConflict = c.length > 0;
              const tips = c.map((x) => `• ${x.reason} (${x.day})`).join("\n");

              return (
                <tr
                  key={r.id}
                  className={`border-t ${isConflict ? "bg-red-50" : "bg-white"}`}
                  title={isConflict ? `Bentrok dengan:\n${tips}` : ""}
                >
                  <td className="p-3 whitespace-nowrap">
                    {r.tipe === "blok" ? (
                      <>
                        BLOK{" "}
                        <span className="text-xs text-gray-500">
                          ({dateOnly(r.tgl_mulai)}–{dateOnly(r.tgl_selesai)}
                          {r.hari_aktif ? `, ${r.hari_aktif}` : ""})
                        </span>
                      </>
                    ) : (
                      normHari(r.hari)
                    )}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {minutesToLabel(toMinutes(r.jam_mulai))}–{minutesToLabel(toMinutes(r.jam_selesai))}
                  </td>
                  <td className="p-3"><ProdiBadge p={r.prodi} /></td>
                  <td className="p-3 break-words">
                    {r.mata_kuliah}{" "}
                    {r.fase ? <span className="text-[11px] text-gray-500">({r.fase})</span> : null}
                  </td>
                  <td className="p-3 whitespace-nowrap">{r.kelas}</td>
                  <td className="p-3 whitespace-nowrap">{r.semester}</td>
                  <td className="p-3 whitespace-nowrap">{r.gedung || "-"}</td>
                  <td className="p-3 text-gray-700 whitespace-nowrap">{r.ruangan}</td>
                  <td className="p-3 text-gray-700 break-words">{r.dosen}</td>
                  <td className="p-3 whitespace-nowrap">{r.nip || "-"}</td>
                  <td className="p-3">
                    {isConflict ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">
                        {c.length} konflik
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700">
                        aman
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onEdit(r)}
                        className="px-2 py-1 rounded-md border hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDelete(r.id)}
                        className="px-2 py-1 rounded-md border text-red-600 hover:bg-red-50"
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {pageRows.length === 0 && (
              <tr>
                <td className="p-4 text-center text-gray-500" colSpan={12}>
                  Tidak ada data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-3 flex items-center justify-center">
        <Pagination page={page} setPage={setPage} totalPages={totalPages} />
      </div>
    </>
  );
}

function ScheduleForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(()=>({
    id: initial?.id ?? "",
    prodi: initial?.prodi ?? "",
    mata_kuliah: initial?.mata_kuliah ?? "",
    kelas: initial?.kelas ?? "",
    semester: initial?.semester ?? "",
    hari: initial?.hari ?? "",
    jam_mulai: initial?.jam_mulai ?? "",
    jam_selesai: initial?.jam_selesai ?? "",
    gedung: initial?.gedung ?? "",
    ruangan: initial?.ruangan ?? "",
    dosen: initial?.dosen ?? "",
    nip: initial?.nip ?? "",
    sks: initial?.sks ?? "",
    tipe: initial?.tipe || "mingguan",
    tgl_mulai: initial?.tgl_mulai || "",
    tgl_selesai: initial?.tgl_selesai || "",
    hari_aktif: initial?.hari_aktif || "",
    fase: initial?.fase || "",
  }));
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));

  function submit(e){
    e.preventDefault();
    if(!form.prodi || !form.mata_kuliah || !form.kelas || !form.jam_mulai || !form.jam_selesai){
      alert("Lengkapi Prodi, Mata Kuliah, Kelas, Jam Mulai & Jam Selesai."); return;
    }
    if(!isFinite(toMinutes(form.jam_mulai)) || !isFinite(toMinutes(form.jam_selesai))){
      alert("Format jam tidak valid. Gunakan HH:MM (misal 08:00)."); return;
    }
    if(toMinutes(form.jam_selesai) <= toMinutes(form.jam_mulai)){
      alert("Jam selesai harus lebih besar dari jam mulai."); return;
    }
    if(form.tipe==='mingguan'){
      if(!form.hari){ alert("Pilih hari untuk jadwal mingguan."); return; }
    } else {
      if(!form.tgl_mulai || !form.tgl_selesai){ alert("Isi tanggal mulai & selesai untuk jadwal blok."); return; }
    }
    onSave({
      ...form,
      prodi: normProdi(form.prodi),
      hari: normHari(form.hari),
      semester: form.semester ? Number(form.semester) : "",
      sks: form.sks ? Number(form.sks) : "",
    });
  }

  const toggleHariAktif = (h) => {
    const setA = new Set((form.hari_aktif||"").split(",").filter(Boolean));
    if (setA.has(h)) setA.delete(h); else setA.add(h);
    set("hari_aktif", Array.from(setA).sort((a,b)=>HARI_ORDER.indexOf(a)-HARI_ORDER.indexOf(b)).join(","));
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <form onSubmit={submit} className="bg-white w-full max-w-3xl rounded-2xl p-6 shadow-xl border">
        <h3 className="text-lg font-semibold mb-4">{initial ? "Edit Jadwal" : "Tambah Jadwal"}</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-sm">Prodi</label>
            <select value={form.prodi} onChange={(e)=>set("prodi", e.target.value)} className="mt-1 w-full border rounded-md px-2 py-2">
              <option value="">Pilih Prodi</option>
              {PRODI.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm">Mata Kuliah</label>
            <input value={form.mata_kuliah} onChange={(e)=>set("mata_kuliah", e.target.value)} className="mt-1 w-full border rounded-md px-2 py-2" />
          </div>
          <div>
            <label className="text-sm">Kelas</label>
            <input value={form.kelas} onChange={(e)=>set("kelas", e.target.value)} className="mt-1 w-full border rounded-md px-2 py-2" />
          </div>
          <div>
            <label className="text-sm">Semester</label>
            <select value={form.semester} onChange={(e)=>set("semester", e.target.value)} className="mt-1 w-full border rounded-md px-2 py-2">
              <option value="">-</option>
              {[1,3,5,7].map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm">Mode Jadwal</label>
            <select value={form.tipe} onChange={(e)=>set("tipe", e.target.value)} className="mt-1 w-full border rounded-md px-2 py-2">
              <option value="mingguan">Mingguan</option>
              <option value="blok">Blok (rentang tanggal)</option>
            </select>
          </div>
            {form.tipe === "mingguan" && (
            <div>
                <label className="text-sm">Hari</label>
                <select
                value={form.hari}
                onChange={(e)=>set("hari", e.target.value)}
                className="mt-1 w-full border rounded-md px-2 py-2"
                >
                <option value="">Pilih Hari</option>
                {HARI.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
            </div>
            )}
            {form.tipe === "blok" && (
            <>
                <div>
                <label className="text-sm">Tanggal Mulai</label>
                <input type="date" value={form.tgl_mulai} onChange={e=>set("tgl_mulai", e.target.value)} className="mt-1 w-full border rounded-md px-2 py-2" />
                </div>
                <div>
                <label className="text-sm">Tanggal Selesai</label>
                <input type="date" value={form.tgl_selesai} onChange={e=>set("tgl_selesai", e.target.value)} className="mt-1 w-full border rounded-md px-2 py-2" />
                </div>
                <div className="md:col-span-3">
                <label className="text-sm">Hari Aktif (opsional)</label>
                <div className="mt-1 flex flex-wrap gap-2">
                    {HARI.map(h=>(
                    <label key={h} className="inline-flex items-center gap-2 text-sm border rounded-md px-2 py-1">
                        <input
                        type="checkbox"
                        checked={(form.hari_aktif||"").split(",").includes(h)}
                        onChange={()=>{
                            const s = new Set((form.hari_aktif||"").split(",").filter(Boolean));
                            s.has(h) ? s.delete(h) : s.add(h);
                            set("hari_aktif", Array.from(s).join(","));
                        }}
                        />
                        {h}
                    </label>
                    ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">Kosongkan bila aktif di semua hari dalam rentang.</p>
                </div>
            </>
            )}
          <div>
            <label className="text-sm">Jam Mulai</label>
            <input placeholder="08:00" value={form.jam_mulai} onChange={(e)=>set("jam_mulai", e.target.value)} className="mt-1 w-full border rounded-md px-2 py-2" />
          </div>
          <div>
            <label className="text-sm">Jam Selesai</label>
            <input placeholder="09:40" value={form.jam_selesai} onChange={(e)=>set("jam_selesai", e.target.value)} className="mt-1 w-full border rounded-md px-2 py-2" />
          </div>
          <div>
            <label className="text-sm">Gedung</label>
            <input value={form.gedung} onChange={(e)=>set("gedung", e.target.value)} className="mt-1 w-full border rounded-md px-2 py-2" />
          </div>
          <div>
            <label className="text-sm">Ruangan</label>
            <input value={form.ruangan} onChange={(e)=>set("ruangan", e.target.value)} className="mt-1 w-full border rounded-md px-2 py-2" />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm">Dosen</label>
            <input value={form.dosen} onChange={(e)=>set("dosen", e.target.value)} className="mt-1 w-full border rounded-md px-2 py-2" />
          </div>
          <div>
            <label className="text-sm">NIP (opsional)</label>
            <input value={form.nip} onChange={(e)=>set("nip", e.target.value)} className="mt-1 w-full border rounded-md px-2 py-2" />
          </div>
          <div>
            <label className="text-sm">SKS</label>
            <input type="number" min="0" value={form.sks} onChange={(e)=>set("sks", e.target.value)} className="mt-1 w-full border rounded-md px-2 py-2" />
          </div>
          <div className="md:col-span-3">
            <label className="text-sm">Fase (opsional, mis. Teori/Klinik)</label>
            <input value={form.fase} onChange={(e)=>set("fase", e.target.value)} className="mt-1 w-full border rounded-md px-2 py-2" />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-3 py-2 rounded-md border">Batal</button>
          <button className="px-4 py-2 rounded-md bg-emerald-700 text-white">Simpan</button>
        </div>
      </form>
    </div>
  );
}

function TodayCard({ data }) {
  const today = getTodayName();
  const now = new Date();

  // === Filter Prodi ===
  const [prodiFilter, setProdiFilter] = React.useState("");
  const prodiOptions = React.useMemo(
    () => ["", ...Array.from(new Set(data.map(d => normProdi(d.prodi))).values())],
    [data]
  );

  // === Data hari ini ===
  const itemsAll = React.useMemo(
    () =>
      data
        .filter(d => isActiveOnDay(d, today, now))
        .sort(
          (a, b) =>
            (toMinutes(a.jam_mulai) ?? 1e9) - (toMinutes(b.jam_mulai) ?? 1e9)
        ),
    [data, today]
  );

  const items = React.useMemo(
    () =>
      prodiFilter
        ? itemsAll.filter(d => normProdi(d.prodi) === prodiFilter)
        : itemsAll,
    [itemsAll, prodiFilter]
  );

  // === Pagination (15/baris) ===
  const [page, setPage] = React.useState(1);
  React.useEffect(() => {
    setPage(1);
  }, [today, data, prodiFilter]);

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pageRows = React.useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, page]);

  // === UI ===
  return (
    <section className="bg-white rounded-2xl p-4 border">
      {/* Header + Filter (responsive) */}
      <div className="mb-3 flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-3">
        <div className="text-center sm:text-left w-full">
          <div className="font-semibold text-[15px] sm:text-base">
            Jadwal Hari Ini ({today})
          </div>
          <div className="text-xs sm:text-sm text-gray-600">
            {prodiFilter ? prodiFilter : "Semua Prodi"}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:ml-auto">
          <label className="text-sm text-gray-600 whitespace-nowrap">Prodi</label>
          <select
            value={prodiFilter}
            onChange={(e) => setProdiFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm w-[52vw] max-w-[220px] sm:w-[200px]"
          >
            {prodiOptions.map((p, i) => (
              <option key={i} value={p}>
                {p ? p : "Semua"}
              </option>
            ))}
          </select>
          {prodiFilter && (
            <button
              onClick={() => setProdiFilter("")}
              className="hidden sm:inline-block px-3 py-2 rounded-lg border text-sm hover:bg-gray-50"
              title="Reset filter"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* TABLE (≥ sm) */}
      <div className="hidden sm:block overflow-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="p-3 text-left">Jam</th>
              <th className="p-3 text-left">Mata Kuliah</th>
              <th className="p-3 text-left">Kelas</th>
              <th className="p-3 text-left">Prodi</th>
              <th className="p-3 text-left">Semester</th>
              <th className="p-3 text-left">Dosen</th>
              <th className="p-3 text-left">Gedung</th>
              <th className="p-3 text-left">Ruangan</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-4 text-center text-gray-500">
                  Tidak ada jadwal untuk hari ini.
                </td>
              </tr>
            ) : (
              pageRows.map((r) => (
                <tr key={r.id} className="border-t bg-white hover:bg-gray-50">
                  <td className="p-3 whitespace-nowrap">
                    {minutesToLabel(toMinutes(r.jam_mulai))}–{minutesToLabel(toMinutes(r.jam_selesai))}
                  </td>
                  <td className="p-3">
                    {r.mata_kuliah}{" "}
                    {r.fase ? (
                      <span className="text-[11px] text-gray-500">({r.fase})</span>
                    ) : null}
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded border">{r.kelas}</span>
                  </td>
                  <td className="p-3">
                    <ProdiBadge p={r.prodi} />
                  </td>
                  <td className="p-3">{r.semester}</td>
                  <td className="p-3 text-gray-700">{r.dosen}</td>
                  <td className="p-3">{r.gedung || "-"}</td>
                  <td className="p-3 text-gray-700">{r.ruangan}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* CARDS (< sm) */}
      <div className="sm:hidden space-y-3">
        {pageRows.length === 0 ? (
          <div className="p-4 text-center text-gray-500 border rounded-xl">
            Tidak ada jadwal untuk hari ini.
          </div>
        ) : (
          pageRows.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border bg-white p-3 active:scale-[.997] transition"
            >
              {/* JAM + KELAS */}
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-[15px]">
                  {minutesToLabel(toMinutes(r.jam_mulai))}–{minutesToLabel(toMinutes(r.jam_selesai))}
                </div>
                <span className="px-2 py-0.5 rounded-full border text-[11px]">
                  Kelas {r.kelas}
                </span>
              </div>

              {/* MATA KULIAH */}
              <div className="mt-0.5 font-semibold text-[15px]">
                {r.mata_kuliah}{" "}
                {r.fase ? (
                  <span className="text-xs text-gray-500">({r.fase})</span>
                ) : null}
              </div>

              {/* GRID DETAIL */}
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[13px]">
                <div className="text-gray-500">Prodi</div>
                <div>
                  <ProdiBadge p={r.prodi} />
                </div>

                <div className="text-gray-500">Semester</div>
                <div>{r.semester || "-"}</div>

                <div className="text-gray-500">Dosen</div>
                <div className="truncate">{r.dosen || "-"}</div>

                <div className="text-gray-500">Lokasi</div>
                <div>
                  {r.gedung || "-"} {r.ruangan ? `• ${r.ruangan}` : ""}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      <Pagination page={page} setPage={setPage} totalPages={totalPages} />
    </section>
  );
}

// ==== helper: cari selang waktu kosong antara START_TIME–END_TIME (robust)
// dayEvents: array of {S,E} (menit); boleh tidak terurut & bisa overlap
function getFreeIntervals(dayEvents, startMin, endMin) {
  // Normalisasi rentang kerja
  const WORK_START = Math.min(startMin, endMin);
  const WORK_END   = Math.max(startMin, endMin);

  // 1) Sort + clamp event ke dalam jam kerja, buang yang nol/negatif
  const norm = dayEvents
    .map(({ S, E }) => {
      const s = Math.max(WORK_START, Math.min(S, E));
      const e = Math.min(WORK_END,   Math.max(S, E));
      return { S: s, E: e };
    })
    .filter(ev => isFinite(ev.S) && isFinite(ev.E) && ev.E > ev.S)
    .sort((a,b) => a.S - b.S);

  // 2) Merge event yang tumpang-tindih/berdekatan
  const merged = [];
  for (const ev of norm) {
    if (!merged.length) { merged.push({ ...ev }); continue; }
    const last = merged[merged.length - 1];
    if (ev.S <= last.E) {
      // overlap/menyentuh: gabung
      last.E = Math.max(last.E, ev.E);
    } else {
      merged.push({ ...ev });
    }
  }

  // 3) Hitung slot kosong di antara blok terpakai
  const free = [];
  let cur = WORK_START;
  for (const ev of merged) {
    if (ev.S > cur) free.push([cur, ev.S]);
    cur = Math.max(cur, ev.E);
    if (cur >= WORK_END) break;
  }
  if (cur < WORK_END) free.push([cur, WORK_END]);

  return free;
}

// ==== Ketersediaan Ruangan (awal kosong, auto-load setelah user mengubah parameter)
function RoomAvailabilityFinder({ data }) {
  // === Options ===
  const gedungOptions = useMemo(() => {
    const s = new Set();
    data.forEach((d) => d.gedung && s.add(String(d.gedung).trim()));
    return Array.from(s).sort();
  }, [data]);

  const [gedung, setGedung]   = useState("");
  const [ruangan, setRuangan] = useState("");
  const [dateStr, setDateStr] = useState(() => new Date().toISOString().slice(0, 10));
  const [scanDays, setScanDays] = useState(0);
  const [results, setResults] = useState([]);

  // Inisialisasi gedung saat opsi tersedia
  useEffect(() => {
    if (!gedung && gedungOptions.length) setGedung(gedungOptions[0]);
  }, [gedungOptions, gedung]);

  // Opsi ruangan tergantung gedung
  const roomOptions = useMemo(() => {
    const s = new Set();
    data.forEach((d) => {
      if (!gedung || String(d.gedung).trim() === gedung) {
        d.ruangan && s.add(String(d.ruangan).trim());
      }
    });
    return Array.from(s).sort();
  }, [data, gedung]);

  // Reset ruangan saat ganti gedung
  useEffect(() => { setRuangan(""); }, [gedung]);

  // Konstanta jam kerja
  const sMin = toMinutes(START_TIME);
  const eMin = toMinutes(END_TIME);

  // Helper tanggal ISO lokal (YYYY-MM-DD)
  const localISODate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  // Ambil event per hari utk ruangan
  function buildDayEventsFor(room, dObj) {
    const dayName = dObj
      .toLocaleDateString("id-ID", { weekday: "long" })
      .replace(/^./, (c) => c.toUpperCase());

    const items = data.filter((x) => {
      if (gedung && String(x.gedung).trim() !== gedung) return false;
      if (room && String(x.ruangan).trim() !== room) return false;
      return isActiveOnDay(x, dayName, dObj);
    });

    return items
      .map((it) => ({ S: toMinutes(it.jam_mulai), E: toMinutes(it.jam_selesai) }))
      .filter((x) => isFinite(x.S) && isFinite(x.E) && x.E > x.S)
      .sort((a, b) => a.S - b.S);
  }

  // Hitung ketersediaan
  const computeAvailability = useCallback(() => {
    if (!dateStr) return;

    // Jika belum ada opsi ruangan (data kosong), kosongkan hasil
    if (!ruangan && roomOptions.length === 0) {
      setResults([]);
      return;
    }

    const startDate = new Date(`${dateStr}T00:00:00`);
    const days = Math.max(0, Math.min(31, Number(scanDays) || 0));

    const ruangList = ruangan ? [ruangan] : roomOptions;
    const out = [];

    for (const r of ruangList) {
      const perRoom = [];
      for (let d = 0; d <= days; d++) {
        const dayObj = new Date(startDate);
        dayObj.setDate(startDate.getDate() + d);

        const events = buildDayEventsFor(r, dayObj);
        const free = getFreeIntervals(events, sMin, eMin);
        if (free.length) {
          perRoom.push({
            date: localISODate(dayObj),
            day: dayObj
              .toLocaleDateString("id-ID", { weekday: "long" })
              .replace(/^./, (c) => c.toUpperCase()),
            free,
          });
        }
      }
      if (perRoom.length) out.push({ ruang: r, days: perRoom });
    }

    out.sort((a, b) => String(a.ruang).localeCompare(String(b.ruang)));
    setResults(out);
    setPage(1);
  }, [dateStr, scanDays, ruangan, roomOptions, data, gedung, sMin, eMin]);

  // Interaksi pertama (supaya tidak auto-load)
  const interactedRef = useRef(false);
  const markInteracted = () => { interactedRef.current = true; };

  useEffect(() => {
    if (!interactedRef.current) return;
    const t = setTimeout(() => computeAvailability(), 300);
    return () => clearTimeout(t);
  }, [computeAvailability]);

  // === Pagination: 6 card (hari ini), 3 card (7/14 hari) ===
  const [page, setPage] = useState(1);
  const roomsPerPage = scanDays === 0 ? 6 : 3;

  useEffect(() => { setPage(1); }, [scanDays, gedung, ruangan, dateStr, results.length]);

  const totalPages = Math.max(1, Math.ceil(results.length / roomsPerPage));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);

  const pagedResults = useMemo(() => {
    const start = (page - 1) * roomsPerPage;
    return results.slice(start, start + roomsPerPage);
  }, [results, page, roomsPerPage]);

  const disabled = gedungOptions.length === 0;

  return (
    <div className="bg-white rounded-2xl p-4 border">
      {/* Toolbar */}
      <div className="mb-3 flex items-center gap-3 flex-wrap">
        <h3 className="font-semibold">Cek Ketersediaan Ruangan</h3>

        <div className="flex items-center gap-2">
          <label htmlFor="raf-date" className="text-sm text-gray-700">Tanggal</label>
          <input
            id="raf-date"
            type="date"
            value={dateStr}
            onChange={(e) => { setDateStr(e.target.value); markInteracted(); }}
            className="border rounded-lg px-3 py-1.5 text-sm"
            disabled={disabled}
          />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="raf-gedung" className="text-sm text-gray-700">Gedung</label>
          <select
            id="raf-gedung"
            value={gedung}
            onChange={(e) => { setGedung(e.target.value); markInteracted(); }}
            className="border rounded-lg px-3 py-1.5 text-sm"
            disabled={disabled}
          >
            {gedungOptions.length === 0 ? (
              <option value="">(Tidak ada data gedung)</option>
            ) : (
              gedungOptions.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))
            )}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="raf-ruangan" className="text-sm text-gray-700">Ruangan</label>
          <select
            id="raf-ruangan"
            value={ruangan}
            onChange={(e) => { setRuangan(e.target.value); markInteracted(); }}
            className="border rounded-lg px-3 py-1.5 text-sm"
            disabled={disabled}
          >
            <option value="">Semua</option>
            {roomOptions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="raf-range" className="text-sm text-gray-700">Rentang</label>
          <select
            id="raf-range"
            value={scanDays}
            onChange={(e) => { setScanDays(Number(e.target.value) || 0); markInteracted(); }}
            className="border rounded-lg px-3 py-1.5 text-sm"
            disabled={disabled}
          >
            <option value={0}>Hanya hari ini</option>
            <option value={7}>7 hari ke depan</option>
            <option value={14}>14 hari ke depan</option>
          </select>
        </div>

        <button
          onClick={() => { interactedRef.current = true; computeAvailability(); }}
          className="ml-auto px-4 py-2 rounded-md bg-emerald-700 text-white hover:opacity-95 active:scale-[.98]"
          disabled={disabled}
          title={disabled ? "Data belum tersedia" : "Tampilkan ketersediaan"}
        >
          Tampilkan Ketersediaan
        </button>
      </div>

      {/* Hasil + Pagination */}
      {results.length === 0 ? (
        <div className="p-4 text-center text-gray-500 border rounded-xl">
          {disabled
            ? "Data belum tersedia. Pastikan data jadwal memuat nama gedung & ruangan."
            : <>Pilih parameter lalu klik <b>Tampilkan Ketersediaan</b>.</>}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pagedResults.map((r, idx) => (
              <div key={idx} className="rounded-2xl border p-3 bg-white flex flex-col">
                <div className="font-semibold mb-3">
                  {gedung} • Ruang {r.ruang}
                </div>
                <div className="space-y-3">
                  {r.days.map((d, i2) => (
                    <div key={i2} className="bg-gray-50 rounded-xl p-2">
                      <div className="text-sm font-medium mb-1">
                        {d.day}, {d.date}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {d.free.map(([a, b], i3) => (
                          <span
                            key={i3}
                            className="inline-block px-2 py-0.5 rounded-full border text-sm"
                          >
                            {minutesToLabel(a)}–{minutesToLabel(b)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-center gap-1">
            <Pagination page={page} setPage={setPage} totalPages={totalPages} />
          </div>
        </>
      )}
    </div>
  );
}

function UserHomeFilterable({ data }) {
  const [mode, setMode] = useState("prodi");
  const [prodi, setProdi] = useState("");
  const [semester, setSemester] = useState("");
  const [gedung, setGedung] = useState("");

  // Opsi gedung (unik & terurut)
  const gedungOptions = useMemo(() => {
    const s = new Set();
    data.forEach(d => d.gedung && s.add(String(d.gedung).trim()));
    return Array.from(s).sort();
  }, [data]);

  // Filter data sesuai mode
  const filtered = useMemo(() => {
    return data.filter(d => {
      if (mode === "prodi") {
        if (prodi && normProdi(d.prodi) !== normProdi(prodi)) return false;
        if (semester && Number(d.semester) !== Number(semester)) return false;
      } else {
        if (gedung && String(d.gedung).trim() !== gedung) return false;
      }
      return true;
    });
  }, [data, mode, prodi, semester, gedung]);

  // === URUTKAN: Hari -> Jam -> Gedung -> Ruangan -> Prodi (BLOK di belakang)
  const DAY_ORDER = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"];
  const dayIdx = useMemo(() => new Map(DAY_ORDER.map((h,i)=>[h,i])), []);
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const da = a.tipe === "blok" ? 99 : (dayIdx.get(normHari(a.hari)) ?? 99);
      const db = b.tipe === "blok" ? 99 : (dayIdx.get(normHari(b.hari)) ?? 99);
      if (da !== db) return da - db;

      const ta = toMinutes(a.jam_mulai) ?? 1e9;
      const tb = toMinutes(b.jam_mulai) ?? 1e9;
      if (ta !== tb) return ta - tb;

      const g = String(a.gedung || "").localeCompare(String(b.gedung || ""));
      if (g !== 0) return g;

      const r = String(a.ruangan || "").localeCompare(String(b.ruangan || ""));
      if (r !== 0) return r;

      return String(a.prodi || "").localeCompare(String(b.prodi || ""));
    });
    return arr;
  }, [filtered, dayIdx]);

  // Ganti mode → reset filter lawan
  const switchMode = (m) => {
    setMode(m);
    if (m === "prodi") { setGedung(""); }
    else { setProdi(""); setSemester(""); }
  };

  // Pagination (pakai 'sorted')
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [mode, prodi, semester, gedung]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [sorted, page]);

  const resetFilters = () => {
    setProdi("");
    setSemester("");
    setGedung("");
    setPage(1);
  };

  return (
    <section className="bg-white rounded-2xl p-4 border">
      {/* Judul */}
      <div className="text-center mb-2">
        <h3 className="text-lg sm:text-xl font-bold text-gray-900">Jadwal Keseluruhan</h3>
        <p className="text-xs sm:text-sm text-gray-600">
          {mode === "prodi"
            ? `Mode: Prodi • ${prodi || "Semua Prodi"}${semester ? ` • Semester ${semester}` : ""}`
            : `Mode: Gedung • ${gedung || "Semua Gedung"}`}{" "}
          • {sorted.length} item
        </p>
      </div>

      {/* Filter Toolbar (sticky di HP) */}
      <div className="sticky top-0 z-[5] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/70 rounded-xl p-2 border mb-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {mode === "prodi" ? (
            <>
              <label className="text-sm font-medium text-gray-700">Prodi</label>
              <select
                value={prodi}
                onChange={(e) => setProdi(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm shadow-sm focus:ring-1 focus:ring-green-600 w-[54vw] max-w-[260px] sm:w-auto"
              >
                <option value="">Semua</option>
                {PRODI.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>

              <label className="text-sm font-medium text-gray-700">Semester</label>
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm shadow-sm focus:ring-1 focus:ring-green-600 w-[34vw] max-w-[140px] sm:w-auto"
              >
                <option value="">Semua</option>
                {[1,2,3,4,5,6,7,8].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </>
          ) : (
            <>
              <label className="text-sm font-medium text-gray-700">Gedung</label>
              <select
                value={gedung}
                onChange={(e) => setGedung(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm shadow-sm focus:ring-1 focus:ring-green-600 w-[60vw] max-w-[280px] sm:w-auto"
              >
                <option value="">Semua Gedung</option>
                {gedungOptions.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </>
          )}

          <button
            onClick={resetFilters}
            className="ml-auto px-3 py-2 rounded-lg border text-sm hover:bg-gray-50"
            title="Reset filter"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Hasil */}
      <div>
        <ListTable data={pageRows} />
        <Pagination page={page} setPage={setPage} totalPages={totalPages} />
      </div>
    </section>
  );
}


function AdminHome({
  data,
  onSelectItem,
  handleAddClick,
  handleEdit,
  handleDelete,
  handleDeleteAll,
  handleImportFile,
  handleProcessImport,
  importRows,
  isProcessing,
}) {
  const fileRef = React.useRef(null);
  const [dragOver, setDragOver] = React.useState(false);

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleImportFile(f);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const onDragLeave = () => setDragOver(false);

  return (
    <div className="space-y-4">
      {/* 1) Impor */}
      <section className="bg-white rounded-2xl p-4 border">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-semibold">Impor Data Jadwal</h2>
          {importRows.length > 0 && (
            <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs bg-emerald-50 text-emerald-700">
              {importRows.length} baris siap diimpor
            </span>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-start">
          {/* Dropzone + file input */}
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className={[
              "rounded-xl border border-dashed p-4 transition",
              dragOver ? "bg-emerald-50 border-emerald-300" : "bg-gray-50"
            ].join(" ")}
            aria-label="Dropzone impor file"
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="text-sm text-gray-700">
                <div className="font-medium">Tarik & letakkan file di sini</div>
                <div className="text-gray-500">Atau pilih file CSV/XLSX sesuai template</div>
              </div>
              <div className="sm:ml-auto">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleImportFile(e.target.files[0])}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="px-3 py-2 rounded-md border bg-white hover:bg-gray-50"
                  >
                    Pilih File…
                  </button>
                </label>
              </div>
            </div>
          </div>

          {/* Tombol proses */}
          <div className="flex sm:flex-col gap-2 sm:items-stretch">
            <button
              onClick={handleProcessImport}
              disabled={isProcessing || importRows.length === 0}
              className="px-3 py-2 rounded-md bg-emerald-700 text-white hover:opacity-90 disabled:opacity-60"
              title={importRows.length ? `Proses ${importRows.length} baris` : "Tidak ada data untuk diproses"}
            >
              {isProcessing ? "Memproses…" : (importRows.length ? `Proses (${importRows.length})` : "Proses")}
            </button>
          </div>
        </div>

        <p className="mt-2 text-xs text-gray-500">
          Format wajib: kolom Prodi, Mata Kuliah, Kelas, (Hari atau Periode Blok), Jam Mulai, Jam Selesai, Gedung (Gedung B/AB/C), Ruangan, Dosen, NIP (opsional), SKS (opsional).
        </p>
      </section>

      {/* 2) Kelola */}
      <section className="bg-white rounded-2xl p-4 border">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">Kelola Jadwal (Admin)</h3>
          <span className="text-sm text-gray-500">• Total: <b>{data.length}</b> item</span>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleAddClick}
              className="px-3 py-2 rounded-md bg-emerald-700 text-white hover:opacity-90"
            >
              + Tambah Jadwal
            </button>
            <button
              onClick={handleDeleteAll}
              className="px-3 py-2 rounded-md border text-red-700 hover:bg-red-50"
              title="Hapus semua data jadwal"
            >
              Hapus Semua
            </button>
          </div>
        </div>

        <AdminScheduleTable data={data} onEdit={handleEdit} onDelete={handleDelete} />
      </section>

      {/* 3) Bentrok */}
      <section className="bg-white rounded-2xl p-4 border">
        <ConflictDetails data={data} />
      </section>

      {/* 4) Kalender (opsional, tinggal aktifkan komponen yang diinginkan) */}
      {/* <TodayCard data={data} /> */}
      {/* <AllWeeklyCalendar data={data} onSelectItem={onSelectItem} /> */}
    </div>
  );
}

/* ======================== App ======================== */
// --- Hero cover (sampul) ---
import hero from "./assets/FKIK1.jpg";

function HeroCover() {
  return (
    <section
      className="
        relative isolate inset-x-0 w-full overflow-hidden bg-neutral-900
        /* tinggi responsif by orientasi */
        min-h-[54vh]
        sm:min-h-[64vh]
        md:min-h-[72vh]
        portrait:min-h-[68vh]
        landscape:min-h-[58vh]
        /* header offset & safe areas */
        pt-[calc(56px+env(safe-area-inset-top))]
        sm:pt-0
        pb-[env(safe-area-inset-bottom)]
      hero-compact"
      aria-label="Sampul utama"
    >
      {/* Background image */}
      <img
        src={hero}
        alt="Gedung FKIK UIN Alauddin"
        className="
          absolute inset-0 w-full h-full object-cover
          /* fokus gambar menyesuaikan orientasi */
          object-[50%_30%]
          sm:object-[50%_28%]
          portrait:object-[50%_26%]
          landscape:object-[50%_35%]
          block select-none
        "
        loading="eager"
        decoding="async"
        sizes="100vw"
        fetchpriority="high"
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
        aria-hidden="true"
      />

      {/* Overlays untuk kontras */}
      <div className="absolute inset-0 bg-black/45 sm:bg-black/40" aria-hidden="true" />
      <div
        className="absolute inset-0 bg-[radial-gradient(120%_90%_at_75%_0%,rgba(16,185,129,.28),transparent_35%),radial-gradient(120%_110%_at_10%_15%,rgba(37,99,235,.22),transparent_40%)]"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_70%,transparent_0%,rgba(0,0,0,.22)_58%,rgba(0,0,0,.34)_100%)]"
        aria-hidden="true"
      />

      {/* Konten */}
      <div className="absolute inset-0 z-10 flex items-center justify-center">
        <div className="px-4 sm:px-8 text-center text-white max-w-6xl mx-auto">
          <h1
            className="
              m-0 font-bold font-serif italic
              antialiased [text-rendering:optimizeLegibility]
              leading-tight landscape:leading-snug
              /* kurangi size & shadow saat landscape */
              text-[clamp(28px,7.2vw,52px)]
              landscape:text-[clamp(26px,5.2vw,44px)]
              drop-shadow-[0_2px_3px_rgba(0,0,0,.6)]
              landscape:drop-shadow-[0_1px_2px_rgba(0,0,0,.45)]
              tracking-tight landscape:tracking-normal
            hero-title"
          >
            E-SCHEDULE
          </h1>

          <h2
            className="
              mt-1 font-semibold uppercase
              antialiased [text-rendering:optimizeLegibility]
              /* tracking lebih rapat saat landscape supaya tak melebar */
              tracking-[.04em] sm:tracking-[.06em] landscape:tracking-[.02em]
              text-[clamp(13px,3.4vw,22px)] hero-subtitle
              landscape:text-[clamp(12px,2.8vw,20px)]
              drop-shadow-[0_1px_2px_rgba(0,0,0,.35)]
            "
          >
            SISTEM MONITORING JADWAL & PENGGUNAAN RUANGAN
          </h2>

          <p className="mt-2 font-semibold opacity-95 text-[clamp(12px,3.4vw,18px)] hero-line">
            FAKULTAS KEDOKTERAN DAN ILMU KESEHATAN
          </p>
          <p className="mt-1 font-semibold opacity-95 text-[clamp(12px,3.4vw,18px)] hero-line">
            UIN ALAUDDIN MAKASSAR
          </p>

          <p className="mt-3 opacity-90 text-[clamp(11px,3vw,15px)] hero-line hero-tagline">
            PANTAU JADWAL HARI INI • PILIH PRODI UNTUK DETAIL
          </p>

          {/* Badge tanggal—lebih kompak di landscape */}
          <div
            className="
              mt-3 inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur
              px-3 py-1.5 font-medium
              text-[clamp(11px,3.2vw,15px)]
              landscape:text-[clamp(10px,2.6vw,14px)]
            hero-badge"
          >
            {formatTodayID()}
          </div>
        </div>
      </div>

      {/* Gelombang bawah (dekor) */}
      <div className="absolute bottom-0 left-0 right-0 text-gray-100 pointer-events-none hero-wave">
        <svg
          viewBox="0 0 1440 110"
          className="w-full h-[56px] sm:h-[72px] md:h-[96px] fill-current"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0,64L48,58.7C96,53,192,43,288,58.7C384,75,480,117,576,117.3C672,117,768,75,864,69.3C960,64,1056,96,1152,101.3C1248,107,1344,85,1392,74.7L1440,64L1440,110L0,110Z" />
        </svg>
      </div>
    </section>
  );
}

export default function App({ isAdmin = false }) {
  // Auth & routing
  const [authed, setAuthed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("fkik_auth") === "1"
  );
  useEffect(()=>{ 
    const onStorage=(e)=>{ if(e.key==='fkik_auth'){ setAuthed(localStorage.getItem('fkik_auth')==='1'); }}; 
    window.addEventListener('storage', onStorage);
    return ()=> window.removeEventListener('storage', onStorage);
  },[]);
  const path = typeof window!=='undefined' ? window.location.pathname : '/';
  const route = path==='/login' ? 'login' : (path.startsWith('/admin') ? 'admin' : (path.startsWith('/prodi/') ? 'prodi' : 'user'));
  const finalIsAdmin = authed;
  const handleLogout = ()=>{ localStorage.removeItem('fkik_auth'); setAuthed(false); if(route==='admin'){ window.location.href='/'; } };

  // Data
  const [data, setData] = useState([]);
  const [selected, setSelected] = useState(null);

  // Import staging
  const [importRows, setImportRows] = useState([]);
  const [importInfo, setImportInfo] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Admin modal
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const expectJson = (r) => {
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      return r.text().then(t => { throw new Error(`Server mengirim non-JSON (HTTP ${r.status}). Cuplikan: ${t.slice(0,200)}`); });
    }
    return r.json();
  };

  // Load awal
  useEffect(()=>{ fetch(API).then(r=>r.json()).then(setData).catch(()=>setData([])); },[]);

  /* CRUD */
  function handleAddClick(){ setEditing(null); setShowForm(true); }
  function handleEdit(item){ setEditing(item); setShowForm(true); }
  function handleDelete(id){
    if(!confirm("Hapus jadwal ini?")) return;
    fetch(`${API}/${id}`, { method: "DELETE" })
      .then(()=> setData(prev=>prev.filter(x=>String(x.id)!==String(id))))
      .catch(err=> alert("Gagal hapus: "+err));
  }

  async function handleDeleteAll() {
    if (!confirm("Yakin HAPUS SEMUA jadwal? Tindakan ini tidak bisa dibatalkan.")) return;
    try {
      const r = await fetch(`${API}/all`, { method: "DELETE" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);

      alert(`Berhasil menghapus ${j.deleted} baris (${j.method}).`);
      // reload dari server agar sinkron 100%
      const fresh = await fetch(API).then(x => x.json());
      setData(fresh);
    } catch (err) {
      alert("Gagal hapus semua: " + err.message);
    }
  }

  function handleSave(item){
    if(editing){
      fetch(`/api/jadwal/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item)
      })
      .then(r => r.ok ? expectJson(r) : r.text().then(t => { throw new Error(`HTTP ${r.status}: ${t.slice(0,200)}`)}))
      .then(updated => {
        setData(prev => prev.map(x => (String(x.id)===String(updated.id)) ? updated : x));
        setShowForm(false); setEditing(null);
      })
      .catch(err => alert("Gagal simpan: " + err.message));
    } else {
      fetch('/api/jadwal', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item)
      })
      .then(r => r.ok ? expectJson(r) : r.text().then(t => { throw new Error(`HTTP ${r.status}: ${t.slice(0,200)}`)}))
      .then(newItem => {
        setData(prev => [...prev, newItem]);
        setShowForm(false); setEditing(null);
      })
      .catch(err => alert("Gagal tambah: " + err.message));
    }
  }

  /* === Import Excel/CSV → parsing → staging (multi-sheet + BLOK) === */
  function prodiFromSheet(sheetName){
    const slug = slugify(String(sheetName || "").trim());
    const found = PRODI.find(p => slugify(p) === slug);
    return found || normProdi(sheetName);
  }

  function handleImportFile(file){
    const reader = new FileReader();
    const isCSV = file.name.toLowerCase().endsWith('.csv');
    const ENFORCE_SHEET_PRODI = false;

    reader.onload = (e)=>{
      try{
        let items = [];
        let info = [];

        const mapRow = (r, sheetName) => {
          const g=(...keys)=> keys.map(k=>r[k]).find(v=>v!==undefined && v!=="");

          const prodiSheet = sheetName ? prodiFromSheet(sheetName) : null;
          const prodiCol   = normProdi(g('Prodi','program_studi','PRODI'));
          const prodi = ENFORCE_SHEET_PRODI ? (prodiSheet||prodiCol) : (prodiCol || prodiSheet);

          const mk   = normStr(g('Mata Kuliah','mata_kuliah','MK','MataKuliah'));
          const kelas= normStr(g('Kelas','kelas'));
          const semester = Number(g('Semester','semester'))||null;

          const tipe = String(g('Tipe','tipe')||'').toLowerCase() || 'mingguan';
          const hari = normHari(g('Hari','hari'));

          const tgl_mulai = parseDate(g('Tanggal Mulai','tgl_mulai','Start Date'));
          const tgl_selesai = parseDate(g('Tanggal Selesai','tgl_selesai','End Date'));
          const hari_aktif = parseHariAktif(g('Hari Aktif','hari_aktif','Active Days')).join(",");

          const jm = g('Jam Mulai','jam_mulai','Mulai','JamMulai');
          const js = g('Jam Selesai','jam_selesai','Selesai','JamSelesai');

          // --- ganti pembacaan gedung di dalam mapRow ---
          const rawGedung = normStr(g("Gedung","gedung"));
          const allowed = new Set(["Gedung B","Gedung AB","Gedung C"]);
          if (rawGedung && !allowed.has(rawGedung)) {
            throw new Error(`Nama gedung tidak diizinkan: "${rawGedung}". Gunakan salah satu: Gedung B, Gedung AB, Gedung C.`);
          }
          const gedung = rawGedung;

          const ruangan = normStr(g('Ruangan','ruangan'));
          const dosen = normStr(g('Dosen','dosen'));
          // ambil NIP; simpan hanya jika ada angkanya, lalu normalisasi (hapus non-digit)
          const rawNip = g('NIP','nip','NIP Dosen');
          const nip = /\d/.test(String(rawNip))
            ? String(rawNip).replace(/\D/g, "")   // contoh: "1987 0101-2010 1 001" → "1987010120101001"
            : "";
          const sks = Number(g('SKS','sks'))||null;

          return {
            prodi, mata_kuliah: mk, kelas, semester,
            hari, jam_mulai: jm, jam_selesai: js,
            gedung, ruangan, dosen, nip, sks,
            tipe: (tipe === 'blok' ? 'blok' : 'mingguan'),
            tgl_mulai: tgl_mulai || null,
            tgl_selesai: tgl_selesai || null,
            hari_aktif: hari_aktif || null,
          };
        };

        if(isCSV){
          const text = e.target.result;
          const wb = XLSX.read(text, {type:'string'});
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, {defval:""});
          const norm = rows.map(r => mapRow(r, null)).filter(x =>
            x.prodi && x.mata_kuliah && x.kelas && x.jam_mulai && x.jam_selesai &&
            (x.tipe === 'blok' ? true : !!x.hari)
          );
          items = norm;
          info.push({ sheet: wb.SheetNames[0], count: norm.length });
        } else {
          const buf = new Uint8Array(e.target.result);
          const wb = XLSX.read(buf, {type:'array'});
          for (const sheetName of wb.SheetNames) {
            const ws = wb.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(ws, {defval:""});
            const norm = rows.map(r => mapRow(r, sheetName)).filter(x =>
              x.prodi && x.mata_kuliah && x.kelas && x.jam_mulai && x.jam_selesai &&
              (x.tipe === 'blok' ? true : !!x.hari)
            );
            items.push(...norm);
            info.push({ sheet: sheetName, count: norm.length });
          }
        }

        if(!items.length){
          alert('File terbaca, tetapi tidak ada baris valid. Pastikan header sesuai template.');
          setImportRows([]); setImportInfo(null);
          return;
        }

        setImportRows(items);
        setImportInfo({ ok:true, sheets: info, total: items.length });
      }catch(err){
        console.error(err);
        alert('Gagal memproses file. Pastikan format CSV/XLSX sesuai template.');
        setImportRows([]); setImportInfo(null);
      }
    };

    if(isCSV){ reader.readAsText(file); } else { reader.readAsArrayBuffer(file); }
  }

  async function handleProcessImport(){
    if(importRows.length===0) return;
    setIsProcessing(true);
    setImportInfo(null);
    try{
      const r = await fetch(`${API}/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(importRows)
      });
      if(!r.ok){
        const e = await r.json().catch(()=>({error:`HTTP ${r.status}`}));
        throw new Error(e.error || "Bulk insert gagal");
      }
      const ok = await r.json(); // { inserted: N }
      const fresh = await fetch(API).then(x=>x.json());
      setData(fresh);
      setImportInfo({ ok: true, inserted: ok.inserted });
      setImportRows([]);
    }catch(err){
      console.error(err);
      setImportInfo({ ok: false, error: err.message || String(err) });
    }finally{
      setIsProcessing(false);
    }
  }

  /* ========== Render ========== */
  if (route === "prodi") {
    const slug = path.split("/").slice(-1)[0];
    const prodi = findProdiBySlug(slug);
    return (
      <>
        <Header authed={authed} onLogout={handleLogout} />
        <div className="min-h-screen bg-gray-100 p-3 sm:p-4 md:p-8 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="max-w-7xl mx-auto space-y-5">
            <header className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">Dashboard Jadwal Fakultas – FKIK</h1>
                <p className="text-gray-600">Pantau jadwal hari ini & kalender mingguan. klik Prodi untuk tampilan khusus.</p>
                <div className="text-sm text-gray-700 mt-1">{formatTodayID()}</div>
              </div>
            </header>
            <ProdiPage
              prodi={prodi || "Prodi"}
              data={data}
              onBack={()=>{ window.history.back(); }}
              onSelectItem={setSelected}
            />
            <DetailModal item={selected} onClose={()=>setSelected(null)} />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header authed={authed} onLogout={handleLogout} />

      {route==='login' && (
        <Login onSuccess={()=>{ localStorage.setItem('fkik_auth','1'); window.location.href='/admin'; }} />
      )}

      <div className={route==='login' ? 'hidden' : 'block'}>
        <div className="min-h-screen bg-gray-100 p-3 sm:p-4 md:p-8 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="max-w-7xl mx-auto space-y-5">

            <div className="mt-[-1rem] md:mt-[-2rem]">
              {route !== 'login' && route !== 'admin' && <HeroCover />}
            </div>

            {/* ==== TAMBAHAN BARU: Slideshow 3 gedung (7 detik/slide) ==== */}
            {route !== 'login' && route !== 'admin' && 
              <section id="penggunaan-ruangan-today" className="mx-auto mb-6">
              <RoomUsageCarouselPerFloor data={data} onSelectItem={setSelected} />
              </section>
            }
            
            {importInfo && (
              <div className={`p-3 rounded-xl border ${importInfo.ok ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                {importInfo.ok ? (
                  importInfo.inserted != null
                    ? <>✅ Berhasil mengimpor <b>{importInfo.inserted}</b> baris.</>
                    : <>✅ File diproses. Siap diimport: <b>{importInfo.total}</b> baris.</>
                ) : (
                  <>❌ Gagal impor: {importInfo.error}</>
                )}
              </div>
            )}

            {route === "admin" ? (
              <AdminHome
                data={data}
                onSelectItem={setSelected}
                handleAddClick={()=>{ setEditing(null); setShowForm(true); }}
                handleEdit={(it)=>{ setEditing(it); setShowForm(true); }}
                handleDelete={handleDelete}
                handleDeleteAll={handleDeleteAll}
                handleImportFile={handleImportFile}
                handleProcessImport={handleProcessImport}
                importRows={importRows}
                isProcessing={isProcessing}
              />
            ) : (
              <>
                {/* <ProdiMenu /> */}
                <TodayCard data={data} />
                <RoomAvailabilityFinder data={data} />
                <UserHomeFilterable data={data} onSelectItem={setSelected} />
              </>
            )}
          </div>

          <DetailModal item={selected} onClose={()=>setSelected(null)} />
        </div>
      </div>

      {route !== 'login' && route !== 'admin' && <Footer />}

      {route==='admin' && finalIsAdmin && showForm && (
        <ScheduleForm
          initial={editing}
          onSave={handleSave}
          onCancel={()=>{ setShowForm(false); setEditing(null); }}
        />
      )}
    </>
  );
}

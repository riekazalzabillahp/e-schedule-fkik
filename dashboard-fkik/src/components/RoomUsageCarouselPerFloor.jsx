// src/components/RoomUsageCarouselPerFloor.jsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";

/* ==== helpers ringkas ==== */
const normStr = (v) => (v == null ? "" : String(v).trim());
const normHari = (v) => {
  const m = {
    senin: "Senin",
    selasa: "Selasa",
    rabu: "Rabu",
    kamis: "Kamis",
    jumat: "Jumat",
    sabtu: "Sabtu",
    minggu: "Minggu",
  };
  const k = normStr(v).toLowerCase();
  return m[k] || normStr(v);
};
const getTodayName = (d = new Date()) =>
  d
    .toLocaleDateString("id-ID", { weekday: "long" })
    .replace(/^./, (c) => c.toUpperCase());
const toLocalISO = (d) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
const minutesToLabel = (m) =>
  !isFinite(m)
    ? "--:--"
    : String(Math.floor(m / 60)).padStart(2, "0") +
      ":" +
      String(m % 60).padStart(2, "0");
const toMinutes = (t) => {
  if (t == null) return NaN;
  if (typeof t === "string") {
    const m = t
      .trim()
      .replace(/[.\-]/g, ":")
      .match(/^([0-1]?\d|2[0-3]):([0-5]\d)$/);
    if (m) return +m[1] * 60 + +m[2];
  }
  return NaN;
};
const makeTimeSlots = (start = "07:30", end = "17:30", step = 30) => {
  const s = toMinutes(start),
    e = toMinutes(end);
  const out = [];
  for (let m = s; m <= e; m += step) out.push(m);
  return out;
};
const dateOnly = (v) => (v ? String(v).slice(0, 10) : "");

/** aktif harian (mingguan atau blok) untuk tanggal tertentu */
function isActiveOnDate(it, dateObj, dayName) {
  const day = dayName || getTodayName(dateObj);
  const tipe = String(it.tipe || "mingguan").toLowerCase();

  if (tipe === "blok") {
    const start = it.tgl_mulai ? new Date(it.tgl_mulai + "T00:00:00") : null;
    const end = it.tgl_selesai ? new Date(it.tgl_selesai + "T23:59:59") : null;
    if (!start || !end) return false;
    if (dateObj < start || dateObj > end) return false;
    const hariAktif = normStr(it.hari_aktif);
    if (!hariAktif) return true; // jika tidak ditentukan, anggap semua hari aktif dlm periode
    const tokens = hariAktif
      .split(/[,;|]/)
      .map((s) => normHari(s.trim()))
      .filter(Boolean);
    return tokens.includes(normHari(day));
  }

  // mingguan
  return normHari(it.hari) === normHari(day);
}

/* ==== 1) Kartu PER LANTAI (waktu vertikal, ruangan horizontal) ==== */
function FloorUsageCard({
  title,
  rooms = [],
  items = [],
  start = "07:30",
  end = "17:00",
  step = 30,
  dateObj = new Date(),
  onSelectItem,
}) {
  const times = useMemo(() => makeTimeSlots(start, end, step), [start, end, step]);
  const START = toMinutes(start),
    END = toMinutes(end);

  const containerRef = useRef(null);

  // ukuran responsif
  const [timeColW, setTimeColW] = useState(56); // kolom waktu (px)
  const [rowH, setRowH] = useState(26); // tinggi slot menit (px)
  const [colWidths, setColWidths] = useState([]); // array width tiap kolom ruangan (px)

  // ==== HITUNG LEBAR KOLOM TANPA SCROLL ====
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const calc = () => {
      const w = el.clientWidth || 360;

      // kompres di HP
      const isPhone = w < 640;
      const tW = isPhone ? 46 : 56; // kolom waktu lebih sempit di HP
      const rH = isPhone ? 22 : 26; // baris waktu lebih rendah di HP
      setTimeColW(tW);
      setRowH(rH);

      const usable = Math.max(240, w - tW);
      const n = Math.max(1, rooms.length);

      // batas min/max kolom
      const MIN = isPhone ? 90 : 110; // minimal masih kebaca di HP
      const MAX = 240;

      // HP: gunakan lebar tetap per kolom dan izinkan scroll horizontal
      if (isPhone) {
        const baseMobile = Math.max(MIN, Math.min(MAX, 120));
        setColWidths(Array.from({ length: n }, () => baseMobile));
        return;
      }

      // lebar dasar kolom (float), lalu bagi sisa piksel ke kolom terakhir agar “pas”
      const base = Math.floor(usable / n);
      // base = Math.max(MIN, Math.min(MAX, base));

      const remainder = usable - base * n;

      // jika base*n > usable (karena MIN), scale-down agar pas
      let total = base * n;
      if (total > usable) {
        const scale = usable / total;
        const arr = Array.from({ length: n }, () => Math.floor(base * scale));
        // berikan sisa piksel ke kolom terakhir
        let leftover = usable - arr.reduce((a, b) => a + b, 0);
        arr[arr.length - 1] += leftover;
        setColWidths(arr);
      } else {
        // pas / ada sisa → serahkan sisa ke kolom terakhir
        const arr = Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
        setColWidths(arr);
      }
    };

    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    window.addEventListener("resize", calc);
    window.addEventListener("orientationchange", calc);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", calc);
      window.removeEventListener("orientationchange", calc);
    };
  }, [rooms.length]);

  // ====== FILTER DATA HARI/TANGGAL ======
  const dayName = useMemo(() => getTodayName(dateObj), [dateObj]);
  const filtered = useMemo(() => {
    const setRooms = new Set(rooms.map((r) => String(r).trim()));
    return items
      .filter((it) => setRooms.has(String(it.ruangan).trim()))
      .filter((it) => isActiveOnDate(it, dateObj, dayName))
      .map((it) => {
        const S = toMinutes(it.jam_mulai),
          E = toMinutes(it.jam_selesai);
        const s = Math.max(START, S),
          e = Math.min(END, E);
        return { ...it, S, E, s, e };
      })
      .filter((it) => isFinite(it.s) && isFinite(it.e) && it.e > it.s)
      .sort((a, b) => a.s - b.s);
  }, [items, rooms, dateObj, dayName, START, END]);

  // kelompokkan per ruangan
  const eventsByRoom = useMemo(() => {
    const m = new Map(rooms.map((r) => [String(r).trim(), []]));
    filtered.forEach((it) => {
      const key = String(it.ruangan).trim();
      if (m.has(key)) m.get(key).push(it);
    });
    for (const k of m.keys()) m.get(k).sort((a, b) => a.s - b.s);
    return m;
  }, [filtered, rooms]);

  const colorFor = (txt = "") => {
    const i =
      Math.abs(
        [...txt].reduce((a, c) => a + c.charCodeAt(0), 0)
      ) % 10;
    const hue = [200, 20, 140, 320, 185, 260, 80, 0, 100, 210][i];
    return `hsla(${hue},85%,92%,1)`;
  };

  const bodyH = times.length * rowH;
  const gridWidth = timeColW + colWidths.reduce((a, b) => a + b, 0);

  // posisi kumulatif kolom untuk separator dan blok
  const colLefts = useMemo(() => {
    const arr = [0];
    for (let i = 0; i < colWidths.length - 1; i++) {
      arr.push(arr[i] + colWidths[i]);
    }
    return arr;
  }, [colWidths]);

  return (
    <div className="w-full">
      <div className="mb-2 text-center">
        <h3 className="text-base font-semibold">
          {title} • {dayName}, {toLocalISO(dateObj)}
        </h3>
      </div>

      {/* TIDAK ADA SCROLL: seluruh grid di-fit ke lebar container */}
      <div
        ref={containerRef}
        className="rounded-2xl border bg-white shadow-sm overflow-x-auto"
      >
        {/* HEADER */}
        <div
          className="grid border-b bg-white"
          style={{
            minWidth: gridWidth,
            gridTemplateColumns: `${timeColW}px ${colWidths
              .map((w) => `${w}px`)
              .join(" ")}`,
          }}
        >
          <div className="h-[34px] flex items-center justify-center font-medium text-gray-600 border-r">
          </div>
          {rooms.map((r) => (
            <div
              key={r}
              className="h-[34px] flex items-center justify-center border-r text-sm font-medium text-gray-700"
            >
              {r}
            </div>
          ))}
        </div>

        {/* BODY (garis grid + label waktu + blok) */}
        <div className="relative">
          {/* Latar: garis horizontal (baris waktu) */}
          <div
            className="border-r"
            style={{
              backgroundImage: `repeating-linear-gradient(to bottom, transparent, transparent ${
                rowH - 1
              }px, #e5e7eb ${rowH - 1}px, #e5e7eb ${rowH}px)`,
              backgroundSize: `100% ${rowH}px`,
              backgroundPosition: `0 0`,
              width: gridWidth,
              height: bodyH,
            }}
          />

          {/* Separator vertikal presisi di setiap batas kolom (tanpa asumsi lebar sama) */}
          <div
            className="pointer-events-none absolute top-0"
            style={{
              left: timeColW,
              height: bodyH,
              width: gridWidth - timeColW,
            }}
          >
            {colLefts.map((x, i) =>
              i === 0 ? null : (
                <div
                  key={i}
                  className="absolute top-0 bg-gray-200"
                  style={{ left: x, width: 1, height: "100%" }}
                />
              )
            )}
          </div>

          {/* label waktu kiri */}
          <div className="absolute top-0 left-0" style={{ width: timeColW }}>
            {times.map((m, i) => (
              <div
                key={i}
                className="pr-2 text-right text-[11px] tabular-nums text-gray-600 flex items-center justify-end border-b"
                style={{ height: rowH }}
              >
                {minutesToLabel(m)}
              </div>
            ))}
          </div>

          {/* blok per-ruang */}
          <div
            className="absolute top-0 right-0"
            style={{ left: timeColW, height: bodyH }}
          >
            {rooms.map((room, colIdx) => {
              const list = eventsByRoom.get(String(room).trim()) || [];
              const colLeft = colLefts[colIdx] || 0;
              const colW = colWidths[colIdx] || 0;

              return (
                <div
                  key={room}
                  className="absolute top-0"
                  style={{ left: colLeft, width: colW, height: "100%" }}
                >
                  {list.map((it, idx) => {
                    const top = ((it.s - START) / step) * rowH;
                    const h = Math.max(18, ((it.e - it.s) / step) * rowH - 4);
                    return (
                      <div
                        key={idx}
                        className="absolute left-1 right-1 rounded-md border text-[11px] px-2 py-1 shadow-sm cursor-pointer hover:ring-2 hover:ring-sky-400/60"
                        style={{
                          top,
                          height: h,
                          background: colorFor(it.prodi),
                          borderColor: "#ddd",
                        }}
                        onClick={() => onSelectItem?.(it)}
                        title={`${it.mata_kuliah}${
                          it.fase ? ` (${it.fase})` : ""
                        } • Kls ${it.kelas}
${it.prodi} • ${it.gedung || ""} ${it.ruangan || ""}
${minutesToLabel(it.S)}–${minutesToLabel(it.E)} • ${it.dosen || "-"}`}
                      >
                        <div className="font-medium truncate">
                          {it.mata_kuliah}
                        </div>
                        <div className="text-[10px] font-semibold text-gray-600 truncate uppercase">
                          {it.prodi}
                        </div>
                        <div className="opacity-70 truncate">
                          {minutesToLabel(it.S)}–{minutesToLabel(it.E)}
                        </div>
                        <div className="opacity-70 truncate">({it.kelas})</div>
                      </div>
                    );
                  })}

                  {list.length === 0 && (
                    <div className="absolute inset-x-2 top-2 text-center text-[11px] text-gray-400 select-none">
                      Tidak ada jadwal
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==== 2) CAROUSEL PER-LANTAI (7 detik) ==== */

// helper cocokkan nama gedung dengan toleransi (khusus "Kampus 1")
function matchGedung(slideGedung, dataGedung) {
  const a = normStr(slideGedung).toLowerCase();
  const b = normStr(dataGedung).toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  // toleransi: "kampus 1" vs "kampus 1 - gedung anatomi/utama"
  if (a.startsWith("kampus 1")) {
    return (
      b.startsWith("kampus 1") ||
      ["gedung anatomi", "gedung utama"].some((x) => b.includes(x))
    );
  }
  return false;
}

export default function RoomUsageCarouselPerFloor({
  data = [], // seluruh jadwal
  start = "07:30",
  end = "17:00",
  step = 30,
  intervalMs = 7000, // 7 detik/slide
  onSelectItem,
}) {
  // definisi ruangan per lantai (edit sesuai kebutuhan)
  const slides = [
    {
      title: "GEDUNG B — LANTAI 1",
      gedung: "Gedung B",
      rooms: ["1.01A", "1.01B", "1.02B", "1.03", "1.04", "1.05", "1.06", "1.07"],
    },
    {
      title: "GEDUNG B — LANTAI 2",
      gedung: "Gedung B",
      rooms: ["2.08", "2.09", "2.10", "2.11", "2.13", "2.14B"],
    },
    {
      title: "GEDUNG B — LANTAI 3",
      gedung: "Gedung B",
      rooms: ["3.17", "3.19", "3.20", "3.21", "3.22", "3.23", "3.24", "3.29"],
    },
    {
      title: "GEDUNG AB — LANTAI 1 & 2",
      gedung: "Gedung AB",
      rooms: [
        "1.23",
        "1.24",
        "1.25",
        "1.26",
        "1.27",
        "1.28",
        "1.29",
        "1.30",
        "2.31",
        "2.32",
        "2.33",
      ],
    },
    {
      title: "GEDUNG C — LANTAI 1 & 2",
      gedung: "Gedung C",
      rooms: [
        "1.02",
        "1.03",
        "2.01",
        "2.02",
        "2.03",
        "2.04",
        "2.05",
        "2.06",
        "2.07",
        "2.08",
        "2.09",
      ],
    },
    {
      title: "GEDUNG ANATOMI & UTAMA — Lantai 2",
      gedung: "Kampus 1",
      rooms: ["I", "II", "III", "IV"],
    },
  ];

  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const dateObj = useMemo(() => new Date(), []);

  // saring data untuk 1 gedung (lantai difilter via rooms)
  const slide = slides[idx];
  const items = useMemo(
    () => data.filter((d) => matchGedung(slide.gedung, d.gedung)),
    [data, slide.gedung]
  );

  // autoplay
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % slides.length), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, slides.length, paused]);

  // keyboard nav
  const containerRef = useRef(null);
  useEffect(() => {
    const onKey = (e) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(document.activeElement)) return;
      if (e.key === "ArrowRight") setIdx((i) => (i + 1) % slides.length);
      if (e.key === "ArrowLeft") setIdx((i) => (i - 1 + slides.length) % slides.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length]);

  const go = useCallback(
    (n) => setIdx(((n % slides.length) + slides.length) % slides.length),
    [slides.length]
  );

  return (
    <div
      ref={containerRef}
      className="rounded-2xl p-3 border bg-white"
      tabIndex={0}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Penggunaan ruangan per lantai"
    >
      {/* Header kontrol */}
      <div className="flex items-center justify-start gap-3 mb-2">

        {/* Dropdown pemilih slide (terkontrol oleh idx, jadi otomatis berubah) */}
        <div className="flex items-center gap-2">
          <div className="relative inline-block">
            <select
              value={idx}
              onChange={(e) => go(Number(e.target.value))}
              className="
                bg-gray-700 text-gray-100 border border-gray-600
                rounded-md pl-2 pr-6 py-[1px] text-[11px] h-[22px]
                w-[150px] sm:w-[170px] cursor-pointer
                focus:outline-none focus:ring-1 focus:ring-gray-400
                transition-all duration-150 hover:bg-gray-600
                appearance-none leading-tight
              "
              aria-label="Pilih lokasi/lantai"
            >
              {slides.map((s, i) => (
                <option
                  key={i}
                  value={i}
                  className="bg-gray-700 text-gray-100 text-[11px] leading-tight"
                >
                  {s.title}
                </option>
              ))}
            </select>

            {/* Ikon dropdown custom */}
            <div
              className="pointer-events-none absolute inset-y-0 right-1 flex items-center pr-1 text-gray-300"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-3 h-3"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0l-4.24-4.24a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
        </div>

      </div>

      <FloorUsageCard
        title={slide.title}
        rooms={slide.rooms}
        items={items}
        start={start}
        end={end}
        step={step}
        dateObj={dateObj}
        onSelectItem={onSelectItem}
      />
    </div>
  );
}

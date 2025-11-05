import React from "react";
import logoUIN from "../assets/UINAM.png";

export default function Header({ authed, onLogout }) {
  // Sembunyikan tombol "Login Admin" saat berada di halaman /login
  const isLoginPage =
    typeof window !== "undefined" && window.location.pathname === "/login";

  // Tinggi header konsisten (dipakai juga untuk spacer agar konten tidak tertutup)
  const HEADER_H_CLASS = "h-14 sm:h-16";

  return (
    <>
      {/* HEADER selalu terlihat (fixed) */}
      <header
        className={`
          fixed inset-x-0 top-0 z-50 border-b shadow-sm
          bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70
          dark:bg-neutral-900/80 dark:border-neutral-800
        `}
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        aria-label="Navigasi utama FKIK UIN Alauddin"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className={`flex items-center justify-between gap-3 ${HEADER_H_CLASS}`}>
            {/* Kiri: Logo + Judul */}
            <a
              href="/"
              className="group flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-md"
              aria-label="Beranda FKIK"
            >
              <img
                src={logoUIN}
                alt="Logo UIN Alauddin"
                className="h-9 w-auto sm:h-10 select-none"
                loading="eager"
                decoding="async"
              />
              <div className="leading-tight">
                <div className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 dark:text-white">
                  <span className="sm:hidden">FKIK UIN Alauddin</span>
                  <span className="hidden sm:inline">
                    Fakultas Kedokteran dan Ilmu Kesehatan
                  </span>
                </div>
                <div className="text-[11px] sm:text-xs text-gray-600 dark:text-gray-300">
                  Sistem Monitoring Jadwal & Penggunaan Ruang
                </div>
              </div>
            </a>

            {/* Kanan: Aksi */}
            <div className="flex items-center gap-2">
              {/* Tampilkan "Login Admin" hanya jika belum login & bukan di /login */}
              {!authed && !isLoginPage ? (
                <a
                  href="/login"
                  className="
                    inline-flex items-center justify-center
                    px-3 py-1.5 rounded-md text-sm font-medium
                    bg-emerald-700 text-white hover:opacity-95 active:opacity-90
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600
                  "
                  aria-label="Masuk sebagai admin"
                >
                  Login Admin
                </a>
              ) : null}

              {authed && (
                <>
                  <a
                    href="/admin"
                    className="
                      inline-flex items-center justify-center
                      px-3 py-1.5 rounded-md text-sm font-medium
                      border border-gray-300 bg-white text-gray-800 hover:bg-gray-50
                      dark:bg-neutral-900 dark:text-gray-100 dark:border-neutral-700 dark:hover:bg-neutral-800
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600
                    "
                    aria-label="Buka panel admin"
                  >
                    Admin Panel
                  </a>
                  <button
                    onClick={onLogout}
                    className="
                      inline-flex items-center justify-center
                      px-3 py-1.5 rounded-md text-sm font-medium
                      bg-red-600 text-white hover:bg-red-700 active:bg-red-700
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600
                    "
                    aria-label="Keluar"
                  >
                    Logout
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Spacer agar konten tidak tertutup header fixed */}
      <div aria-hidden="true" className={HEADER_H_CLASS} />
    </>
  );
}

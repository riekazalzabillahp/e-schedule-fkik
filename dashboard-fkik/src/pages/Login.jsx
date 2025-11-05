import React, { useState } from "react";
import logoUIN from "../assets/UINAM.png";

/**
 * Login Admin FKIK
 * - Tampil logo + judul di atas (seragam dengan header)
 * - Validasi sederhana, tampilkan error
 * - onSuccess() akan dipanggil jika login benar
 */
export default function Login({ onSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    // Demo auth: samakan dengan kebutuhanmu / backend nanti
    if (username === "adminfkik" && password === "Fkik2025") {
      localStorage.setItem("fkik_auth", "1");
      setError("");
      onSuccess?.();
    } else {
      setError("Username atau password salah.");
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center">
      <div className="w-full max-w-md mx-auto">
        {/* Header mini (logo + judul) */}
        <div className="flex flex-col items-center mb-6">
          <img src={logoUIN} alt="UIN Alauddin" className="h-14 w-auto mb-2" />
          <div className="text-center">
            <div className="text-base sm:text-lg font-semibold">
              Fakultas Kedokteran dan Ilmu Kesehatan
            </div>
            <div className="text-xs text-gray-500">UIN Alauddin Makassar</div>
          </div>
        </div>

        {/* Kartu Login */}
        <div className="bg-white border rounded-2xl shadow-sm p-6">
          <h1 className="text-lg font-semibold mb-1">Login Admin</h1>
          <p className="text-sm text-gray-600 mb-4">
            Masuk untuk mengelola jadwal, impor data, dan melakukan perubahan.
          </p>

          {error && (
            <div className="mb-4 text-sm rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm mb-1">Username</label>
              <input
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
                placeholder="username"
                value={username}
                autoComplete="username"
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Password</label>
              <div className="flex gap-2">
                <input
                  type={showPass ? "text" : "password"}
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
                  placeholder="••••••••"
                  value={password}
                  autoComplete="current-password"
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="shrink-0 px-3 rounded-md border text-sm hover:bg-gray-50"
                  aria-label={showPass ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showPass ? "Sembunyi" : "Tampil"}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" className="border rounded" />
                Ingat saya
              </label>
            </div>

            <button
              className="w-full mt-2 bg-emerald-700 text-white rounded-md py-2 text-sm hover:opacity-95"
              type="submit"
            >
              Masuk
            </button>

            <div className="text-[12px] text-gray-500 mt-3">
              <a href="/" className="text-sm text-emerald-700 hover:underline">
                Kembali ke Beranda
              </a>
            </div>
          </form>
        </div>

        {/* Catatan kecil */}
        <div className="text-xs text-gray-500 text-center mt-4">
          Pastikan kamu menggunakan kredensial yang benar. Hubungi admin bila lupa password.
        </div>
      </div>
    </div>
  );
}

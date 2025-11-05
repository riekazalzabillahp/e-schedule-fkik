import React from "react";
import { MapPin, Mail, Globe } from "lucide-react";
import uinamLogo from "../assets/UINAM.png"; // logo UINAM dari folder assets

export default function Footer() {
  return (
    <footer
      className="
        w-full border-t bg-gray-100 text-gray-800
        dark:bg-neutral-900 dark:text-gray-200 dark:border-neutral-800
      "
      style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
      aria-label="Informasi FKIK UIN Alauddin Makassar"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <h2 className="sr-only">Footer</h2>

        {/* Top: Logo + Judul */}
        <div className="flex items-center justify-center gap-3">
          <img
            src={uinamLogo}
            alt="Logo UIN Alauddin"
            className="h-10 w-10 object-contain select-none"
            loading="lazy"
            decoding="async"
          />
          <div className="text-center sm:text-left">
            <p className="text-[14px] font-semibold text-gray-900 dark:text-white">
              Sistem Informasi Monitoring Jadwal & Penggunaan Ruang FKIK
            </p>
            <p className="text-[14px] text-gray-700 dark:text-gray-300">
              Universitas Islam Negeri Alauddin Makassar
            </p>
          </div>
        </div>

        {/* Middle: Alamat + Kontak (grid di layar lebar) */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <address className="not-italic space-y-2 text-[14px]">
            <div className="flex items-start gap-2">
              <MapPin size={16} className="mt-[2px] text-sky-700 dark:text-sky-400" aria-hidden="true" />
              <span>
                <strong className="text-gray-900 dark:text-white">Kampus 1:</strong>{" "}
                Jl. Sultan Alauddin No. 63, Makassar, Sulawesi Selatan, Indonesia
              </span>
            </div>
            <div className="flex items-start gap-2">
              <MapPin size={16} className="mt-[2px] text-sky-700 dark:text-sky-400" aria-hidden="true" />
              <span>
                <strong className="text-gray-900 dark:text-white">Kampus 2:</strong>{" "}
                Jl. H.M. Yasin Limpo No. 36, Kel. Romang Polong, Kec. Somba Opu, Kab. Gowa, Sulawesi Selatan, Indonesia
              </span>
            </div>
          </address>

          <div className="space-y-2 text-[14px]">
            <p className="flex items-center justify-start sm:justify-end gap-2">
              <Mail size={16} className="text-sky-700 dark:text-sky-400" aria-hidden="true" />
              <a
                href="mailto:fkik@uin-alauddin.ac.id"
                className="text-sky-700 hover:underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 rounded
                           dark:text-sky-400 dark:focus:ring-offset-neutral-900"
              >
                fkik@uin-alauddin.ac.id
              </a>
              <span className="text-gray-600 dark:text-gray-400">(Aduan & Layanan Informasi)</span>
            </p>

            <p className="flex items-center justify-start sm:justify-end gap-2">
              <Globe size={16} className="text-sky-700 dark:text-sky-400" aria-hidden="true" />
              <a
                href="https://fkik.uin-alauddin.ac.id/"
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-sky-700 hover:underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 rounded
                           dark:text-sky-400 dark:focus:ring-offset-neutral-900"
              >
                https://fkik.uin-alauddin.ac.id/
              </a>
            </p>
          </div>
        </div>

        {/* Bottom: Copyright */}
        <p className="mt-4 text-center text-[12px] text-gray-700 dark:text-gray-400">
          © {new Date().getFullYear()} — Dikembangkan oleh{" "}
          <span className="font-medium text-gray-900 dark:text-white">RiekaZP Operator FKIK</span>
        </p>
      </div>
    </footer>
  );
}

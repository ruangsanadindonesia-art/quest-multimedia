# Quest Multimedia

Aplikasi baru Ruang Sanad yang menggunakan fondasi [Laju Go](https://github.com/maulanashalihin/laju-go). Repo ini dikembangkan secara terpisah dari Dashboard Ruang Sanad yang sudah berjalan.

## Stack saat ini

- Backend: Go 1.26.1, Fiber v2, SQLite (CGO), sqlc dan Goose.
- Frontend: React 19, TypeScript, Inertia.js 3, Vite 8 dan Tailwind CSS 4.
- Auth bawaan template: email/password, Google OAuth opsional, session dan role admin/user.
- Database/migration: SQLite pada `data/`, migration di `migrations/`.

Package Go masih menggunakan module path upstream (`github.com/maulanashalihin/laju-go`). Ini disengaja selama bootstrap untuk menghindari perubahan massal import sebelum build baseline terverifikasi.

## Setup development

Prasyarat: Go 1.26.1 dengan CGO compiler (gcc), Node.js 22, npm.

```bash
git clone https://github.com/ruangsanadindonesia-art/quest-multimedia.git
cd quest-multimedia
cp .env.example .env
go mod download
npm ci
npm run dev:all
```

Buka `http://localhost:8080`. Entry React adalah `frontend/src/main.tsx`; `VITE_ENTRY=src/main.tsx` di `.env.example`.

## Verifikasi

```bash
npm ci
npm run typecheck
npm run build
go vet ./...
go test ./...
go build ./cmd/laju-go
```

`npm run verify` menjalankan typecheck, frontend build, backend build, vet, dan Go tests. Workflow `.github/workflows/verify.yml` memverifikasi PR tanpa deployment dan menjalankan smoke test lokal serta Docker build.

## Batasan bootstrap

- Dashboard starter masih berisi contoh angka sistem dan aktivitas statis. Itu **bukan** data operasional.
- Branding dan modul bisnis Quest Multimedia belum diimplementasikan.
- `.env`, database dan file upload tidak boleh di-commit. Untuk production, `SESSION_SECRET` harus unik, tidak menggunakan placeholder, dan panjangnya minimal 32 karakter.
- Deployment environment/server, migrasi production dan restart dilakukan manual setelah ada instruksi dan bukti yang sesuai.
- Metadata paket upstream menyebut lisensi MIT, tetapi file LICENSE belum ditemukan di repo saat bootstrap. Pastikan izin dan atribusi sebelum distribusi/komersialisasi.

## Kredit

Berbasis template Laju Go oleh Maulana Shalihin. Lihat [repository upstream](https://github.com/maulanashalihin/laju-go).

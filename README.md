# Jadwal Kelas

Aplikasi jadwal mingguan lokal untuk laptop Windows dan HP. Data disimpan sebagai file JSON di laptop, tanpa akun cloud. Instalasi baru dimulai dengan jadwal kosong yang bisa diisi lewat menu Atur.

## Jalankan server lokal

Syarat: Node.js 20 atau lebih baru.

1. Buka terminal di folder aplikasi.
2. Jalankan npm install satu kali.
3. Jalankan npm start.
4. Buka http://localhost:4173 di laptop.

Perintah npm start membangun aplikasi lalu menjalankan server. Server juga mencetak alamat Wi-Fi yang dapat dibuka dari HP. Edit jadwal dari menu Atur; perubahan langsung disimpan ke file lokal dan perangkat lain memuatnya maksimal dalam 15 detik.

Data jadwal tersimpan di folder `data\schedules.json` di dalam folder aplikasi. Untuk memilih folder lain, atur `JADWAL_DATA_DIR` sebelum menjalankan server.

## Buka dari HP

Sambungkan laptop dan HP ke Wi-Fi yang sama. Ketik alamat LAN yang dicetak server atau ditampilkan di bagian Buka di HP pada aplikasi, misalnya http://192.168.1.20:4173. Server laptop harus tetap menyala selama jadwal dipakai.

Setiap kartu pelajaran memiliki panel Catatan & tugas. Catatan dan daftar tugas disimpan bersama data jadwal di laptop dan ikut tersinkron ke HP lewat Wi-Fi lokal.

Browser HP dapat melihat dan mengubah jadwal yang sama selama terhubung ke laptop. Saat server tidak terjangkau, perangkat menampilkan salinan terakhir yang tersimpan dan menonaktifkan edit.

Chrome mensyaratkan HTTPS atau localhost untuk memasang PWA penuh. Alamat LAN lokal memakai HTTP, jadi HP tetap bisa membuka aplikasi di browser, tetapi tombol instalasi PWA bisa tidak tersedia. Menu browser dapat menawarkan pintasan layar utama.

## Widget desktop Windows

Jalankan `npm run desktop`. Perintah ini menyalakan server lokal tanpa jendela terminal, lalu menampilkan widget Jadwal Kelas kecil, tanpa bingkai browser, transparan, dan di pojok kanan atas desktop. Widget mengikuti hari Jakarta dan tertutup di belakang jendela aplikasi lain. Klik kanan widget untuk membuka editor di browser, memuat ulang, atau menutup widget. Jadwal di HP tetap dibuka dari alamat Wi-Fi lokal.

Semua kartu pelajaran ditampilkan utuh. Widget bisa digulir manual dan bergerak otomatis ke pesan “Semangat terus, Daks!”, lalu kembali ke awal; sentuhan atau scroll manual menjeda gerakan otomatis sebentar.

Saat pertama kali memasang dependensi, Electron mengunduh runtime desktop satu kali:

    npm install
    npm run desktop:setup

Autostart memakai Task Scheduler setelah login Windows, dengan jeda 5 detik:

    npm run startup:install

Matikan autostart dengan:

    npm run startup:uninstall

Log startup tersimpan di `%LOCALAPPDATA%\JadwalKelas\startup.log` untuk membantu mencari tahu kalau widget gagal dibuka.

## Pengembangan dan pemeriksaan

    npm run dev
    npm test
    npm run build

Mode pengembangan membuka Vite di port 1420 dan meneruskan API ke server lokal port 4173. Jalankan server lokal di terminal kedua jika memakai mode ini.


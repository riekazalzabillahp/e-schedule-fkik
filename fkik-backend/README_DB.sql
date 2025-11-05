CREATE DATABASE IF NOT EXISTS jadwal_fkik;
CREATE USER IF NOT EXISTS 'adminfkik'@'localhost' IDENTIFIED BY 'Fkik2025';
GRANT ALL PRIVILEGES ON jadwal_fkik.* TO 'adminfkik'@'localhost';
FLUSH PRIVILEGES;

USE jadwal_fkik;
CREATE TABLE IF NOT EXISTS jadwal (
  id INT AUTO_INCREMENT PRIMARY KEY,
  prodi VARCHAR(100) NOT NULL,
  mata_kuliah VARCHAR(150) NOT NULL,
  kelas VARCHAR(20) NOT NULL,
  semester INT,
  hari VARCHAR(20) NOT NULL,
  jam_mulai VARCHAR(10) NOT NULL,
  jam_selesai VARCHAR(10) NOT NULL,
  gedung VARCHAR(100),
  ruangan VARCHAR(50),
  dosen VARCHAR(150),
  sks INT
);

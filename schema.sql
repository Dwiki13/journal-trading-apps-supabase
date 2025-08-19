-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Waktu pembuatan: 19 Agu 2025 pada 13.30
-- Versi server: 10.4.28-MariaDB
-- Versi PHP: 8.2.4

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `trading_journal_db`
--

-- --------------------------------------------------------

--
-- Struktur dari tabel `journal`
--

CREATE TABLE `journal` (
  `id` int(11) NOT NULL,
  `modal` varchar(256) NOT NULL,
  `modalType` varchar(10) NOT NULL DEFAULT 'USD',
  `tanggal` date NOT NULL,
  `pair` varchar(10) NOT NULL,
  `side` varchar(4) NOT NULL,
  `lot` decimal(10,2) NOT NULL,
  `hargaEntry` decimal(15,6) NOT NULL,
  `hargaTakeProfit` decimal(15,6) NOT NULL,
  `hargaStopLoss` decimal(15,6) NOT NULL,
  `analisaBefore` text DEFAULT NULL,
  `analisaAfter` text DEFAULT NULL,
  `reason` varchar(256) NOT NULL,
  `winLose` varchar(4) NOT NULL,
  `profit` decimal(15,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `journal`
--

INSERT INTO `journal` (`id`, `modal`, `modalType`, `tanggal`, `pair`, `side`, `lot`, `hargaEntry`, `hargaTakeProfit`, `hargaStopLoss`, `analisaBefore`, `analisaAfter`, `reason`, `winLose`, `profit`) VALUES
(21, '500000', 'Cent', '2025-08-13', 'XAUUSD', 'Buy', 5.00, 3357.328000, 3367.010000, 3352.944000, '1755098437905-XAUUSD_2025-08-13_18-40-46.png', '1755098437905-XAUUSD_2025-08-13_21-04-12.png', 'London Break High Asia , Sweep High Asia & M15 FVG ', 'Win', 4825.00),
(22, '', 'USD', '2025-08-14', 'XAUUSD', 'Sell', 5.00, 3358.508000, 3341.535000, 3366.634000, '1755182115716-14 Agustus Before.jpg', '1755182115721-14 Agustus After.jpg', 'London Break Low Asia , Sweep Low Asia & M15 FVG', 'Win', 8375.00),
(23, '', 'USD', '2025-08-15', 'GBPJPY', 'Buy', 5.00, 199.134000, 199.511000, 199.011000, '1755247996126-GBPJPY_2025-08-15_15-31-33.png', '1755247996135-GBPJPY_2025-08-15_15-50-22.png', 'RBS M15 , Not in M15 FVG and London Break Low Asia ( Not Follow Structure London )  ', 'Lose', 418.69),
(24, '', 'USD', '2025-08-15', 'EURUSD', 'Buy', 5.00, 1.167460, 1.168510, 1.167020, '1755308754324-15 Agustus EURUSD Before.png', '1755308754327-15 Agustu EURUSD After.png', 'London Break High Asia , Sweep High Asia & M15 IFVG ', 'Win', 525.00),
(25, '', '', '2025-08-15', 'GBPUSD', 'Sell', 5.00, 1.355490, 1.354350, 1.356060, '1755308982381-15 Agustus GBPUSD Before.png', '1755308982381-15 Agustus GBPUSD After.png', 'London Not Break High Asia Just Sweep, But not break low Asia too and entry not in FVG M15 ', 'Lose', 285.00),
(26, '', 'USD', '2025-08-15', 'USDJPY', 'Sell', 5.00, 147.060000, 146.643000, 147.238000, '1755309414925-15 Agustus USDJPY Before.png', '1755309414926-15 Agustus USDJPY After.png', 'London Break Low Asia , Sweep Low Asia & M15 FVG ( SL Because News ) ', 'Lose', 604.46),
(27, '', 'Cent', '2025-08-15', 'GBPJPY', 'Sell', 5.00, 199.317000, 198.917000, 199.517000, '1755309788073-15 Agustu GBPJPY Before.jpg', '1755309788073-15 Agustu GBPJPY After.jpg', 'London Break Low Asia , Sweep Low Asia & M15 FVG ( SL Because News ) ', 'Lose', 679.03);

--
-- Indexes for dumped tables
--

--
-- Indeks untuk tabel `journal`
--
ALTER TABLE `journal`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT untuk tabel yang dibuang
--

--
-- AUTO_INCREMENT untuk tabel `journal`
--
ALTER TABLE `journal`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

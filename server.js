const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));


// Config koneksi MySQL (ganti dengan config kamu)
// const db = mysql.createPool({
//   host: "localhost",
//   user: "root",
//   database: "trading_journal_db",
// });

const db = mysql.createPool({
  host: process.env.MYSQLHOST || "localhost",
  user: process.env.MYSQLUSER || "root",
  password: process.env.MYSQLPASSWORD || "",
  database: process.env.MYSQLDATABASE || "trading_journal_db",
  port: process.env.MYSQLPORT || 3306,
  ssl: {
    rejectUnauthorized: true
  }
});


db.getConnection((err, conn) => {
  if (err) {
    console.error("❌ Gagal connect ke DB:", err);
  } else {
    console.log("✅ Berhasil connect ke DB Railway");
    conn.release();
  }
});


const multer = require("multer");

// Konfigurasi penyimpanan file
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // folder tempat menyimpan file
  },
  filename: function (req, file, cb) {
    // menambahkan timestamp supaya nama file unik
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Endpoint simpan data journal
app.post("/api/journal", upload.fields([
  { name: 'analisaBefore', maxCount: 1 },
  { name: 'analisaAfter', maxCount: 1 }
]), (req, res) => {
  const {
    modal,
    modalType,
    tanggal,
    pair,
    side,
    lot,
    hargaEntry,
    hargaTakeProfit,
    hargaStopLoss,
    reason,
    winLose,
    profit,
  } = req.body;

   // Ambil nama file dari multer
  const analisaBefore = req.files?.analisaBefore?.[0]?.filename || null;
  const analisaAfter = req.files?.analisaAfter?.[0]?.filename || null;

  const query =
    "INSERT INTO journal (modal, modalType, tanggal, pair, side, lot, hargaEntry, hargaTakeProfit, hargaStopLoss, analisaBefore, analisaAfter, reason, winLose, profit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

  db.query(
    query,
    [
      modal,
      modalType,
      tanggal,
      pair,
      side,
      lot,
      hargaEntry,
      hargaTakeProfit,
      hargaStopLoss,
      analisaBefore,
      analisaAfter,
      reason,
      winLose,
      profit,
    ],
    (err, result) => {
      if (err) {
        console.error(err);
        res.status(500).send("Error menyimpan data");
      } else {
        res.json({ message: "Data berhasil disimpan", id: result.insertId });
      }
    }
  );
});

// Endpoint ambil data journal
app.get("/api/journal", (req, res) => {
  db.query("SELECT * FROM journal ORDER BY tanggal ASC", (err, results) => {
    if (err) {
      res.status(500).send("Error mengambil data");
    } else {
      res.json(results);
    }
  });
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

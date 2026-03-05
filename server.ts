import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("attendance.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    class TEXT NOT NULL,
    password TEXT NOT NULL DEFAULT '123456'
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL, -- 'Hadir', 'Sakit', 'Izin', 'Alpa'
    reason TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id)
  );
`);

// Add reason column if not exists (migration)
try {
  db.prepare("ALTER TABLE attendance ADD COLUMN reason TEXT").run();
} catch (e) {
  // Column already exists or other error
}

// Seed admin if not exists
const adminExists = db.prepare("SELECT * FROM admin WHERE username = 'admin'").get();
if (!adminExists) {
  db.prepare("INSERT INTO admin (username, password) VALUES (?, ?)").run("admin", "admin123");
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Auth Routes
  app.post("/api/auth/admin/login", (req, res) => {
    const { username, password } = req.body;
    const admin = db.prepare("SELECT * FROM admin WHERE username = ? AND password = ?").get(username, password);
    if (admin) {
      res.json({ success: true, message: "Login Admin Berhasil" });
    } else {
      res.status(401).json({ error: "Username atau Password Admin salah" });
    }
  });

  app.put("/api/auth/admin/profile", (req, res) => {
    const { oldUsername, newUsername, newPassword } = req.body;
    try {
      const admin = db.prepare("SELECT * FROM admin WHERE username = ?").get(oldUsername);
      if (!admin) return res.status(404).json({ error: "Admin tidak ditemukan" });
      
      db.prepare("UPDATE admin SET username = ?, password = ? WHERE username = ?").run(newUsername, newPassword, oldUsername);
      res.json({ success: true, message: "Profil Admin diperbarui" });
    } catch (error) {
      res.status(500).json({ error: "Gagal memperbarui profil admin" });
    }
  });

  app.post("/api/auth/student/login", (req, res) => {
    const { id, password } = req.body;
    const student = db.prepare("SELECT * FROM students WHERE id = ? AND password = ?").get(id, password);
    if (student) {
      res.json({ success: true, student });
    } else {
      res.status(401).json({ error: "ID atau Password Siswa salah" });
    }
  });

  // API Routes
  
  // Get all students with their attendance summary
  app.get("/api/students", (req, res) => {
    const students = db.prepare(`
      SELECT s.*, 
        (SELECT COUNT(*) FROM attendance WHERE student_id = s.id AND status = 'Hadir') as hadir,
        (SELECT COUNT(*) FROM attendance WHERE student_id = s.id AND status = 'Sakit') as sakit,
        (SELECT COUNT(*) FROM attendance WHERE student_id = s.id AND status = 'Izin') as izin,
        (SELECT COUNT(*) FROM attendance WHERE student_id = s.id AND status = 'Alpa') as alpa
      FROM students s
    `).all();
    res.json(students);
  });

  // Add student
  app.post("/api/students", (req, res) => {
    const { id, name, className, password } = req.body;
    try {
      db.prepare("INSERT INTO students (id, name, class, password) VALUES (?, ?, ?, ?)").run(id, name, className, password || '123456');
      res.status(201).json({ message: "Student added" });
    } catch (error) {
      res.status(400).json({ error: "Student ID already exists" });
    }
  });

  // Update student
  app.put("/api/students/:id", (req, res) => {
    const { id } = req.params;
    const { name, className, password } = req.body;
    if (password) {
      db.prepare("UPDATE students SET name = ?, class = ?, password = ? WHERE id = ?").run(name, className, password, id);
    } else {
      db.prepare("UPDATE students SET name = ?, class = ? WHERE id = ?").run(name, className, id);
    }
    res.json({ message: "Student updated" });
  });

  // Delete student
  app.delete("/api/students/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM attendance WHERE student_id = ?").run(id);
    db.prepare("DELETE FROM students WHERE id = ?").run(id);
    res.json({ message: "Student deleted" });
  });

  // Mark attendance (Scan QR)
  app.post("/api/attendance/scan", (req, res) => {
    const { student_id, status = 'Hadir', reason = null } = req.body;
    const date = new Date().toISOString().split('T')[0];

    // Check if student exists
    const student = db.prepare("SELECT * FROM students WHERE id = ?").get(student_id);
    if (!student) {
      return res.status(404).json({ error: "Siswa tidak ditemukan" });
    }

    // Check if already attended today
    const existing = db.prepare("SELECT * FROM attendance WHERE student_id = ? AND date = ?").get(student_id, date);
    if (existing) {
      return res.status(400).json({ error: "Siswa sudah absen hari ini" });
    }

    db.prepare("INSERT INTO attendance (student_id, date, status, reason) VALUES (?, ?, ?, ?)").run(student_id, date, status, reason);
    res.json({ message: `Absensi ${status} berhasil dicatat untuk ${student.name}` });
  });

  // Get attendance for a specific student
  app.get("/api/students/:id/attendance", (req, res) => {
    const { id } = req.params;
    const records = db.prepare("SELECT * FROM attendance WHERE student_id = ? ORDER BY date DESC").all(id);
    res.json(records);
  });

  // Manual attendance update (Admin)
  app.post("/api/attendance/manual", (req, res) => {
    const { student_id, date, status, reason = null } = req.body;
    
    // Upsert logic for manual admin entry
    const existing = db.prepare("SELECT id FROM attendance WHERE student_id = ? AND date = ?").get(student_id, date);
    if (existing) {
      db.prepare("UPDATE attendance SET status = ?, reason = ? WHERE id = ?").run(status, reason, existing.id);
    } else {
      db.prepare("INSERT INTO attendance (student_id, date, status, reason) VALUES (?, ?, ?, ?)").run(student_id, date, status, reason);
    }
    res.json({ message: "Absensi berhasil diperbarui" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

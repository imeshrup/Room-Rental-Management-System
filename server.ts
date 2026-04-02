import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("boarding_house.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_number TEXT UNIQUE,
    floor TEXT,
    type TEXT, -- 'single' or 'sharing'
    capacity INTEGER,
    price REAL,
    status TEXT DEFAULT 'available' -- 'available', 'occupied', 'maintenance'
  );

  CREATE TABLE IF NOT EXISTS boarders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    age INTEGER,
    contact_number TEXT,
    address TEXT,
    workplace TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT
  );

  CREATE TABLE IF NOT EXISTS rentals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER,
    boarder_id INTEGER,
    start_date TEXT,
    end_date TEXT,
    advance_amount REAL,
    advance_months INTEGER DEFAULT 1,
    additional_items TEXT,
    status TEXT DEFAULT 'active', -- 'active', 'completed'
    FOREIGN KEY (room_id) REFERENCES rooms (id),
    FOREIGN KEY (boarder_id) REFERENCES boarders (id)
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rental_id INTEGER,
    amount REAL,
    payment_date TEXT,
    type TEXT, -- 'rent', 'water', 'electricity', 'advance'
    month TEXT, -- 'YYYY-MM'
    FOREIGN KEY (rental_id) REFERENCES rentals (id)
  );

  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    boarder_id INTEGER,
    sent_at TEXT,
    type TEXT, -- 'manual', 'automated'
    message TEXT,
    FOREIGN KEY (boarder_id) REFERENCES boarders (id)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS maintenance_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high'
    status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms (id)
  );
`);

// Migration: Add advance_months if not exists
try {
  db.prepare("ALTER TABLE rentals ADD COLUMN advance_months INTEGER DEFAULT 1").run();
} catch (e) {
  // Column already exists or other error
}

// Seed initial rooms if empty
const roomCount = db.prepare("SELECT COUNT(*) as count FROM rooms").get().count;
if (roomCount === 0) {
  const insertRoom = db.prepare("INSERT INTO rooms (room_number, floor, type, capacity, price) VALUES (?, ?, ?, ?, ?)");
  
  // Ground Floor
  for (let i = 1; i <= 5; i++) insertRoom.run(`G0${i}`, "Ground", i % 2 === 0 ? "sharing" : "single", i % 2 === 0 ? 2 : 1, 5000 + (i * 500));
  // 2nd Floor
  for (let i = 1; i <= 8; i++) insertRoom.run(`20${i}`, "2nd", i % 3 === 0 ? "sharing" : "single", i % 3 === 0 ? 3 : 1, 6000 + (i * 400));
  // 3rd Floor
  for (let i = 1; i <= 6; i++) insertRoom.run(`30${i}`, "3rd", i % 2 === 0 ? "sharing" : "single", i % 2 === 0 ? 2 : 1, 7000 + (i * 300));
}

async function startServer() {
  const logAction = (action: string, entity_type: string, entity_id: number | string | null, details: string) => {
    try {
      db.prepare(`
        INSERT INTO audit_logs (action, entity_type, entity_id, details)
        VALUES (?, ?, ?, ?)
      `).run(action, entity_type, entity_id, details);
    } catch (error) {
      console.error("Failed to log action:", error);
    }
  };

  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // API Routes
  app.get("/api/stats", (req, res) => {
    const totalRooms = db.prepare("SELECT COUNT(*) as count FROM rooms").get().count;
    const occupiedRooms = db.prepare("SELECT COUNT(*) as count FROM rooms WHERE status = 'occupied'").get().count;
    const totalIncome = db.prepare("SELECT SUM(amount) as total FROM payments").get().total || 0;
    const activeBoarders = db.prepare("SELECT COUNT(*) as count FROM boarders").get().count;
    
    res.json({ totalRooms, occupiedRooms, totalIncome, activeBoarders });
  });

  app.get("/api/rooms", (req, res) => {
    const rooms = db.prepare(`
      SELECT r.*, 
      (SELECT COUNT(*) FROM rentals WHERE room_id = r.id AND status = 'active') as current_occupancy
      FROM rooms r
    `).all();
    res.json(rooms);
  });

  app.put("/api/rooms/:id", (req, res) => {
    const { room_number, type, floor, capacity, price, status } = req.body;
    db.prepare(`
      UPDATE rooms 
      SET room_number = ?, type = ?, floor = ?, capacity = ?, price = ?, status = ?
      WHERE id = ?
    `).run(room_number, type, floor, capacity, price, status, req.params.id);
    
    logAction('UPDATE', 'ROOM', req.params.id, `Updated room ${room_number}: Price=${price}, Type=${type}`);
    res.json({ success: true });
  });

  app.get("/api/boarders", (req, res) => {
    const boarders = db.prepare(`
      SELECT b.*, r.room_number, ren.id as rental_id
      FROM boarders b
      LEFT JOIN rentals ren ON b.id = ren.boarder_id AND ren.status = 'active'
      LEFT JOIN rooms r ON ren.room_id = r.id
    `).all();
    res.json(boarders);
  });

  app.post("/api/rentals", (req, res) => {
    const { room_id, boarder_id, start_date, advance_amount, advance_months, additional_items } = req.body;
    const info = db.prepare(`
      INSERT INTO rentals (room_id, boarder_id, start_date, advance_amount, advance_months, additional_items)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(room_id, boarder_id, start_date, advance_amount, advance_months || 1, additional_items);
    
    // Update room status based on capacity
    const room = db.prepare("SELECT capacity FROM rooms WHERE id = ?").get(room_id);
    const occupancy = db.prepare("SELECT COUNT(*) as count FROM rentals WHERE room_id = ? AND status = 'active'").get(room_id).count;
    
    if (occupancy >= room.capacity) {
      db.prepare("UPDATE rooms SET status = 'occupied' WHERE id = ?").run(room_id);
    }
    
    // Record advance payment
    db.prepare(`
      INSERT INTO payments (rental_id, amount, payment_date, type, month)
      VALUES (?, ?, ?, 'advance', ?)
    `).run(info.lastInsertRowid, advance_amount, start_date, start_date.substring(0, 7));

    logAction('CREATE', 'RENTAL', info.lastInsertRowid, `New rental for boarder ${boarder_id} in room ${room_id}`);
    res.json({ id: info.lastInsertRowid });
  });

  app.get("/api/payments", (req, res) => {
    const payments = db.prepare(`
      SELECT p.*, b.name as boarder_name, r.room_number
      FROM payments p
      JOIN rentals ren ON p.rental_id = ren.id
      JOIN boarders b ON ren.boarder_id = b.id
      JOIN rooms r ON ren.room_id = r.id
      ORDER BY p.payment_date DESC
    `).all();
    res.json(payments);
  });

  app.post("/api/payments", (req, res) => {
    const { rental_id, amount, type, month } = req.body;
    const date = new Date().toISOString().split('T')[0];
    const info = db.prepare(`
      INSERT INTO payments (rental_id, amount, payment_date, type, month)
      VALUES (?, ?, ?, ?, ?)
    `).run(rental_id, amount, date, type, month);
    
    logAction('CREATE', 'PAYMENT', info.lastInsertRowid, `Recorded ${type} payment of LKR ${amount} for month ${month}`);
    res.json({ id: info.lastInsertRowid });
  });

  app.delete("/api/payments/:id", (req, res) => {
    const payment = db.prepare("SELECT amount, month FROM payments WHERE id = ?").get(req.params.id);
    db.prepare("DELETE FROM payments WHERE id = ?").run(req.params.id);
    
    if (payment) {
      logAction('DELETE', 'PAYMENT', req.params.id, `Deleted payment of LKR ${payment.amount} for month ${payment.month}`);
    }
    res.json({ success: true });
  });

  app.post("/api/rentals/end/:id", (req, res) => {
    const rental = db.prepare("SELECT room_id FROM rentals WHERE id = ?").get(req.params.id);
    if (rental) {
      db.prepare("UPDATE rentals SET status = 'completed', end_date = ? WHERE id = ?").run(new Date().toISOString(), req.params.id);
      
      // Check if room should be available now
      const room = db.prepare("SELECT capacity FROM rooms WHERE id = ?").get(rental.room_id);
      const occupancy = db.prepare("SELECT COUNT(*) as count FROM rentals WHERE room_id = ? AND status = 'active'").get(rental.room_id).count;
      
      if (occupancy < room.capacity) {
        db.prepare("UPDATE rooms SET status = 'available' WHERE id = ?").run(rental.room_id);
      }
      
      logAction('UPDATE', 'RENTAL', req.params.id, `Ended rental for room ID ${rental.room_id}`);
    }
    res.json({ success: true });
  });

  app.post("/api/boarders", (req, res) => {
    const { name, age, contact_number, emergency_contact_name, emergency_contact_phone } = req.body;
    
    if (!name || name.trim().length < 3 || !/^[A-Za-z\s]+$/.test(name)) {
      return res.status(400).json({ error: "Meaningful name is required (at least 3 characters, letters only)" });
    }
    if (!contact_number || !/^\d{10}$/.test(contact_number)) {
      return res.status(400).json({ error: "Valid 10-digit contact number is required" });
    }
    if (!emergency_contact_name || emergency_contact_name.trim().length < 3) {
      return res.status(400).json({ error: "Emergency contact name is required (at least 3 characters)" });
    }
    if (!emergency_contact_phone || !/^\d{10}$/.test(emergency_contact_phone)) {
      return res.status(400).json({ error: "Valid 10-digit emergency contact phone is required" });
    }

    const { address, workplace } = req.body;
    const info = db.prepare(`
      INSERT INTO boarders (name, age, contact_number, address, workplace, emergency_contact_name, emergency_contact_phone)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, age, contact_number, address, workplace, emergency_contact_name, emergency_contact_phone);
    
    logAction('CREATE', 'BOARDER', info.lastInsertRowid, `Added boarder ${name}`);
    res.json({ id: info.lastInsertRowid });
  });

  app.put("/api/boarders/:id", (req, res) => {
    const { name, age, contact_number, emergency_contact_name, emergency_contact_phone } = req.body;

    if (!name || name.trim().length < 3 || !/^[A-Za-z\s]+$/.test(name)) {
      return res.status(400).json({ error: "Meaningful name is required (at least 3 characters, letters only)" });
    }
    if (!contact_number || !/^\d{10}$/.test(contact_number)) {
      return res.status(400).json({ error: "Valid 10-digit contact number is required" });
    }
    if (!emergency_contact_name || emergency_contact_name.trim().length < 3) {
      return res.status(400).json({ error: "Emergency contact name is required (at least 3 characters)" });
    }
    if (!emergency_contact_phone || !/^\d{10}$/.test(emergency_contact_phone)) {
      return res.status(400).json({ error: "Valid 10-digit emergency contact phone is required" });
    }

    const { address, workplace } = req.body;
    db.prepare(`
      UPDATE boarders 
      SET name = ?, age = ?, contact_number = ?, address = ?, workplace = ?, emergency_contact_name = ?, emergency_contact_phone = ?
      WHERE id = ?
    `).run(name, age, contact_number, address, workplace, emergency_contact_name, emergency_contact_phone, req.params.id);
    
    logAction('UPDATE', 'BOARDER', req.params.id, `Updated details for boarder ${name}`);
    res.json({ success: true });
  });

  app.delete("/api/boarders/:id", (req, res) => {
    const boarder = db.prepare("SELECT name FROM boarders WHERE id = ?").get(req.params.id);
    const activeRental = db.prepare("SELECT id FROM rentals WHERE boarder_id = ? AND status = 'active'").get(req.params.id);
    if (activeRental) return res.status(400).json({ error: "Cannot delete boarder with active rental" });
    
    // Delete associated data first
    db.prepare("DELETE FROM payments WHERE rental_id IN (SELECT id FROM rentals WHERE boarder_id = ?)").run(req.params.id);
    db.prepare("DELETE FROM rentals WHERE boarder_id = ?").run(req.params.id);
    db.prepare("DELETE FROM reminders WHERE boarder_id = ?").run(req.params.id);
    db.prepare("DELETE FROM boarders WHERE id = ?").run(req.params.id);
    
    if (boarder) {
      logAction('DELETE', 'BOARDER', req.params.id, `Removed boarder ${boarder.name} and all associated history`);
    }
    res.json({ success: true });
  });

  app.post("/api/reminders/send", (req, res) => {
    const { boarder_id, message } = req.body;
    const date = new Date().toISOString();
    
    // In a real app, you would integrate with an SMS/Email API here
    console.log(`[REMINDER SENT] To Boarder ID: ${boarder_id}, Message: ${message}`);
    
    db.prepare(`
      INSERT INTO reminders (boarder_id, sent_at, type, message)
      VALUES (?, ?, 'manual', ?)
    `).run(boarder_id, date, message);
    
    res.json({ success: true });
  });

  app.get("/api/reminders", (req, res) => {
    const reminders = db.prepare(`
      SELECT r.*, b.name as boarder_name
      FROM reminders r
      JOIN boarders b ON r.boarder_id = b.id
      ORDER BY r.sent_at DESC
    `).all();
    res.json(reminders);
  });

  app.get("/api/audit-logs", (req, res) => {
    const logs = db.prepare(`
      SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100
    `).all();
    res.json(logs);
  });

  app.get("/api/maintenance", (req, res) => {
    const requests = db.prepare(`
      SELECT m.*, r.room_number 
      FROM maintenance_requests m
      JOIN rooms r ON m.room_id = r.id
      ORDER BY 
        CASE m.status WHEN 'pending' THEN 1 WHEN 'in_progress' THEN 2 ELSE 3 END,
        CASE m.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        m.created_at DESC
    `).all();
    res.json(requests);
  });

  app.post("/api/maintenance", (req, res) => {
    const { room_id, description, priority } = req.body;
    const info = db.prepare(`
      INSERT INTO maintenance_requests (room_id, description, priority)
      VALUES (?, ?, ?)
    `).run(room_id, description, priority || 'medium');
    
    logAction('CREATE', 'MAINTENANCE', info.lastInsertRowid, `New maintenance request for room ID ${room_id}`);
    res.json({ id: info.lastInsertRowid });
  });

  app.put("/api/maintenance/:id", (req, res) => {
    const { status } = req.body;
    db.prepare("UPDATE maintenance_requests SET status = ? WHERE id = ?").run(status, req.params.id);
    
    logAction('UPDATE', 'MAINTENANCE', req.params.id, `Status updated to ${status}`);
    res.json({ success: true });
  });

  app.delete("/api/maintenance/:id", (req, res) => {
    db.prepare("DELETE FROM maintenance_requests WHERE id = ?").run(req.params.id);
    logAction('DELETE', 'MAINTENANCE', req.params.id, `Removed maintenance request`);
    res.json({ success: true });
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

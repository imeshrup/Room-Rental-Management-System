import express from "express";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";
import serverless from "serverless-http";

const { Pool } = pg;

// ESM and CJS compatibility for __dirname and __filename
let __filename: string = '';
let __dirname: string = process.cwd();

// Server-side logs for debugging
let serverLogs: string[] = [];
const log = (msg: string) => {
  const entry = `${new Date().toISOString().split('T')[1].split('.')[0]} - ${msg}`;
  console.log(entry);
  serverLogs.push(entry);
  if (serverLogs.length > 30) serverLogs.shift();
};

const PORT = 3000;

try {
  // Check if we are in an ESM environment
  const metaUrl = typeof import.meta !== 'undefined' ? import.meta.url : undefined;
  
  if (metaUrl) {
    __filename = fileURLToPath(metaUrl);
    __dirname = path.dirname(__filename);
  } else {
    // Fallback to CJS globals if available
    // Note: In some environments, __filename and __dirname are available directly
    if (typeof (global as any).__filename !== 'undefined') {
      __filename = (global as any).__filename;
    }
    if (typeof (global as any).__dirname !== 'undefined') {
      __dirname = (global as any).__dirname;
    }
  }
} catch (e) {
  // Final fallback to process.cwd()
  console.warn("Path resolution fallback to process.cwd()");
}

// PostgreSQL Connection Pool
let pool: any;

async function initializeDatabase() {
  log("Initializing database connection...");
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl || dbUrl === "base") {
    log("ERROR: DATABASE_URL is missing in environment.");
    return;
  }

  log(`Connecting to: ${dbUrl.split('@')[1]?.split(':')[0] || 'unknown host'}`);
  
  let cleanedUrl = dbUrl;
  // Auto-fix: Remove accidental brackets [] around the password if the user copied them from a template
  if (cleanedUrl.includes(":[") && cleanedUrl.includes("]@")) {
    console.log("Auto-fixing DATABASE_URL: Removing accidental brackets around password...");
    cleanedUrl = cleanedUrl.replace(":[", ":").replace("]@", "@");
  }

  try {
    const url = new URL(cleanedUrl);
    console.log(`Database hostname: ${url.hostname}`);
    
    // Auto-detect if SSL should be used (most cloud providers require it)
    const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const isSupabase = url.hostname.includes('supabase');
    const useSSL = !isLocalhost || process.env.NODE_ENV === "production" || isSupabase || url.hostname.includes('elephantsql') || url.hostname.includes('render');
    
    console.log(`Database SSL mode: ${useSSL ? 'Enabled (rejectUnauthorized: false)' : 'Disabled'}`);
    
    // For Supabase, ensure we use the right port if possible, but don't force it
    // Supabase Pooler is typically 6543, direct is 5432
    if (isSupabase && url.port === '5432') {
      console.log("Note: Supabase direct connection (5432) detected. If this fails, try the Pooler connection (6543).");
    }

    pool = new Pool({
      connectionString: cleanedUrl,
      ssl: useSSL ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 30000,
      max: 10
    });
  } catch (e) {
    console.error("DATABASE_URL is not a valid URL format. Using raw string fallback.");
    // Fallback to a simpler pool config if URL parsing fails
    const useSSL = process.env.NODE_ENV === "production" || !cleanedUrl.includes('localhost');
    pool = new Pool({
      connectionString: cleanedUrl,
      ssl: useSSL ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 15000,
    });
  }

  let client;
  try {
    log("Acquiring client from pool...");
    client = await pool.connect();
    log("Connected to PostgreSQL. Running migrations...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id SERIAL PRIMARY KEY,
        room_number TEXT UNIQUE,
        floor TEXT,
        type TEXT,
        capacity INTEGER,
        price NUMERIC,
        status TEXT DEFAULT 'available'
      );

      CREATE TABLE IF NOT EXISTS boarders (
        id SERIAL PRIMARY KEY,
        name TEXT,
        age INTEGER,
        contact_number TEXT,
        address TEXT,
        workplace TEXT,
        emergency_contact_name TEXT,
        emergency_contact_phone TEXT
      );

      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT DEFAULT 'admin',
        boarder_id INTEGER REFERENCES boarders(id) NULL
      );
    `);

    // Force Admin Reset
    log("Ensuring admin user exists with password 'admin123'...");
    await client.query(`
      INSERT INTO users (username, password, role) 
      VALUES ('admin', 'admin123', 'admin')
      ON CONFLICT (username) 
      DO UPDATE SET password = EXCLUDED.password 
      WHERE users.username = 'admin';
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS rentals (
        id SERIAL PRIMARY KEY,
        room_id INTEGER REFERENCES rooms(id),
        boarder_id INTEGER REFERENCES boarders(id),
        start_date TEXT,
        end_date TEXT,
        advance_amount NUMERIC,
        advance_months INTEGER DEFAULT 1,
        additional_items TEXT,
        status TEXT DEFAULT 'active'
      );

      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        rental_id INTEGER REFERENCES rentals(id),
        amount NUMERIC,
        payment_date TEXT,
        type TEXT,
        month TEXT
      );

      CREATE TABLE IF NOT EXISTS reminders (
        id SERIAL PRIMARY KEY,
        boarder_id INTEGER REFERENCES boarders(id),
        sent_at TEXT,
        type TEXT,
        message TEXT
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        details TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS maintenance_requests (
        id SERIAL PRIMARY KEY,
        room_id INTEGER NOT NULL REFERENCES rooms(id),
        description TEXT NOT NULL,
        priority TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    log("Migrations complete.");

    // Seed initial rooms if empty
    const roomCountRes = await client.query("SELECT COUNT(*) as count FROM rooms");
    const roomCount = parseInt(roomCountRes.rows[0].count);
    
    if (roomCount === 0) {
      const insertRoom = "INSERT INTO rooms (room_number, floor, type, capacity, price) VALUES ($1, $2, $3, $4, $5)";
      
      // Ground Floor
      for (let i = 1; i <= 5; i++) {
        await client.query(insertRoom, [`G0${i}`, "Ground", i % 2 === 0 ? "sharing" : "single", i % 2 === 0 ? 2 : 1, 5000 + (i * 500)]);
      }
      // 2nd Floor
      for (let i = 1; i <= 8; i++) {
        await client.query(insertRoom, [`20${i}`, "2nd", i % 3 === 0 ? "sharing" : "single", i % 3 === 0 ? 3 : 1, 6000 + (i * 400)]);
      }
      // 3rd Floor
      for (let i = 1; i <= 6; i++) {
        await client.query(insertRoom, [`30${i}`, "3rd", i % 2 === 0 ? "sharing" : "single", i % 2 === 0 ? 2 : 1, 7000 + (i * 300)]);
      }
      console.log("Database seeded with initial rooms.");
    }
    (global as any).dbStatus = "connected";
    (global as any).dbError = null;
  } catch (err) {
    let msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ENOTFOUND") || msg.includes("ETIMEDOUT") || msg.includes("ECONNREFUSED")) {
      msg += " (DNS/Network error. TIP: Use the Supabase 'Transaction Pooler' connection string on port 6543 for serverless/Netlify.)";
    }
    log(`FATAL DB ERROR: ${msg}`);
    (global as any).dbStatus = "error";
    (global as any).dbError = msg;
    console.error("Database initialization error:", err);
  } finally {
    if (client) client.release();
  }
}

export const app = express();

export async function startServer() {
  if ((global as any).routesRegistered) return;
  (global as any).routesRegistered = true;

  try {
    await initializeDatabase();
    (global as any).serverInitialized = true;
  } catch (err) {
    console.error("Database initialization failed:", err instanceof Error ? err.message : err);
    // Continue starting server so Vite can still serve the frontend, 
    // but API routes will show errors.
  }

  const logAction = async (action: string, entity_type: string, entity_id: number | string | null, details: string) => {
    if (!process.env.DATABASE_URL) return;
    try {
      await pool.query(`
        INSERT INTO audit_logs (action, entity_type, entity_id, details)
        VALUES ($1, $2, $3, $4)
      `, [action, entity_type, entity_id?.toString(), details]);
    } catch (error) {
      console.error("Failed to log action:", error);
    }
  };

  app.use(express.json());
  
  // Lazy initialization for serverless environments
  app.use(async (req, res, next) => {
    if (!(global as any).serverInitialized && process.env.DATABASE_URL) {
      try {
        await initializeDatabase();
        (global as any).serverInitialized = true;
      } catch (err) {
        log(`Lazy init error: ${err}`);
      }
    }
    next();
  });

  // Health check route
  app.get("/api/health", async (req, res) => {
    let dbStatus = "unknown";
    let dbError = null;
    const dbUrl = process.env.DATABASE_URL;
    const hasUrl = !!dbUrl && dbUrl !== "base";
    
    try {
      if (!hasUrl) {
        dbStatus = "missing_config";
        dbError = "DATABASE_URL environment variable is not set in Netlify dashboard.";
      } else if (pool) {
        // Try a very quick query to check connection
        const result = await pool.query("SELECT 1");
        dbStatus = "connected";
      } else {
        dbStatus = "pool_not_initialized";
        dbError = "Database pool failed to initialize. Check server logs.";
      }
    } catch (e) {
      dbStatus = "connection_failed";
      dbError = e instanceof Error ? e.message : String(e);
      console.error("Health check DB error:", e);
      
      // Add more context if it's a common Supabase error
      if (dbError.includes("ECONNREFUSED") || dbError.includes("ETIMEDOUT") || dbError.includes("ENOTFOUND")) {
        dbError += " (Possible DNS or network issue. IMPORTANT: For Netlify/Serverless, you MUST use the Supabase 'Transaction Pooler' connection string on port 6543, NOT the direct connection string on port 5432. Check your Supabase dashboard settings.)";
      }
    }

    res.json({ 
      status: "ok", 
      version: "2.1-DEBUG",
      database: (global as any).dbStatus || "initializing",
      databaseError: (global as any).dbError,
      env: process.env.NODE_ENV || "development",
      netlify: !!process.env.NETLIFY,
      hasConfig: hasUrl,
      hostname: hasUrl ? (dbUrl.includes('@') ? dbUrl.split('@')[1].split(':')[0].split('/')[0] : "unknown") : "none",
      poolInitialized: !!pool,
      serverInitialized: (global as any).serverInitialized || false,
      logs: serverLogs,
      timestamp: new Date().toISOString()
    });
  });

  app.get("/api/debug/users", async (req, res) => {
    if (!pool) return res.status(500).json({ error: "No pool" });
    try {
      const result = await pool.query("SELECT username, role FROM users LIMIT 10");
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Auth Endpoints
  app.post("/api/login", async (req, res) => {
    const { username, password, role } = req.body;
    log(`Login attempt: user=${username}, role=${role}`);
    
    if (!pool) {
      log("ERROR: Pool not initialized during login");
      return res.status(500).json({ error: "Database connection not available" });
    }

    try {
      const userRes = await pool.query(
        "SELECT id, username, role, boarder_id FROM users WHERE username = $1 AND password = $2 AND role = $3", 
        [username, password, role]
      );
      
      if (userRes.rows.length > 0) {
        log(`Login SUCCESS: ${username}`);
        res.json(userRes.rows[0]);
      } else {
        log(`Login FAIL: ${username} (Invalid credentials)`);
        const existsRes = await pool.query("SELECT id FROM users WHERE username = $1", [username]);
        if (existsRes.rows.length === 0) {
          res.status(401).json({ error: `User '${username}' does not exist.` });
        } else {
          res.status(401).json({ error: "Invalid password." });
        }
      }
    } catch (err) {
      log(`Login ERROR: ${err instanceof Error ? err.message : String(err)}`);
      res.status(500).json({ 
        error: "Database error", 
        details: err instanceof Error ? err.message : String(err)
      });
    }
  });

  app.post("/api/users/change-password", async (req, res) => {
    const { userId, currentPassword, newPassword } = req.body;
    try {
      const userRes = await pool.query("SELECT * FROM users WHERE id = $1 AND password = $2", [userId, currentPassword]);
      if (userRes.rows.length === 0) {
        return res.status(401).json({ error: "Current password incorrect" });
      }
      await pool.query("UPDATE users SET password = $1 WHERE id = $2", [newPassword, userId]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // API Routes
  app.get("/api/stats", async (req, res) => {
    try {
      const totalRoomsRes = await pool.query("SELECT COUNT(*) as count FROM rooms");
      const occupiedRoomsRes = await pool.query("SELECT COUNT(*) as count FROM rooms WHERE status = 'occupied'");
      const totalIncomeRes = await pool.query("SELECT SUM(amount) as total FROM payments");
      const activeBoardersRes = await pool.query("SELECT COUNT(*) as count FROM boarders");
      
      res.json({ 
        totalRooms: parseInt(totalRoomsRes.rows[0].count), 
        occupiedRooms: parseInt(occupiedRoomsRes.rows[0].count), 
        totalIncome: parseFloat(totalIncomeRes.rows[0].total || '0'), 
        activeBoarders: parseInt(activeBoardersRes.rows[0].count) 
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.get("/api/rooms", async (req, res) => {
    try {
      const roomsRes = await pool.query(`
        SELECT r.*, 
        (SELECT COUNT(*) FROM rentals WHERE room_id = r.id AND status = 'active') as current_occupancy
        FROM rooms r
      `);
      res.json(roomsRes.rows);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch rooms" });
    }
  });

  app.put("/api/rooms/:id", async (req, res) => {
    try {
      const { room_number, type, floor, capacity, price, status } = req.body;
      await pool.query(`
        UPDATE rooms 
        SET room_number = $1, type = $2, floor = $3, capacity = $4, price = $5, status = $6
        WHERE id = $7
      `, [room_number, type, floor, capacity, price, status, req.params.id]);
      
      await logAction('UPDATE', 'ROOM', req.params.id, `Updated room ${room_number}: Price=${price}, Type=${type}`);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update room" });
    }
  });

  app.get("/api/boarders", async (req, res) => {
    try {
      const boardersRes = await pool.query(`
        SELECT b.*, r.room_number, ren.id as rental_id
        FROM boarders b
        LEFT JOIN rentals ren ON b.id = ren.boarder_id AND ren.status = 'active'
        LEFT JOIN rooms r ON ren.room_id = r.id
      `);
      res.json(boardersRes.rows);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch boarders" });
    }
  });

  app.post("/api/rentals", async (req, res) => {
    try {
      const { room_id, boarder_id, start_date, advance_amount, advance_months, additional_items } = req.body;
      const rentalRes = await pool.query(`
        INSERT INTO rentals (room_id, boarder_id, start_date, advance_amount, advance_months, additional_items)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [room_id, boarder_id, start_date, advance_amount, advance_months || 1, additional_items]);
      
      const rentalId = rentalRes.rows[0].id;

      // Update room status based on capacity
      const roomRes = await pool.query("SELECT capacity FROM rooms WHERE id = $1", [room_id]);
      const room = roomRes.rows[0];
      const occupancyRes = await pool.query("SELECT COUNT(*) as count FROM rentals WHERE room_id = $1 AND status = 'active'", [room_id]);
      const occupancy = parseInt(occupancyRes.rows[0].count);
      
      if (occupancy >= room.capacity) {
        await pool.query("UPDATE rooms SET status = 'occupied' WHERE id = $1", [room_id]);
      }
      
      // Record advance payment
      await pool.query(`
        INSERT INTO payments (rental_id, amount, payment_date, type, month)
        VALUES ($1, $2, $3, 'advance', $4)
      `, [rentalId, advance_amount, start_date, start_date.substring(0, 7)]);

      await logAction('CREATE', 'RENTAL', rentalId, `New rental for boarder ${boarder_id} in room ${room_id}`);
      res.json({ id: rentalId });
    } catch (err) {
      res.status(500).json({ error: "Failed to create rental" });
    }
  });

  app.get("/api/payments", async (req, res) => {
    try {
      const paymentsRes = await pool.query(`
        SELECT p.*, b.name as boarder_name, r.room_number
        FROM payments p
        JOIN rentals ren ON p.rental_id = ren.id
        JOIN boarders b ON ren.boarder_id = b.id
        JOIN rooms r ON ren.room_id = r.id
        ORDER BY p.payment_date DESC
      `);
      res.json(paymentsRes.rows);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  });

  app.post("/api/payments", async (req, res) => {
    try {
      const { rental_id, amount, type, month } = req.body;
      const date = new Date().toISOString().split('T')[0];
      const paymentRes = await pool.query(`
        INSERT INTO payments (rental_id, amount, payment_date, type, month)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [rental_id, amount, date, type, month]);
      
      const paymentId = paymentRes.rows[0].id;
      await logAction('CREATE', 'PAYMENT', paymentId, `Recorded ${type} payment of LKR ${amount} for month ${month}`);
      res.json({ id: paymentId });
    } catch (err) {
      res.status(500).json({ error: "Failed to record payment" });
    }
  });

  app.delete("/api/payments/:id", async (req, res) => {
    try {
      const paymentRes = await pool.query("SELECT amount, month FROM payments WHERE id = $1", [req.params.id]);
      const payment = paymentRes.rows[0];
      
      await pool.query("DELETE FROM payments WHERE id = $1", [req.params.id]);
      
      if (payment) {
        await logAction('DELETE', 'PAYMENT', req.params.id, `Deleted payment of LKR ${payment.amount} for month ${payment.month}`);
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete payment" });
    }
  });

  app.post("/api/rentals/end/:id", async (req, res) => {
    try {
      const rentalRes = await pool.query("SELECT room_id FROM rentals WHERE id = $1", [req.params.id]);
      const rental = rentalRes.rows[0];
      if (rental) {
        await pool.query("UPDATE rentals SET status = 'completed', end_date = $1 WHERE id = $2", [new Date().toISOString(), req.params.id]);
        
        // Check if room should be available now
        const roomRes = await pool.query("SELECT capacity FROM rooms WHERE id = $1", [rental.room_id]);
        const room = roomRes.rows[0];
        const occupancyRes = await pool.query("SELECT COUNT(*) as count FROM rentals WHERE room_id = $1 AND status = 'active'", [rental.room_id]);
        const occupancy = parseInt(occupancyRes.rows[0].count);
        
        if (occupancy < room.capacity) {
          await pool.query("UPDATE rooms SET status = 'available' WHERE id = $1", [rental.room_id]);
        }
        
        await logAction('UPDATE', 'RENTAL', req.params.id, `Ended rental for room ID ${rental.room_id}`);
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to end rental" });
    }
  });

  app.post("/api/boarders", async (req, res) => {
    try {
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
      const boarderRes = await pool.query(`
        INSERT INTO boarders (name, age, contact_number, address, workplace, emergency_contact_name, emergency_contact_phone)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [name, age, contact_number, address, workplace, emergency_contact_name, emergency_contact_phone]);
      
      const boarderId = boarderRes.rows[0].id;

      // Automatically create a user account for the boarder
      // Username: name (lowercase, no spaces)
      // Password: contact_number
      const username = name.toLowerCase().replace(/\s+/g, '');
      await pool.query(`
        INSERT INTO users (username, password, role, boarder_id)
        VALUES ($1, $2, 'boarder', $3)
        ON CONFLICT (username) DO NOTHING
      `, [username, contact_number, boarderId]);

      await logAction('CREATE', 'BOARDER', boarderId, `Added boarder ${name}`);
      res.json({ id: boarderId });
    } catch (err) {
      res.status(500).json({ error: "Failed to add boarder" });
    }
  });

  // User Management Endpoints
  app.get("/api/users", async (req, res) => {
    try {
      const usersRes = await pool.query(`
        SELECT u.id, u.username, u.role, u.boarder_id, b.name as boarder_name
        FROM users u
        LEFT JOIN boarders b ON u.boarder_id = b.id
        ORDER BY u.role, u.username
      `);
      res.json(usersRes.rows);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/users", async (req, res) => {
    const { username, password, role } = req.body;
    try {
      await pool.query(
        "INSERT INTO users (username, password, role) VALUES ($1, $2, $3)",
        [username, password, role]
      );
      await logAction('CREATE', 'USER', username, `Created new ${role} user: ${username}`);
      res.json({ success: true });
    } catch (err) {
      if (err instanceof Error && err.message.includes('unique constraint')) {
        return res.status(400).json({ error: "Username already exists" });
      }
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    try {
      const userRes = await pool.query("SELECT username FROM users WHERE id = $1", [req.params.id]);
      if (userRes.rows.length === 0) return res.status(404).json({ error: "User not found" });
      
      const username = userRes.rows[0].username;
      if (username === 'admin') return res.status(403).json({ error: "Cannot delete default admin" });

      await pool.query("DELETE FROM users WHERE id = $1", [req.params.id]);
      await logAction('DELETE', 'USER', req.params.id, `Deleted user: ${username}`);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  app.put("/api/boarders/:id", async (req, res) => {
    try {
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
      await pool.query(`
        UPDATE boarders 
        SET name = $1, age = $2, contact_number = $3, address = $4, workplace = $5, emergency_contact_name = $6, emergency_contact_phone = $7
        WHERE id = $8
      `, [name, age, contact_number, address, workplace, emergency_contact_name, emergency_contact_phone, req.params.id]);
      
      await logAction('UPDATE', 'BOARDER', req.params.id, `Updated details for boarder ${name}`);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update boarder" });
    }
  });

  app.delete("/api/boarders/:id", async (req, res) => {
    try {
      const boarderRes = await pool.query("SELECT name FROM boarders WHERE id = $1", [req.params.id]);
      const boarder = boarderRes.rows[0];
      const activeRentalRes = await pool.query("SELECT id FROM rentals WHERE boarder_id = $1 AND status = 'active'", [req.params.id]);
      const activeRental = activeRentalRes.rows[0];
      
      if (activeRental) return res.status(400).json({ error: "Cannot delete boarder with active rental" });
      
      // Delete associated data first
      await pool.query("DELETE FROM payments WHERE rental_id IN (SELECT id FROM rentals WHERE boarder_id = $1)", [req.params.id]);
      await pool.query("DELETE FROM rentals WHERE boarder_id = $1", [req.params.id]);
      await pool.query("DELETE FROM reminders WHERE boarder_id = $1", [req.params.id]);
      await pool.query("DELETE FROM boarders WHERE id = $1", [req.params.id]);
      
      if (boarder) {
        await logAction('DELETE', 'BOARDER', req.params.id, `Removed boarder ${boarder.name} and all associated history`);
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete boarder" });
    }
  });

  app.post("/api/reminders/send", async (req, res) => {
    try {
      const { boarder_id, message } = req.body;
      const date = new Date().toISOString();
      
      // In a real app, you would integrate with an SMS/Email API here
      console.log(`[REMINDER SENT] To Boarder ID: ${boarder_id}, Message: ${message}`);
      
      await pool.query(`
        INSERT INTO reminders (boarder_id, sent_at, type, message)
        VALUES ($1, $2, 'manual', $3)
      `, [boarder_id, date, message]);
      
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to send reminder" });
    }
  });

  app.get("/api/reminders", async (req, res) => {
    try {
      const remindersRes = await pool.query(`
        SELECT r.*, b.name as boarder_name
        FROM reminders r
        JOIN boarders b ON r.boarder_id = b.id
        ORDER BY r.sent_at DESC
      `);
      res.json(remindersRes.rows);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch reminders" });
    }
  });

  app.get("/api/audit-logs", async (req, res) => {
    try {
      const logsRes = await pool.query(`
        SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100
      `);
      res.json(logsRes.rows);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  app.get("/api/maintenance", async (req, res) => {
    try {
      const requestsRes = await pool.query(`
        SELECT m.*, r.room_number 
        FROM maintenance_requests m
        JOIN rooms r ON m.room_id = r.id
        ORDER BY 
          CASE m.status WHEN 'pending' THEN 1 WHEN 'in_progress' THEN 2 ELSE 3 END,
          CASE m.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
          m.created_at DESC
      `);
      res.json(requestsRes.rows);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch maintenance requests" });
    }
  });

  app.post("/api/maintenance", async (req, res) => {
    try {
      const { room_id, description, priority } = req.body;
      const maintenanceRes = await pool.query(`
        INSERT INTO maintenance_requests (room_id, description, priority)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [room_id, description, priority || 'medium']);
      
      const maintenanceId = maintenanceRes.rows[0].id;
      await logAction('CREATE', 'MAINTENANCE', maintenanceId, `New maintenance request for room ID ${room_id}`);
      res.json({ id: maintenanceId });
    } catch (err) {
      res.status(500).json({ error: "Failed to create maintenance request" });
    }
  });

  app.put("/api/maintenance/:id", async (req, res) => {
    try {
      const { status } = req.body;
      await pool.query("UPDATE maintenance_requests SET status = $1 WHERE id = $2", [status, req.params.id]);
      
      await logAction('UPDATE', 'MAINTENANCE', req.params.id, `Status updated to ${status}`);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update maintenance request" });
    }
  });

  app.delete("/api/maintenance/:id", async (req, res) => {
    try {
      await pool.query("DELETE FROM maintenance_requests WHERE id = $1", [req.params.id]);
      await logAction('DELETE', 'MAINTENANCE', req.params.id, `Removed maintenance request`);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete maintenance request" });
    }
  });

  // Vite middleware for development - strictly disabled on Netlify
  if (process.env.NODE_ENV !== "production" && !process.env.NETLIFY) {
    try {
      // Use a dynamic string to prevent bundlers from following this import in production
      const vitePkg = "vite";
      const { createServer: createViteServer } = await import(vitePkg);
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("Vite development middleware loaded.");
    } catch (e) {
      console.warn("Vite not found or failed to load, skipping dev middleware.");
    }
  }
  
  if (process.env.NODE_ENV === "production" && !process.env.NETLIFY) {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }
}

// Export handler for Netlify
const handler = serverless(app);
export { handler };

if (!process.env.NETLIFY && !process.env.LAMBDA_TASK_ROOT) {
  startServer().then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
}

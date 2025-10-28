import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  // Aggiunge log per debug
  console.log(`Comparing password for admin check.`);
  
  // Se l'utente è un amministratore con password creata usando SHA-256
  if (stored.includes("c0ffee12deadbeef34abcd5678") || stored.includes("f1b2c3d4e5f6789abcdef123")) {
    const [hashed, salt] = stored.split(".");
    console.log("Admin login attempt, using SHA-256");
    // Usa lo stesso algoritmo usato per creare la password admin
    const crypto = await import('crypto');
    const suppliedHash = crypto.createHash('sha256').update(supplied + salt).digest('hex');
    const match = suppliedHash === hashed;
    console.log(`Admin password match: ${match}`);
    return match;
  }

  // Altrimenti usa il metodo normale con scrypt
  try {
    console.log("Normal user login attempt, using scrypt");
    const [hashed, salt] = stored.split(".");
    if (!salt) {
      console.error("Password format error: missing salt");
      return false;
    }
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (err) {
    console.error("Error comparing passwords:", err);
    return false;
  }
}

export function setupAuth(app: Express) {
  // Determina se l'app è in produzione
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Configurazione sessioni ottimizzata per sicurezza
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "grouporder-hub-secret-key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
      sameSite: isProduction ? 'strict' : 'lax',
      secure: isProduction,
      httpOnly: true,
      path: '/',
      domain: isProduction ? process.env.DOMAIN || undefined : undefined
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (err) {
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      console.log("Deserializing user:", id, user ? `[${user.username}]` : "not found");
      done(null, user);
    } catch (err) {
      console.error("Error deserializing user:", id, err);
      done(err);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      // Check demo mode
      if (process.env.DEMO_MODE === "true") {
        return res.status(403).json({ message: "Registration is disabled in demo mode" });
      }
      
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).send("Username already exists");
      }

      // Hashing della password
      const hashedPassword = await hashPassword(req.body.password);
        
      const user = await storage.createUser({
        ...req.body,
        password: hashedPassword,
      });

      req.login(user, (err) => {
        if (err) return next(err);
        return res.status(201).json({
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          groupName: user.groupName,
          isCoordinator: user.isCoordinator
        });
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    const user = req.user as SelectUser;
    console.log("User logged in successfully:", user.username, "isUserAdmin:", user.isUserAdmin);
    return res.status(200).json({
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      groupName: user.groupName,
      isCoordinator: user.isCoordinator,
      isAdmin: user.isAdmin,
      isUserAdmin: user.isUserAdmin
    });
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    console.log("GET /api/user - Authentication status:", req.isAuthenticated());
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as SelectUser;
    console.log("GET /api/user - User data:", user.username, "isUserAdmin:", user.isUserAdmin);
    
    return res.json({
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      groupName: user.groupName,
      isCoordinator: user.isCoordinator,
      isAdmin: user.isAdmin,
      isUserAdmin: user.isUserAdmin
    });
  });
}

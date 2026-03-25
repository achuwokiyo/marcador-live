import type { Express, RequestHandler } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { storage } from "./storage";
import { db } from "./db";
import { users, registerUserSchema, loginSchema, type PublicUser } from "@shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const smtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const smtpTransport = smtpConfigured ? nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
}) : null;

if (!smtpConfigured) {
  console.warn("[EMAIL] SMTP no configurado - los códigos de recuperación se mostrarán solo en consola");
}

async function sendRecoveryEmail(to: string, code: string, username: string): Promise<boolean> {
  if (!smtpTransport) return false;
  try {
    await smtpTransport.sendMail({
      from: `"MarcadorLIVE" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
      to,
      subject: "Código de recuperación - MarcadorLIVE",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #16a34a; margin-bottom: 8px;">MarcadorLIVE</h2>
          <p>Hola <strong>${username}</strong>,</p>
          <p>Has solicitado recuperar tu contraseña. Tu código de verificación es:</p>
          <div style="background: #f0fdf4; border: 2px solid #16a34a; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #16a34a;">${code}</span>
          </div>
          <p style="color: #666; font-size: 14px;">Este código expira en <strong>15 minutos</strong>.</p>
          <p style="color: #666; font-size: 14px;">Si no solicitaste este código, ignora este mensaje.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">MarcadorLIVE - Marcadores en vivo para fútbol base</p>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.error("[EMAIL] Error enviando correo de recuperación:", err);
    return false;
  }
}

const JWT_SECRET = process.env.SESSION_SECRET!;
const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = "30d";
const RENEWAL_THRESHOLD = 7 * 24 * 60 * 60;

function generateToken(userId: number, username: string): string {
  return jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

function toPublicUser(user: any): PublicUser {
  const { password, recoveryCode, recoveryCodeExpiresAt, ...publicUser } = user;
  return publicUser;
}

export const isLocalAuthenticated: RequestHandler = (req: any, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No autorizado" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; username: string; exp?: number };
    req.localUser = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Token inválido o expirado" });
  }
};

export const optionalLocalAuth: RequestHandler = (req: any, _res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; username: string };
      req.localUser = decoded;
    } catch {
    }
  }
  next();
};

async function seedSuperAdmin() {
  try {
    let admin = await storage.getUserByUsername("achuwoky");
    if (!admin) {
      const hashedPassword = await bcrypt.hash("soriano4ever_M", SALT_ROUNDS);
      await storage.createUser({
        username: "achuwoky",
        password: hashedPassword,
        recoveryEmail: "miguelangel.perezona@gmail.com",
        recoveryPhone: null,
      });
      admin = await storage.getUserByUsername("achuwoky");
      if (admin) {
        await db.update(users).set({ role: "superadmin" }).where(eq(users.id, admin.id));
        console.log("[SEED] Superadmin achuwoky creado correctamente");
      }
    }

    if (admin) {
      if (!admin.recoveryEmail) {
        await storage.updateUserRecovery(admin.id, { recoveryEmail: "miguelangel.perezona@gmail.com" });
      }

      const replitAuthId = "53581565";
      const localAuthId = `local_${admin.id}`;
      const { matches, teams } = await import("@shared/schema");

      await db.update(matches)
        .set({ userId: admin.id, authUserId: localAuthId })
        .where(eq(matches.authUserId, replitAuthId));
      console.log("[SEED] Partidos migrados a achuwoky");

      await db.update(teams)
        .set({ authUserId: localAuthId })
        .where(eq(teams.authUserId, replitAuthId));
      console.log("[SEED] Equipos migrados a achuwoky");
    }
  } catch (err) {
    console.error("[SEED] Error creando superadmin:", err);
  }
}

export function registerLocalAuthRoutes(app: Express): void {
  seedSuperAdmin();
  app.get("/api/auth/username-available", async (req, res) => {
    const username = req.query.username as string;
    if (!username || username.length < 3) {
      return res.json({ available: false, reason: "Mínimo 3 caracteres" });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.json({ available: false, reason: "Solo letras, números y guion bajo" });
    }
    const existing = await storage.getUserByUsername(username);
    res.json({ available: !existing, reason: existing ? "Este nombre ya está en uso" : null });
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = registerUserSchema.parse(req.body);

      const existing = await storage.getUserByUsername(data.username);
      if (existing) {
        return res.status(400).json({ message: "Este nombre de usuario ya está en uso" });
      }

      const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);
      const user = await storage.createUser({
        username: data.username,
        password: hashedPassword,
        recoveryEmail: data.recoveryEmail || null,
        recoveryPhone: data.recoveryPhone || null,
      });

      const token = generateToken(user.id, user.username);
      res.status(201).json({ token, user: toPublicUser(user) });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Registration error:", err);
      res.status(500).json({ message: "Error al registrar usuario" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);

      const user = await storage.getUserByUsername(data.username);
      if (!user) {
        return res.status(401).json({ message: "Usuario o contraseña incorrectos" });
      }

      const valid = await bcrypt.compare(data.password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Usuario o contraseña incorrectos" });
      }

      const token = generateToken(user.id, user.username);
      let clubSlug: string | null = null;
      if (user.role === "coordinator") {
        const clubs = await storage.getClubsByCoordinator(user.id);
        if (clubs.length > 0) clubSlug = clubs[0].slug;
      }
      res.json({ token, user: toPublicUser(user), clubSlug });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Login error:", err);
      res.status(500).json({ message: "Error al iniciar sesión" });
    }
  });

  app.get("/api/auth/me", isLocalAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.localUser.userId);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      const response: any = { ...toPublicUser(user) };
      const exp = req.localUser.exp;
      if (exp) {
        const timeLeft = exp - Math.floor(Date.now() / 1000);
        if (timeLeft < RENEWAL_THRESHOLD) {
          response.renewedToken = generateToken(user.id, user.username);
        }
      }
      res.json(response);
    } catch (err) {
      console.error("Get user error:", err);
      res.status(500).json({ message: "Error al obtener usuario" });
    }
  });

  app.post("/api/auth/change-password", isLocalAuthenticated, async (req: any, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "Contraseña nueva debe tener al menos 6 caracteres" });
      }

      const user = await storage.getUser(req.localUser.userId);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Contraseña actual incorrecta" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
      await storage.updateUserPassword(user.id, hashedPassword);
      res.json({ message: "Contraseña actualizada correctamente" });
    } catch (err) {
      console.error("Change password error:", err);
      res.status(500).json({ message: "Error al cambiar contraseña" });
    }
  });

  app.post("/api/auth/update-recovery", isLocalAuthenticated, async (req: any, res) => {
    try {
      const { recoveryEmail, recoveryPhone } = req.body;
      await storage.updateUserRecovery(req.localUser.userId, {
        recoveryEmail: recoveryEmail || null,
        recoveryPhone: recoveryPhone || null,
      });
      res.json({ message: "Datos de recuperación actualizados" });
    } catch (err) {
      console.error("Update recovery error:", err);
      res.status(500).json({ message: "Error al actualizar datos de recuperación" });
    }
  });

  app.post("/api/auth/recovery/request", async (req, res) => {
    try {
      const { contact, type } = req.body;
      if (!contact || !type || !["email", "phone"].includes(type)) {
        return res.status(400).json({ message: "Datos de recuperación inválidos" });
      }

      const user = await storage.getUserByRecoveryContact(contact);
      if (!user) {
        return res.json({ sent: true });
      }

      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      const hashedCode = await bcrypt.hash(code, SALT_ROUNDS);
      await storage.setRecoveryCode(user.id, hashedCode, expiresAt);

      if (type === "email" && user.recoveryEmail) {
        const sent = await sendRecoveryEmail(user.recoveryEmail, code, user.username);
        if (!sent) {
          console.log(`[RECOVERY] Fallback - Código para ${user.username}: ${code}`);
        }
      } else {
        console.log(`[RECOVERY] Código de recuperación para ${user.username}: ${code}`);
      }

      res.json({ sent: true });
    } catch (err) {
      console.error("Recovery request error:", err);
      res.status(500).json({ message: "Error al procesar solicitud" });
    }
  });

  app.post("/api/auth/recovery/verify", async (req, res) => {
    try {
      const { contact, code } = req.body;
      if (!contact || !code) {
        return res.status(400).json({ message: "Datos incompletos" });
      }

      const user = await storage.getUserByRecoveryContact(contact);
      if (!user || !user.recoveryCode || !user.recoveryCodeExpiresAt) {
        return res.status(400).json({ message: "Código inválido o expirado" });
      }

      if (new Date() > user.recoveryCodeExpiresAt) {
        await storage.clearRecoveryCode(user.id);
        return res.status(400).json({ message: "Código expirado" });
      }

      const valid = await bcrypt.compare(code, user.recoveryCode);
      if (!valid) {
        return res.status(400).json({ message: "Código incorrecto" });
      }

      const resetToken = jwt.sign({ userId: user.id, purpose: "reset" }, JWT_SECRET, { expiresIn: "15m" });
      res.json({ valid: true, resetToken });
    } catch (err) {
      console.error("Recovery verify error:", err);
      res.status(500).json({ message: "Error al verificar código" });
    }
  });

  app.post("/api/auth/recovery/reset", async (req, res) => {
    try {
      const { resetToken, newPassword } = req.body;
      if (!resetToken || !newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "Contraseña nueva debe tener al menos 6 caracteres" });
      }

      let decoded: any;
      try {
        decoded = jwt.verify(resetToken, JWT_SECRET);
      } catch {
        return res.status(400).json({ message: "Token de recuperación inválido o expirado" });
      }

      if (decoded.purpose !== "reset") {
        return res.status(400).json({ message: "Token inválido" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
      await storage.updateUserPassword(decoded.userId, hashedPassword);
      await storage.clearRecoveryCode(decoded.userId);

      res.json({ message: "Contraseña restablecida correctamente" });
    } catch (err) {
      console.error("Recovery reset error:", err);
      res.status(500).json({ message: "Error al restablecer contraseña" });
    }
  });
}

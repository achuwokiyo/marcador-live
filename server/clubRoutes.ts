import type { Express } from "express";
import { storage } from "./storage";
import { z } from "zod";
import { insertClubSchema, insertClubTeamSchema, insertClubDelegateSchema, insertClubPlayerSchema, insertClubMatchdaySchema, insertClubSponsorSchema, insertClubBranchSchema, MATCH_STATUS } from "@shared/schema";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Anthropic from "@anthropic-ai/sdk";

const JWT_SECRET = process.env.SESSION_SECRET!;

function generateUniquePin(existingPins: string[]): string {
  let pin: string;
  do {
    pin = Math.floor(1000 + Math.random() * 9000).toString();
  } while (existingPins.includes(pin));
  return pin;
}

export function registerClubRoutes(app: Express) {

  // ============ SUPERADMIN CLUB MANAGEMENT ============

  const isSuperAdmin = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const decoded = jwt.verify(authHeader.split(" ")[1], JWT_SECRET) as any;
        const user = await storage.getUser(decoded.userId);
        if (user && user.role === "superadmin") {
          req.localUser = decoded;
          return next();
        }
      } catch {}
    }
    if (req.isAuthenticated?.() && req.user?.claims?.sub) {
      return next();
    }
    return res.status(403).json({ message: "No autorizado" });
  };

  const isCoordinator = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No autorizado" });
    }
    try {
      const decoded = jwt.verify(authHeader.split(" ")[1], JWT_SECRET) as any;
      const user = await storage.getUser(decoded.userId);
      if (!user) return res.status(401).json({ message: "Usuario no encontrado" });
      if (user.role !== "coordinator" && user.role !== "superadmin") {
        return res.status(403).json({ message: "No autorizado" });
      }
      req.localUser = decoded;
      req.coordinatorUser = user;
      return next();
    } catch {
      return res.status(401).json({ message: "Token inválido" });
    }
  };

  // Get all clubs (superadmin)
  app.get("/api/admin/clubs", isSuperAdmin, async (req: any, res) => {
    const allClubs = await storage.getAllClubs();
    const enriched = await Promise.all(allClubs.map(async (club) => {
      const coordinator = club.coordinatorUserId ? await storage.getUser(club.coordinatorUserId) : null;
      const teamsCount = (await storage.getClubTeams(club.id)).length;
      const delegatesCount = (await storage.getClubDelegates(club.id)).length;
      return {
        ...club,
        coordinatorUsername: coordinator?.username || null,
        teamsCount,
        delegatesCount,
      };
    }));
    res.json(enriched);
  });

  // Create club (superadmin)
  app.post("/api/admin/clubs", isSuperAdmin, async (req: any, res) => {
    try {
      const input = insertClubSchema.parse(req.body);
      const existing = await storage.getClubBySlug(input.slug);
      if (existing) return res.status(400).json({ message: "Ya existe un club con ese slug" });
      const club = await storage.createClub(input);
      res.status(201).json(club);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  // Update club (superadmin)
  app.patch("/api/admin/clubs/:id", isSuperAdmin, async (req: any, res) => {
    const clubId = Number(req.params.id);
    const club = await storage.getClub(clubId);
    if (!club) return res.status(404).json({ message: "Club no encontrado" });
    const updated = await storage.updateClub(clubId, req.body);
    res.json(updated);
  });

  // Delete club (superadmin)
  app.delete("/api/admin/clubs/:id", isSuperAdmin, async (req: any, res) => {
    const clubId = Number(req.params.id);
    await storage.deleteClub(clubId);
    res.json({ success: true });
  });

  // Assign coordinator to club (superadmin)
  app.post("/api/admin/clubs/:id/coordinator", isSuperAdmin, async (req: any, res) => {
    const clubId = Number(req.params.id);
    const { userId, username, password } = req.body;

    const club = await storage.getClub(clubId);
    if (!club) return res.status(404).json({ message: "Club no encontrado" });

    if (userId) {
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });
      await storage.updateUserRole(userId, "coordinator");
      await storage.updateClub(clubId, { coordinatorUserId: userId });
      res.json({ success: true, coordinatorId: userId });
    } else if (username && password) {
      const existing = await storage.getUserByUsername(username);
      if (existing) return res.status(400).json({ message: "El usuario ya existe" });
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await storage.createUser({
        username,
        password: hashedPassword,
        role: "coordinator",
      });
      await storage.updateClub(clubId, { coordinatorUserId: newUser.id });
      res.json({ success: true, coordinatorId: newUser.id });
    } else {
      return res.status(400).json({ message: "Proporciona userId o username+password" });
    }
  });

  // Get all local users (superadmin - for coordinator assignment)
  app.get("/api/admin/local-users", isSuperAdmin, async (req: any, res) => {
    const localUsers = await storage.getAllLocalUsers();
    res.json(localUsers.map(u => ({
      id: u.id,
      username: u.username,
      role: u.role,
      createdAt: u.createdAt,
    })));
  });

  // ============ COORDINATOR CLUB ROUTES ============

  // Get coordinator's club
  app.get("/api/club/mine", isCoordinator, async (req: any, res) => {
    const userId = req.localUser.userId;
    const myClubs = await storage.getClubsByCoordinator(userId);
    if (myClubs.length === 0) return res.status(404).json({ message: "No tienes ningún club asignado" });
    res.json(myClubs[0]);
  });

  // Get club data by slug (coordinator must own it, or superadmin)
  app.get("/api/club/:slug/admin-data", isCoordinator, async (req: any, res) => {
    const club = await storage.getClubBySlug(req.params.slug);
    if (!club) return res.status(404).json({ message: "Club no encontrado" });
    const user = req.coordinatorUser;
    if (user.role !== "superadmin" && club.coordinatorUserId !== req.localUser.userId) {
      return res.status(403).json({ message: "No tienes acceso a este club" });
    }
    const clubTeamsList = await storage.getClubTeams(club.id);
    const delegates = await storage.getClubDelegates(club.id);
    const branches = await storage.getClubBranches(club.id);
    const sponsors = await storage.getClubSponsors(club.id);
    const matchdaysRaw = await storage.getClubMatchdaysByClub(club.id);
    const matchdays = await Promise.all(matchdaysRaw.map(async (md) => {
      if (md.matchId) {
        const match = await storage.getMatch(md.matchId);
        return { ...md, matchStatus: match?.status || null };
      }
      return { ...md, matchStatus: null };
    }));
    res.json({ club, teams: clubTeamsList, delegates, branches, sponsors, matchdays });
  });

  // ============ CLUB TEAMS (Coordinator) ============

  app.get("/api/club/:clubId/teams", isCoordinator, async (req: any, res) => {
    const clubId = Number(req.params.clubId);
    const clubTeamsList = await storage.getClubTeams(clubId);
    res.json(clubTeamsList);
  });

  app.post("/api/club/:clubId/teams", isCoordinator, async (req: any, res) => {
    try {
      const clubId = Number(req.params.clubId);
      const input = insertClubTeamSchema.parse(req.body);
      const team = await storage.createClubTeam(clubId, input);
      if (req.body.delegateId) {
        await storage.updateClubTeam(team.id, { delegateId: Number(req.body.delegateId) });
      }
      if (req.body.sponsorId) {
        await storage.updateClubTeam(team.id, { sponsorId: Number(req.body.sponsorId) });
      }
      const updated = await storage.getClubTeam(team.id);
      res.status(201).json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.patch("/api/club/teams/:id", isCoordinator, async (req: any, res) => {
    const teamId = Number(req.params.id);
    const updated = await storage.updateClubTeam(teamId, req.body);
    res.json(updated);
  });

  app.delete("/api/club/teams/:id", isCoordinator, async (req: any, res) => {
    await storage.deleteClubTeam(Number(req.params.id));
    res.json({ success: true });
  });

  // ============ CLUB DELEGATES (Coordinator) ============

  app.get("/api/club/:clubId/delegates", isCoordinator, async (req: any, res) => {
    const delegates = await storage.getClubDelegates(Number(req.params.clubId));
    res.json(delegates);
  });

  app.post("/api/club/:clubId/delegates", isCoordinator, async (req: any, res) => {
    try {
      const clubId = Number(req.params.clubId);
      const input = insertClubDelegateSchema.parse(req.body);
      const existingDelegates = await storage.getClubDelegates(clubId);
      const existingPins = existingDelegates.map(d => d.pin);
      const pin = generateUniquePin(existingPins);
      const delegate = await storage.createClubDelegate({ ...input, clubId, pin });
      res.status(201).json(delegate);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.patch("/api/club/delegates/:id", isCoordinator, async (req: any, res) => {
    const delegateId = Number(req.params.id);
    if (req.body.pin) {
      const delegate = await storage.getClubDelegate(delegateId);
      if (delegate) {
        const existingDelegates = await storage.getClubDelegates(delegate.clubId);
        const conflict = existingDelegates.find(d => d.pin === req.body.pin && d.id !== delegateId);
        if (conflict) return res.status(400).json({ message: "Ese PIN ya está en uso" });
      }
    }
    const updated = await storage.updateClubDelegate(delegateId, req.body);
    res.json(updated);
  });

  app.delete("/api/club/delegates/:id", isCoordinator, async (req: any, res) => {
    await storage.deleteClubDelegate(Number(req.params.id));
    res.json({ success: true });
  });

  // ============ CLUB PLAYERS (Coordinator) ============

  app.get("/api/club/teams/:teamId/players", isCoordinator, async (req: any, res) => {
    const players = await storage.getClubPlayers(Number(req.params.teamId));
    res.json(players);
  });

  app.post("/api/club/teams/:teamId/players", isCoordinator, async (req: any, res) => {
    try {
      const teamId = Number(req.params.teamId);
      const input = insertClubPlayerSchema.parse(req.body);
      const player = await storage.createClubPlayer({ ...input, teamId });
      res.status(201).json(player);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.patch("/api/club/players/:id", isCoordinator, async (req: any, res) => {
    const updated = await storage.updateClubPlayer(Number(req.params.id), req.body);
    res.json(updated);
  });

  app.delete("/api/club/players/:id", isCoordinator, async (req: any, res) => {
    await storage.deleteClubPlayer(Number(req.params.id));
    res.json({ success: true });
  });

  // ============ CLUB MATCHDAYS (Coordinator) ============

  app.get("/api/club/:clubId/matchdays", isCoordinator, async (req: any, res) => {
    const matchdays = await storage.getClubMatchdaysByClub(Number(req.params.clubId));
    const enriched = await Promise.all(matchdays.map(async (md) => {
      if (md.matchId) {
        const match = await storage.getMatch(md.matchId);
        return { ...md, matchStatus: match?.status || null };
      }
      return { ...md, matchStatus: null };
    }));
    res.json(enriched);
  });

  app.get("/api/club/teams/:teamId/matchdays", isCoordinator, async (req: any, res) => {
    const matchdays = await storage.getClubMatchdays(Number(req.params.teamId));
    const enriched = await Promise.all(matchdays.map(async (md) => {
      if (md.matchId) {
        const match = await storage.getMatch(md.matchId);
        return { ...md, matchStatus: match?.status || null };
      }
      return { ...md, matchStatus: null };
    }));
    res.json(enriched);
  });

  app.post("/api/club/:clubId/matchdays", isCoordinator, async (req: any, res) => {
    try {
      const clubId = Number(req.params.clubId);
      if (req.body.date && typeof req.body.date === "string") {
        req.body.date = new Date(req.body.date);
      }
      const input = insertClubMatchdaySchema.parse(req.body);
      const matchday = await storage.createClubMatchday(clubId, input);
      res.status(201).json(matchday);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.patch("/api/club/matchdays/:id", isCoordinator, async (req: any, res) => {
    const updated = await storage.updateClubMatchday(Number(req.params.id), req.body);
    res.json(updated);
  });

  app.delete("/api/club/matchdays/:id", isCoordinator, async (req: any, res) => {
    await storage.deleteClubMatchday(Number(req.params.id));
    res.json({ success: true });
  });

  // Broadcast matchday (create a match in the existing system)
  app.post("/api/club/matchdays/:id/broadcast", isCoordinator, async (req: any, res) => {
    const matchdayId = Number(req.params.id);
    const matchday = await storage.getClubMatchday(matchdayId);
    if (!matchday) return res.status(404).json({ message: "Jornada no encontrada" });
    if (matchday.matchId) return res.status(400).json({ message: "Esta jornada ya tiene un partido en directo" });

    const team = await storage.getClubTeam(matchday.teamId);
    if (!team) return res.status(404).json({ message: "Equipo no encontrado" });

    const club = await storage.getClub(matchday.clubId);
    const coordinatorAuthUserId = club?.coordinatorUserId ? `local_${club.coordinatorUserId}` : undefined;

    const localTeam = matchday.isHome ? team.name : matchday.rival;
    const awayTeam = matchday.isHome ? matchday.rival : team.name;

    const generatedPin = String(Math.floor(1000 + Math.random() * 9000));
    const match = await storage.createMatch({
      localTeam,
      awayTeam,
      localTeamColor: matchday.isHome ? team.color : "#ef4444",
      awayTeamColor: matchday.isHome ? "#ef4444" : team.color,
      venue: matchday.venue || team.fieldName || undefined,
      category: team.category,
      authUserId: coordinatorAuthUserId,
      userId: club?.coordinatorUserId || undefined,
      scheduledTime: matchday.time || undefined,
      adminPin: generatedPin,
    });

    await storage.updateClubMatchday(matchdayId, { matchId: match.id, status: "next" });
    res.json({ success: true, match });
  });

  // ============ CLUB SPONSORS (Coordinator) ============

  app.get("/api/club/:clubId/sponsors", isCoordinator, async (req: any, res) => {
    const sponsors = await storage.getClubSponsors(Number(req.params.clubId));
    res.json(sponsors);
  });

  app.post("/api/club/:clubId/sponsors", isCoordinator, async (req: any, res) => {
    try {
      const clubId = Number(req.params.clubId);
      const input = insertClubSponsorSchema.parse(req.body);
      const sponsor = await storage.createClubSponsor({ ...input, clubId });
      res.status(201).json(sponsor);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.patch("/api/club/sponsors/:id", isCoordinator, async (req: any, res) => {
    const updated = await storage.updateClubSponsor(Number(req.params.id), req.body);
    res.json(updated);
  });

  app.delete("/api/club/sponsors/:id", isCoordinator, async (req: any, res) => {
    await storage.deleteClubSponsor(Number(req.params.id));
    res.json({ success: true });
  });

  // ============ CLUB BRANCHES (Coordinator) ============

  app.get("/api/club/:clubId/branches", isCoordinator, async (req: any, res) => {
    const branches = await storage.getClubBranches(Number(req.params.clubId));
    res.json(branches);
  });

  app.post("/api/club/:clubId/branches", isCoordinator, async (req: any, res) => {
    try {
      const clubId = Number(req.params.clubId);
      const input = insertClubBranchSchema.parse(req.body);
      const branch = await storage.createClubBranch({ ...input, clubId });
      res.status(201).json(branch);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.patch("/api/club/branches/:id", isCoordinator, async (req: any, res) => {
    const updated = await storage.updateClubBranch(Number(req.params.id), req.body);
    res.json(updated);
  });

  app.delete("/api/club/branches/:id", isCoordinator, async (req: any, res) => {
    await storage.deleteClubBranch(Number(req.params.id));
    res.json({ success: true });
  });

  // ============ DELEGATE PIN AUTH ============

  app.post("/api/club/:slug/delegate-login", async (req, res) => {
    const { pin } = req.body;
    if (!pin || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ message: "PIN debe ser 4 dígitos" });
    }
    const club = await storage.getClubBySlug(req.params.slug);
    if (!club) return res.status(404).json({ message: "Club no encontrado" });
    if (club.status !== "active") return res.status(403).json({ message: "Club no activo" });

    const delegate = await storage.getClubDelegateByPin(club.id, pin);
    if (!delegate) return res.status(401).json({ message: "PIN incorrecto" });

    const delegateTeams = await storage.getClubTeamsByDelegate(delegate.id);
    const token = jwt.sign({ delegateId: delegate.id, clubId: club.id, type: "delegate" }, JWT_SECRET, { expiresIn: "24h" });
    res.json({ token, delegate, teams: delegateTeams, club });
  });

  // Middleware for delegate auth
  const isDelegateAuth = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No autorizado" });
    }
    try {
      const decoded = jwt.verify(authHeader.split(" ")[1], JWT_SECRET) as any;
      if (decoded.type !== "delegate") {
        const user = await storage.getUser(decoded.userId);
        if (user && (user.role === "coordinator" || user.role === "superadmin")) {
          req.localUser = decoded;
          req.coordinatorUser = user;
          return next();
        }
        return res.status(403).json({ message: "No autorizado" });
      }
      req.delegateData = decoded;
      return next();
    } catch {
      return res.status(401).json({ message: "Token inválido" });
    }
  };

  // ============ DELEGATE ROUTES ============

  app.get("/api/delegate/my-data", isDelegateAuth, async (req: any, res) => {
    const { delegateId, clubId } = req.delegateData || {};
    if (!delegateId) return res.status(401).json({ message: "No autorizado" });
    const delegate = await storage.getClubDelegate(delegateId);
    if (!delegate) return res.status(404).json({ message: "Delegado no encontrado" });
    const delegateTeams = await storage.getClubTeamsByDelegate(delegateId);
    const club = await storage.getClub(clubId);
    res.json({ delegate, teams: delegateTeams, club });
  });

  app.get("/api/delegate/teams/:teamId/matchdays", isDelegateAuth, async (req: any, res) => {
    const matchdays = await storage.getClubMatchdays(Number(req.params.teamId));
    const enriched = await Promise.all(matchdays.map(async (md) => {
      if (md.matchId) {
        const match = await storage.getMatch(md.matchId);
        return { ...md, matchStatus: match?.status || null };
      }
      return { ...md, matchStatus: null };
    }));
    res.json(enriched);
  });

  app.post("/api/delegate/matchdays", isDelegateAuth, async (req: any, res) => {
    try {
      const { delegateId, clubId } = req.delegateData || {};
      if (!delegateId || !clubId) return res.status(401).json({ message: "No autorizado" });
      if (req.body.date && typeof req.body.date === "string") {
        req.body.date = new Date(req.body.date);
      }
      const input = insertClubMatchdaySchema.parse(req.body);
      const team = await storage.getClubTeam(input.teamId);
      if (!team || team.delegateId !== delegateId) {
        return res.status(403).json({ message: "No tienes acceso a este equipo" });
      }
      const matchday = await storage.createClubMatchday(clubId, input);
      res.status(201).json(matchday);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.patch("/api/delegate/matchdays/:id", isDelegateAuth, async (req: any, res) => {
    const updated = await storage.updateClubMatchday(Number(req.params.id), req.body);
    res.json(updated);
  });

  // Delegate broadcast matchday
  app.post("/api/delegate/matchdays/:id/broadcast", isDelegateAuth, async (req: any, res) => {
    const matchdayId = Number(req.params.id);
    const matchday = await storage.getClubMatchday(matchdayId);
    if (!matchday) return res.status(404).json({ message: "Jornada no encontrada" });
    if (matchday.matchId) return res.status(400).json({ message: "Ya hay un partido en directo" });

    const team = await storage.getClubTeam(matchday.teamId);
    if (!team) return res.status(404).json({ message: "Equipo no encontrado" });

    const club = await storage.getClub(matchday.clubId);
    const coordinatorAuthUserId = club?.coordinatorUserId ? `local_${club.coordinatorUserId}` : undefined;

    const localTeam = matchday.isHome ? team.name : matchday.rival;
    const awayTeam = matchday.isHome ? matchday.rival : team.name;

    const generatedPin = String(Math.floor(1000 + Math.random() * 9000));
    const match = await storage.createMatch({
      localTeam,
      awayTeam,
      localTeamColor: matchday.isHome ? team.color : "#ef4444",
      awayTeamColor: matchday.isHome ? "#ef4444" : team.color,
      venue: matchday.venue || team.fieldName || undefined,
      category: team.category,
      authUserId: coordinatorAuthUserId,
      userId: club?.coordinatorUserId || undefined,
      scheduledTime: matchday.time || undefined,
      adminPin: generatedPin,
    });

    await storage.updateClubMatchday(matchdayId, { matchId: match.id, status: "next" });
    res.json({ success: true, match });
  });

  // Delegate change own PIN
  app.post("/api/delegate/change-pin", isDelegateAuth, async (req: any, res) => {
    const { delegateId, clubId } = req.delegateData || {};
    if (!delegateId) return res.status(401).json({ message: "No autorizado" });
    const { newPin } = req.body;
    if (!newPin || !/^\d{4}$/.test(newPin)) {
      return res.status(400).json({ message: "PIN debe ser 4 dígitos" });
    }
    const existingDelegates = await storage.getClubDelegates(clubId);
    const conflict = existingDelegates.find(d => d.pin === newPin && d.id !== delegateId);
    if (conflict) return res.status(400).json({ message: "Ese PIN ya está en uso" });
    const updated = await storage.updateClubDelegate(delegateId, { pin: newPin });
    res.json(updated);
  });

  // Delegate players
  app.get("/api/delegate/teams/:teamId/players", isDelegateAuth, async (req: any, res) => {
    const players = await storage.getClubPlayers(Number(req.params.teamId));
    res.json(players);
  });

  app.post("/api/delegate/teams/:teamId/players", isDelegateAuth, async (req: any, res) => {
    try {
      const teamId = Number(req.params.teamId);
      const input = insertClubPlayerSchema.parse(req.body);
      const player = await storage.createClubPlayer({ ...input, teamId });
      res.status(201).json(player);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  // ============ PUBLIC CLUB LANDING ============

  app.get("/api/club/:slug/public", async (req, res) => {
    const club = await storage.getClubBySlug(req.params.slug);
    if (!club) return res.status(404).json({ message: "Club no encontrado" });
    if (club.status !== "active") return res.status(404).json({ message: "Club no disponible" });

    const clubTeamsList = await storage.getClubTeams(club.id);
    const matchdays = await storage.getClubMatchdaysByClub(club.id);
    const branches = await storage.getClubBranches(club.id);
    const sponsors = await storage.getClubSponsors(club.id);

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const thisWeek = matchdays.filter(m => {
      if (!m.date) return false;
      const d = new Date(m.date);
      return d >= weekStart && d < weekEnd;
    });

    const liveMatchIds = matchdays.filter(m => m.matchId).map(m => m.matchId!);
    let liveMatches: any[] = [];
    if (liveMatchIds.length > 0) {
      const allMatches = await storage.getAllMatches();
      const liveStatuses = [MATCH_STATUS.FIRST_HALF, MATCH_STATUS.HALFTIME, MATCH_STATUS.SECOND_HALF];
      liveMatches = allMatches.filter(m =>
        liveMatchIds.includes(m.id) && liveStatuses.includes(m.status as any)
      );
    }

    const recentResults = matchdays
      .filter(m => m.status === "played" && m.resultHome !== null)
      .slice(0, 10);

    res.json({
      club: {
        name: club.name,
        slug: club.slug,
        logoUrl: club.logoUrl,
        primaryColor: club.primaryColor,
        secondaryColor: club.secondaryColor,
      },
      teams: clubTeamsList.map(t => ({
        id: t.id,
        name: t.name,
        category: t.category,
        color: t.color,
        branchId: t.branchId,
      })),
      branches,
      sponsors,
      thisWeek,
      liveMatches,
      recentResults,
      allMatchdays: matchdays,
    });
  });

  // ============ CHRONICLE CONFIG ============

  app.get("/api/club/:slug/chronicle-config", isCoordinator, async (req: any, res) => {
    try {
      const club = await storage.getClubBySlug(req.params.slug);
      if (!club) return res.status(404).json({ message: "Club no encontrado" });
      
      const user = await storage.getUser(req.localUser.userId);
      if (!user) return res.status(401).json({ message: "Usuario no encontrado" });
      if (user.role !== "superadmin" && club.coordinatorUserId !== user.id) {
        return res.status(403).json({ message: "No autorizado" });
      }

      res.json({
        tone: club.chronicleTone || "cercano",
        customTone: club.chronicleCustomTone || "",
        mentionScorers: club.chronicleMentionScorers ?? true,
        hideBlowout: club.chronicleHideBlowout ?? true,
        blowoutThreshold: club.chronicleBlowoutThreshold ?? 4,
        slogans: club.chronicleSlogans || [],
        values: club.chronicleValues || [],
        extraInstructions: club.chronicleExtraInstructions || "",
      });
    } catch (error) {
      console.error("Error fetching chronicle config:", error);
      res.status(500).json({ message: "Error interno" });
    }
  });

  app.put("/api/club/:slug/chronicle-config", isCoordinator, async (req: any, res) => {
    try {
      const club = await storage.getClubBySlug(req.params.slug);
      if (!club) return res.status(404).json({ message: "Club no encontrado" });
      
      const user = await storage.getUser(req.localUser.userId);
      if (!user) return res.status(401).json({ message: "Usuario no encontrado" });
      if (user.role !== "superadmin" && club.coordinatorUserId !== user.id) {
        return res.status(403).json({ message: "No autorizado" });
      }

      const { tone, customTone, mentionScorers, hideBlowout, blowoutThreshold, slogans, values, extraInstructions } = req.body;

      const updated = await storage.updateClub(club.id, {
        chronicleTone: tone || "cercano",
        chronicleCustomTone: customTone || null,
        chronicleMentionScorers: mentionScorers ?? true,
        chronicleHideBlowout: hideBlowout ?? true,
        chronicleBlowoutThreshold: blowoutThreshold ?? 4,
        chronicleSlogans: slogans || [],
        chronicleValues: values || [],
        chronicleExtraInstructions: extraInstructions || null,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error saving chronicle config:", error);
      res.status(500).json({ message: "Error interno" });
    }
  });

  app.get("/api/club/:slug/template-config", async (req: any, res) => {
    try {
      const club = await storage.getClubBySlug(req.params.slug);
      if (!club) return res.status(404).json({ message: "Club no encontrado" });
      res.json({
        templateMatchday: club.templateMatchday || "classic",
        templateResult: club.templateResult || "classic",
        templateWeekly: club.templateWeekly || "classic",
      });
    } catch (error) {
      console.error("Error fetching template config:", error);
      res.status(500).json({ message: "Error interno" });
    }
  });

  app.put("/api/club/:slug/template-config", isCoordinator, async (req: any, res) => {
    try {
      const club = await storage.getClubBySlug(req.params.slug);
      if (!club) return res.status(404).json({ message: "Club no encontrado" });
      const user = await storage.getUser(req.localUser.userId);
      if (!user) return res.status(401).json({ message: "Usuario no encontrado" });
      if (user.role !== "superadmin" && club.coordinatorUserId !== user.id) {
        return res.status(403).json({ message: "No autorizado" });
      }
      const { templateMatchday, templateResult, templateWeekly } = req.body;
      const validTemplates = ["classic", "modern", "bold", "sport"];
      await storage.updateClub(club.id, {
        templateMatchday: validTemplates.includes(templateMatchday) ? templateMatchday : "classic",
        templateResult: validTemplates.includes(templateResult) ? templateResult : "classic",
        templateWeekly: validTemplates.includes(templateWeekly) ? templateWeekly : "classic",
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving template config:", error);
      res.status(500).json({ message: "Error interno" });
    }
  });

  // ============ GENERATE CHRONICLE WITH AI ============

  app.post("/api/matches/:id/generate-chronicle", async (req: any, res) => {
    try {
      const matchId = Number(req.params.id);
      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ message: "Partido no encontrado" });
      if (match.status !== "finished") return res.status(400).json({ message: "El partido debe estar finalizado" });

      if (match.chronicle) {
        return res.json({ chronicle: match.chronicle, alreadyGenerated: true });
      }

      const matchday = await storage.getClubMatchdayByMatchId(matchId);
      if (!matchday) return res.status(400).json({ message: "Este partido no pertenece a un club" });

      const club = await storage.getClub(matchday.clubId);
      if (!club) return res.status(400).json({ message: "Club no encontrado" });

      const team = await storage.getClubTeam(matchday.teamId);
      if (!team) return res.status(400).json({ message: "Equipo no encontrado" });

      const { pin, delegateToken } = req.body;
      const authHeader = req.headers.authorization;
      let authorized = false;

      if (authHeader && authHeader.startsWith("Bearer ")) {
        try {
          const decoded = jwt.verify(authHeader.split(" ")[1], JWT_SECRET) as any;
          const user = await storage.getUser(decoded.userId);
          if (user && user.role === "superadmin") {
            authorized = true;
          } else if (user && user.role === "coordinator" && club.coordinatorUserId === user.id) {
            authorized = true;
          }
        } catch {}
      }

      if (!authorized && delegateToken) {
        try {
          const decoded = jwt.verify(delegateToken, JWT_SECRET) as any;
          if (decoded.delegateId && decoded.clubId === club.id) {
            authorized = true;
          }
        } catch {}
      }

      if (!authorized) return res.status(403).json({ message: "No autorizado. Solo coordinadores y delegados del club pueden generar crónicas." });

      const events = await storage.getMatchEvents(matchId);
      const goalEvents = events.filter(e => e.type === "goal");
      
      const halftimeEvent = events.find(e => e.type === "whistle" && e.description === "Descanso");
      let halftimeScore: string | null = null;
      if (halftimeEvent) {
        const goalsBeforeHalftime = goalEvents.filter(e => 
          new Date(e.createdAt) < new Date(halftimeEvent.createdAt)
        );
        const htLocal = goalsBeforeHalftime.filter(e => e.team === "local").length;
        const htAway = goalsBeforeHalftime.filter(e => e.team === "away").length;
        halftimeScore = `${htLocal}-${htAway}`;
      }

      const localGoalScorers = goalEvents
        .filter(e => e.team === "local")
        .map(e => e.player)
        .filter(Boolean);
      const awayGoalScorers = goalEvents
        .filter(e => e.team === "away")
        .map(e => e.player)
        .filter(Boolean);

      const isHome = matchday.isHome;
      const teamName = team.name;
      const rivalName = matchday.rival;
      const scoreDiff = Math.abs(match.localScore - match.awayScore);
      const teamWon = isHome ? match.localScore > match.awayScore : match.awayScore > match.localScore;
      const teamLost = isHome ? match.localScore < match.awayScore : match.awayScore < match.localScore;
      const isDraw = match.localScore === match.awayScore;

      const hideScore = club.chronicleHideBlowout && scoreDiff >= (club.chronicleBlowoutThreshold || 4);

      const teamScore = isHome ? match.localScore : match.awayScore;
      const rivalScore = isHome ? match.awayScore : match.localScore;

      let resultDescription: string;
      if (hideScore) {
        if (teamWon) resultDescription = "VICTORIA amplia (no menciones el marcador numérico exacto)";
        else if (teamLost) resultDescription = "DERROTA amplia (no menciones el marcador numérico exacto)";
        else resultDescription = `EMPATE a ${match.localScore}`;
      } else {
        if (teamWon) resultDescription = `VICTORIA ${teamScore}-${rivalScore} (nuestro equipo ${teamScore}, rival ${rivalScore})`;
        else if (teamLost) resultDescription = `DERROTA ${rivalScore}-${teamScore} (rival ${rivalScore}, nuestro equipo ${teamScore})`;
        else resultDescription = `EMPATE ${match.localScore}-${match.awayScore}`;
      }

      const teamScorers = isHome ? localGoalScorers : awayGoalScorers;
      const scorerCounts: Record<string, number> = {};
      teamScorers.forEach(name => {
        if (name) scorerCounts[name] = (scorerCounts[name] || 0) + 1;
      });
      const scorersList = Object.entries(scorerCounts)
        .map(([name, count]) => count > 1 ? `${name} (${count})` : name)
        .join(", ");

      const toneDescriptions: Record<string, string> = {
        cercano: "Cercano y familiar, como un padre/madre orgulloso/a del equipo",
        profesional: "Profesional, como un community manager de un club deportivo",
        epico: "Épico y emocionante, como un narrador de Champions League",
        humor: "Humorístico, con gracia y buen rollo",
        custom: club.chronicleCustomTone || "Cercano y familiar",
      };

      const toneDesc = toneDescriptions[club.chronicleTone || "cercano"] || toneDescriptions.cercano;
      const slogans = club.chronicleSlogans || [];
      const values = club.chronicleValues || [];
      const randomSlogan = slogans.length > 0 ? slogans[Math.floor(Math.random() * slogans.length)] : "";

      let prompt = `Genera una crónica corta de fútbol base (3-5 líneas) para publicar en redes sociales (Instagram/Facebook/WhatsApp).

DATOS DEL PARTIDO:
- Club: ${club.name}
- Equipo: ${teamName}
- Categoría: ${team.category || "No especificada"}
- Rival: ${rivalName}
- Resultado: ${resultDescription}
- Jugamos en: ${isHome ? "casa" : "fuera"}
- Desenlace: ${teamWon ? "GANAMOS este partido" : teamLost ? "PERDIMOS este partido" : "EMPATAMOS este partido"}
- Campo: ${matchday.venue || match.venue || "No especificado"}
- Jornada: ${matchday.matchdayNumber || "?"}
- Liga: ${match.league || "No especificada"}
- Fecha: ${matchday.date ? new Date(matchday.date).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }) : "No especificada"}`;

      if (halftimeScore) {
        prompt += `\n- Marcador al descanso: ${halftimeScore}`;
      }

      if (club.chronicleMentionScorers && scorersList) {
        prompt += `\n- Goleadores del equipo: ${scorersList}`;
      }

      prompt += `

ESTILO Y TONO:
- Tono: ${toneDesc}`;

      if (values.length > 0) {
        prompt += `\n- Valores del club a transmitir: ${values.join(", ")}`;
      }

      if (randomSlogan) {
        prompt += `\n- Incluye este eslogan al final de la crónica: "${randomSlogan}"`;
      }

      if (club.chronicleExtraInstructions) {
        prompt += `\n- Instrucciones adicionales: ${club.chronicleExtraInstructions}`;
      }

      prompt += `

REGLAS IMPORTANTES:
- Texto de 3-5 líneas, pensado para copiar y pegar directamente
- Usa 2-3 emojis integrados de forma natural
- Si es victoria: orgullo sin arrogancia
- Si es derrota: orgullo por el esfuerzo, nunca negatividad
- Si es empate: valora la lucha y el partido
- NO uses hashtags
- NO uses formato de titular periodístico
- Suena como alguien del club, no como un periodista
- Responde SOLO con el texto de la crónica, sin comillas, sin explicaciones`;

      const anthropic = new Anthropic({
        apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
      });

      const message = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 8192,
        messages: [{ role: "user", content: prompt }],
      });

      const content = message.content[0];
      const chronicle = content.type === "text" ? content.text.trim() : "";

      if (!chronicle) {
        return res.status(500).json({ message: "No se pudo generar la crónica" });
      }

      await storage.updateMatch(matchId, { chronicle });

      res.json({ chronicle, alreadyGenerated: false });
    } catch (error) {
      console.error("Error generating chronicle:", error);
      res.status(500).json({ message: "Error al generar la crónica" });
    }
  });
}

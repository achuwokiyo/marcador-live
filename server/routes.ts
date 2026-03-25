import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { MATCH_STATUS, insertTeamSchema, insertUserMatchSchema, users, type MatchStatus } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { registerLocalAuthRoutes, isLocalAuthenticated, optionalLocalAuth } from "./localAuth";
import { registerClubRoutes } from "./clubRoutes";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Setup Replit Auth (BEFORE other routes)
  await setupAuth(app);
  registerAuthRoutes(app);
  
  // Setup Object Storage routes for file uploads
  registerObjectStorageRoutes(app);
  
  // Setup local username/password auth routes
  registerLocalAuthRoutes(app);
  
  // Setup club management routes
  registerClubRoutes(app);
  
  // Helper: get effective authUserId from either auth system
  const getEffectiveAuthUserId = (req: any): string | null => {
    if (req.localUser) return `local_${req.localUser.userId}`;
    if (req.user?.claims?.sub) return req.user.claims.sub;
    return null;
  };

  // Helper: get effective local userId from either auth system
  const getEffectiveUserId = (req: any): number | null => {
    if (req.localUser) return req.localUser.userId;
    return null;
  };

  // Middleware that accepts either auth system (for team/match routes)
  const isAnyAuthenticated = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const jwt = await import("jsonwebtoken");
      try {
        const decoded = jwt.default.verify(authHeader.split(" ")[1], process.env.SESSION_SECRET!) as any;
        req.localUser = decoded;
        return next();
      } catch {}
    }
    if (req.isAuthenticated && req.isAuthenticated() && req.user?.claims?.sub) {
      return next();
    }
    return res.status(401).json({ message: "Not authenticated" });
  };

  // ============ TEAMS ROUTES (Protected - both auth systems) ============
  
  // Get user's teams
  app.get("/api/teams", isAnyAuthenticated, async (req: any, res) => {
    const authUserId = getEffectiveAuthUserId(req);
    if (!authUserId) return res.status(401).json({ message: "Not authenticated" });
    const teams = await storage.getTeams(authUserId);
    res.json(teams);
  });

  // Create team
  app.post("/api/teams", isAnyAuthenticated, async (req: any, res) => {
    try {
      const authUserId = getEffectiveAuthUserId(req);
      if (!authUserId) return res.status(401).json({ message: "Not authenticated" });
      const input = insertTeamSchema.parse(req.body);
      const team = await storage.createTeam(authUserId, input);
      res.status(201).json(team);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Update team
  app.patch("/api/teams/:id", isAnyAuthenticated, async (req: any, res) => {
    try {
      const authUserId = getEffectiveAuthUserId(req);
      if (!authUserId) return res.status(401).json({ message: "Not authenticated" });
      const teamId = Number(req.params.id);
      const team = await storage.getTeam(teamId);
      if (!team || team.authUserId !== authUserId) {
        return res.status(404).json({ message: "Equipo no encontrado" });
      }
      const validatedData = insertTeamSchema.partial().parse(req.body);
      const updated = await storage.updateTeam(teamId, authUserId, validatedData);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Delete team
  app.delete("/api/teams/:id", isAnyAuthenticated, async (req: any, res) => {
    const authUserId = getEffectiveAuthUserId(req);
    if (!authUserId) return res.status(401).json({ message: "Not authenticated" });
    const teamId = Number(req.params.id);
    await storage.deleteTeam(teamId, authUserId);
    res.json({ success: true });
  });

  // Get user's matches (for dashboard)
  app.get("/api/my-matches", isAnyAuthenticated, async (req: any, res) => {
    const authUserId = getEffectiveAuthUserId(req);
    const userId = getEffectiveUserId(req);
    if (!authUserId) return res.status(401).json({ message: "Not authenticated" });
    const matchesByAuth = await storage.getAuthUserMatches(authUserId);
    if (userId) {
      const matchesByUserId = await storage.getUserMatchesByUserId(userId);
      const allIds = new Set(matchesByAuth.map((m: any) => m.id));
      for (const m of matchesByUserId) {
        if (!allIds.has(m.id)) matchesByAuth.push(m);
      }
    }
    res.json(matchesByAuth);
  });

  // Create Match for authenticated users (no PIN required - owner has direct access)
  app.post("/api/user-matches", isAnyAuthenticated, async (req: any, res) => {
    try {
      const authUserId = getEffectiveAuthUserId(req);
      const userId = getEffectiveUserId(req);
      if (!authUserId) return res.status(401).json({ message: "Not authenticated" });
      const input = insertUserMatchSchema.parse(req.body);
      const userTeams = await storage.getTeams(authUserId);
      const localTeamData = userTeams.find(t => t.name.trim().toLowerCase() === input.localTeam.trim().toLowerCase());
      const awayTeamData = userTeams.find(t => t.name.trim().toLowerCase() === input.awayTeam.trim().toLowerCase());
      const adminPin = req.body.adminPin || String(Math.floor(1000 + Math.random() * 9000));
      const match = await storage.createMatch({
        ...input,
        adminPin,
        authUserId,
        userId: userId ?? undefined,
        localTeamLogo: localTeamData?.logoUrl || null,
        awayTeamLogo: awayTeamData?.logoUrl || null,
        localTeamColor: localTeamData?.color || input.localTeamColor || '#3b82f6',
        awayTeamColor: awayTeamData?.color || input.awayTeamColor || '#ef4444',
      });
      res.status(201).json(match);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // ============ PUBLIC/GUEST ROUTES ============
  
  // Create Match (guest mode)
  app.post(api.matches.create.path, async (req, res) => {
    try {
      const input = api.matches.create.input.parse(req.body);
      const match = await storage.createMatch(input);
      res.status(201).json(match);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.get("/api/active-matches", isAnyAuthenticated, async (req: any, res) => {
    const matches = await storage.getAllMatches();
    const NINETY_MINUTES = 90 * 60 * 1000;
    const enriched = matches.map(m => {
      const inactiveMs = Date.now() - new Date(m.lastActivityAt).getTime();
      const isInactive = m.status !== MATCH_STATUS.FINISHED 
        && m.status !== MATCH_STATUS.SCHEDULED 
        && inactiveMs >= NINETY_MINUTES;
      return { ...m, isInactive };
    });
    res.json(enriched);
  });

  app.get("/api/my-team-matches", isAnyAuthenticated, async (req: any, res) => {
    const authUserId = getEffectiveAuthUserId(req);
    if (!authUserId) return res.status(401).json({ message: "Not authenticated" });
    const userTeams = await storage.getTeams(authUserId);
    const teamNames = userTeams.map(t => t.name.toLowerCase().trim());
    
    if (teamNames.length === 0) {
      return res.json([]);
    }

    const allMatches = await storage.getAllMatches();
    const NINETY_MINUTES = 90 * 60 * 1000;
    const filtered = allMatches
      .filter(m => 
        teamNames.includes(m.localTeam.toLowerCase().trim()) || 
        teamNames.includes(m.awayTeam.toLowerCase().trim())
      )
      .map(m => {
        const inactiveMs = Date.now() - new Date(m.lastActivityAt).getTime();
        const isInactive = m.status !== MATCH_STATUS.FINISHED 
          && m.status !== MATCH_STATUS.SCHEDULED 
          && inactiveMs >= NINETY_MINUTES;
        return { ...m, isInactive };
      });
    res.json(filtered);
  });

  // Widget API - Public endpoint for embeddable widgets
  app.get("/api/widget/matches", async (req, res) => {
    // Set CORS headers to allow embedding from any domain
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET");
    res.header("Access-Control-Allow-Headers", "Content-Type");

    const limit = Math.min(Number(req.query.limit) || 5, 20);
    const type = req.query.type as string || "all"; // "live", "recent", "all"
    const teamsParam = req.query.teams as string || "";

    let allMatches = await storage.getAllMatches();
    
    if (teamsParam) {
      const teamNames = teamsParam.split(",").map(t => t.toLowerCase().trim()).filter(Boolean);
      if (teamNames.length > 0) {
        allMatches = allMatches.filter(m =>
          teamNames.includes(m.localTeam.toLowerCase().trim()) ||
          teamNames.includes(m.awayTeam.toLowerCase().trim())
        );
      }
    }

    // Filter live matches (in progress, not inactive)
    const liveStatuses: string[] = [MATCH_STATUS.FIRST_HALF, MATCH_STATUS.HALFTIME, MATCH_STATUS.SECOND_HALF];
    const NINETY_MIN_MS = 90 * 60 * 1000;
    const liveMatches = allMatches
      .filter(m => {
        if (!liveStatuses.includes(m.status)) return false;
        const inactiveMs = Date.now() - new Date(m.lastActivityAt).getTime();
        return inactiveMs < NINETY_MIN_MS;
      })
      .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
    
    // Recent matches (sorted by creation date)
    const recentMatches = allMatches
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    // Return sanitized data (no admin PINs)
    const NINETY_MINUTES = 90 * 60 * 1000;
    const sanitize = (match: any) => {
      const inactiveMs = Date.now() - new Date(match.lastActivityAt).getTime();
      const isInactive = match.status !== MATCH_STATUS.FINISHED 
        && match.status !== MATCH_STATUS.SCHEDULED 
        && inactiveMs >= NINETY_MINUTES;
      return {
        id: match.id,
        localTeam: match.localTeam,
        awayTeam: match.awayTeam,
        localTeamColor: match.localTeamColor,
        awayTeamColor: match.awayTeamColor,
        localTeamLogo: match.localTeamLogo,
        awayTeamLogo: match.awayTeamLogo,
        localScore: match.localScore,
        awayScore: match.awayScore,
        status: match.status,
        statusLabel: isInactive ? "Inactivo" : formatStatus(match.status),
        timerStartTime: match.timerStartTime,
        timerElapsedSeconds: match.timerElapsedSeconds,
        spectatorCount: match.spectatorCount,
        createdAt: match.createdAt,
        isInactive,
      };
    };

    if (type === "live") {
      res.json({ live: liveMatches.slice(0, limit).map(sanitize), recent: [] });
    } else if (type === "recent") {
      res.json({ live: [], recent: recentMatches.map(sanitize) });
    } else {
      res.json({ 
        live: liveMatches.slice(0, limit).map(sanitize), 
        recent: recentMatches.map(sanitize) 
      });
    }
  });

  app.delete("/api/matches/:id", async (req, res) => {
    const matchId = Number(req.params.id);
    const { pin } = req.body;
    const authUserId = await getOptionalAuthUserId(req);

    const match = await storage.getMatch(matchId);
    if (!match) return res.status(404).json({ message: "Match not found" });
    if (!(await hasExtendedAdminAccess(match, pin, authUserId))) return res.status(401).json({ message: "Invalid PIN" });

    await storage.deleteMatch(matchId);
    res.json({ success: true });
  });

  // Get Match
  app.get(api.matches.get.path, async (req, res) => {
    const matchId = Number(req.params.id);
    const match = await storage.getMatch(matchId);
    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    // Track unique visitors using IP address
    const visitorIp = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown';
    const visitorId = `${visitorIp}`.split(',')[0].trim();
    
    const isNewVisitor = await storage.addSpectator(matchId, visitorId);
    
    if (isNewVisitor) {
      const newCount = await storage.getSpectatorCount(matchId);
      await storage.updateMatch(matchId, { spectatorCount: newCount });
    }

    // Return match with updated spectator count and inactive flag
    const updatedMatch = await storage.getMatch(matchId);
    if (updatedMatch) {
      const NINETY_MINUTES = 90 * 60 * 1000;
      const inactiveMs = Date.now() - new Date(updatedMatch.lastActivityAt).getTime();
      const isInactive = updatedMatch.status !== MATCH_STATUS.FINISHED 
        && updatedMatch.status !== MATCH_STATUS.SCHEDULED 
        && inactiveMs >= NINETY_MINUTES;
      res.json({ ...updatedMatch, isInactive });
    } else {
      res.json(updatedMatch);
    }
  });

  // Verify PIN (or owner access)
  app.post(api.matches.verifyPin.path, async (req, res) => {
    const matchId = Number(req.params.id);
    const { pin } = req.body;
    const authUserId = await getOptionalAuthUserId(req);
    
    const match = await storage.getMatch(matchId);
    if (!match) return res.status(404).json({ message: "Match not found" });
    
    if (!(await hasExtendedAdminAccess(match, pin, authUserId))) {
      return res.status(401).json({ message: "Invalid PIN" });
    }
    
    const isOwner = (await hasExtendedAdminAccess(match, undefined, authUserId)) && !pin;
    res.json({ success: true, isOwner });
  });

  app.get("/api/matches/:id/is-owner", async (req, res) => {
    const matchId = Number(req.params.id);
    const authUserId = await getOptionalAuthUserId(req);
    
    const match = await storage.getMatch(matchId);
    if (!match) return res.status(404).json({ message: "Match not found" });
    
    let isOwner = await hasExtendedAdminAccess(match, undefined, authUserId);
    let userRole: string | null = null;
    let clubSlug: string | null = null;
    if (authUserId && authUserId.startsWith("local_")) {
      const localUserId = Number(authUserId.replace("local_", ""));
      const user = await storage.getUser(localUserId);
      userRole = user?.role || null;
      const matchday = await storage.getClubMatchdayByMatchId(matchId);
      if (matchday) {
        const club = await storage.getClub(matchday.clubId);
        if (club && club.coordinatorUserId === localUserId) {
          userRole = "coordinator";
          clubSlug = club.slug;
        }
      }
    }
    res.json({ isOwner, hasPin: !!match.adminPin, userRole, clubSlug });
  });

  app.post("/api/matches/:id/verify-delegate", async (req, res) => {
    const matchId = Number(req.params.id);
    const { delegateToken } = req.body;
    if (!delegateToken) return res.status(400).json({ authorized: false });

    try {
      const jwt = await import("jsonwebtoken");
      const decoded = jwt.default.verify(delegateToken, process.env.SESSION_SECRET!) as any;
      if (decoded.type !== "delegate") return res.json({ authorized: false });

      const matchday = await storage.getClubMatchdayByMatchId(matchId);
      if (!matchday) return res.json({ authorized: false });

      if (matchday.clubId !== decoded.clubId) return res.json({ authorized: false });

      const delegateTeams = await storage.getClubTeamsByDelegate(decoded.delegateId);
      const teamIds = delegateTeams.map((t: any) => t.id);
      if (!teamIds.includes(matchday.teamId)) return res.json({ authorized: false });

      const match = await storage.getMatch(matchId);
      if (!match) return res.json({ authorized: false });

      const club = await storage.getClub(decoded.clubId);
      res.json({ authorized: true, adminPin: match.adminPin, clubSlug: club?.slug });
    } catch {
      res.json({ authorized: false });
    }
  });

  // Generate PIN for sharing control (owner only)
  app.post("/api/matches/:id/generate-pin", async (req, res) => {
    const matchId = Number(req.params.id);
    const authUserId = await getOptionalAuthUserId(req);
    
    const match = await storage.getMatch(matchId);
    if (!match) return res.status(404).json({ message: "Match not found" });
    
    // Only owner can generate PIN
    if (!authUserId || !(await hasExtendedAdminAccess(match, undefined, authUserId))) {
      return res.status(403).json({ message: "Only the owner can generate a PIN" });
    }
    
    const { pin: customPin } = req.body || {};
    let newPin: string;
    if (customPin && /^\d{4}$/.test(String(customPin))) {
      newPin = String(customPin);
    } else {
      newPin = Math.floor(1000 + Math.random() * 9000).toString();
    }
    const updated = await storage.updateMatch(matchId, { adminPin: newPin });
    
    res.json({ success: true, pin: updated.adminPin });
  });

  // Remove PIN (owner only) 
  app.post("/api/matches/:id/remove-pin", async (req, res) => {
    const matchId = Number(req.params.id);
    const authUserId = await getOptionalAuthUserId(req);
    
    const match = await storage.getMatch(matchId);
    if (!match) return res.status(404).json({ message: "Match not found" });
    
    // Only owner can remove PIN
    if (!authUserId || !(await hasExtendedAdminAccess(match, undefined, authUserId))) {
      return res.status(403).json({ message: "Only the owner can remove a PIN" });
    }
    
    const updated = await storage.updateMatch(matchId, { adminPin: null });
    res.json({ success: true });
  });

  // Update Score
  app.post(api.matches.updateScore.path, async (req, res) => {
    const matchId = Number(req.params.id);
    const { team, delta, pin } = req.body;
    const authUserId = await getOptionalAuthUserId(req);

    const match = await storage.getMatch(matchId);
    if (!match) return res.status(404).json({ message: "Match not found" });
    if (!(await hasExtendedAdminAccess(match, pin, authUserId))) {
      console.log(`[AUTH FAIL] updateScore match=${matchId} authUserId=${authUserId} matchAuthUserId=${match.authUserId} hasPin=${!!pin} matchHasPin=${!!match.adminPin}`);
      return res.status(401).json({ message: "Invalid PIN" });
    }

    const updates: any = {};
    if (team === "local") {
      updates.localScore = Math.max(0, match.localScore + delta);
    } else {
      updates.awayScore = Math.max(0, match.awayScore + delta);
    }

    const updated = await storage.updateMatch(matchId, updates);
    console.log(`[MATCH] score match=${matchId} team=${team} delta=${delta} result=${updated.localScore}-${updated.awayScore} at=${new Date().toISOString()}`);
    
    // Auto-create event
    if (delta > 0) {
      await storage.createEvent({
        matchId,
        type: "goal",
        team,
        minute: calculateCurrentMinute(match),
        half: getHalfNumber(match.status),
        description: `¡GOL! de ${team === "local" ? match.localTeam : match.awayTeam}`,
        currentScore: `${updated.localScore}-${updated.awayScore}`
      });
    }

    res.json(updated);
  });

  // Update Status
  app.post(api.matches.updateStatus.path, async (req, res) => {
    const matchId = Number(req.params.id);
    const { status, pin } = req.body;
    const authUserId = await getOptionalAuthUserId(req);

    const match = await storage.getMatch(matchId);
    if (!match) return res.status(404).json({ message: "Match not found" });
    if (!(await hasExtendedAdminAccess(match, pin, authUserId))) {
      console.log(`[AUTH FAIL] updateStatus match=${matchId} authUserId=${authUserId} matchAuthUserId=${match.authUserId} hasPin=${!!pin} matchHasPin=${!!match.adminPin}`);
      return res.status(401).json({ message: "Invalid PIN" });
    }

    if (match.status === status) {
      console.log(`[MATCH] status match=${matchId} idempotent=${status} at=${new Date().toISOString()}`);
      return res.json(match);
    }

    // State machine logic for timer
    const updates: any = { status };
    
    // If moving to halftime or finished, pause timer
    if ((status === MATCH_STATUS.HALFTIME || status === MATCH_STATUS.FINISHED) && match.timerStartTime) {
      const now = new Date();
      const elapsed = Math.floor((now.getTime() - new Date(match.timerStartTime).getTime()) / 1000);
      updates.timerElapsedSeconds = match.timerElapsedSeconds + elapsed;
      updates.timerStartTime = null;
    }
    
    const updated = await storage.updateMatch(matchId, updates);
    console.log(`[MATCH] status match=${matchId} from=${match.status} to=${status} at=${new Date().toISOString()}`);
    
    await storage.createEvent({
        matchId,
        type: "whistle",
        minute: calculateCurrentMinute(updated),
        half: getHalfNumber(status),
        description: `${formatStatus(status)}`,
    });

    res.json(updated);
  });

  // Control Timer
  app.post(api.matches.controlTimer.path, async (req, res) => {
    const matchId = Number(req.params.id);
    const { action, pin } = req.body;
    const authUserId = await getOptionalAuthUserId(req);

    const match = await storage.getMatch(matchId);
    if (!match) return res.status(404).json({ message: "Match not found" });
    if (!(await hasExtendedAdminAccess(match, pin, authUserId))) return res.status(401).json({ message: "Invalid PIN" });

    const updates: any = {};
    const now = new Date();

    if (action === "start") {
      if (!match.timerStartTime) {
        updates.timerStartTime = now;
      }
    } else if (action === "pause") {
      if (match.timerStartTime) {
        const elapsed = Math.floor((now.getTime() - new Date(match.timerStartTime).getTime()) / 1000);
        updates.timerElapsedSeconds = match.timerElapsedSeconds + elapsed;
        updates.timerStartTime = null;
      }
    } else if (action === "reset") {
      updates.timerElapsedSeconds = 0;
      updates.timerStartTime = null;
    }

    const updated = await storage.updateMatch(matchId, updates);
    console.log(`[MATCH] timer match=${matchId} action=${action} at=${new Date().toISOString()}`);
    res.json(updated);
  });

  // Update Team Colors
  app.post(api.matches.updateColors.path, async (req, res) => {
    try {
      const matchId = Number(req.params.id);
      const input = api.matches.updateColors.input.parse(req.body);
      const { localTeamColor, awayTeamColor, pin } = input;

      const authUserId = await getOptionalAuthUserId(req);
      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ message: "Match not found" });
      if (!(await hasExtendedAdminAccess(match, pin, authUserId))) return res.status(401).json({ message: "Invalid PIN" });

      const updates: any = {};
      if (localTeamColor) updates.localTeamColor = localTeamColor;
      if (awayTeamColor) updates.awayTeamColor = awayTeamColor;

      const updated = await storage.updateMatch(matchId, updates);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.post("/api/matches/:id/chronicle", async (req, res) => {
    const matchId = Number(req.params.id);
    const { chronicle, pin, delegateToken } = req.body;
    const authUserId = await getOptionalAuthUserId(req);

    const match = await storage.getMatch(matchId);
    if (!match) return res.status(404).json({ message: "Match not found" });

    let authorized = await hasExtendedAdminAccess(match, pin, authUserId);
    if (!authorized && delegateToken) {
      try {
        const jwt = await import("jsonwebtoken");
        const decoded = jwt.default.verify(delegateToken, process.env.SESSION_SECRET!) as any;
        if (decoded.delegateId && decoded.clubId) authorized = true;
      } catch {}
    }
    if (!authorized) return res.status(401).json({ message: "No autorizado" });

    const updated = await storage.updateMatch(matchId, { chronicle: chronicle || null });
    res.json(updated);
  });

  app.post("/api/matches/:id/summary-image", async (req, res) => {
    const matchId = Number(req.params.id);
    const { summaryImageUrl, pin } = req.body;
    const authUserId = await getOptionalAuthUserId(req);

    const match = await storage.getMatch(matchId);
    if (!match) return res.status(404).json({ message: "Match not found" });
    if (!(await hasExtendedAdminAccess(match, pin, authUserId))) return res.status(401).json({ message: "No autorizado" });

    const updated = await storage.updateMatch(matchId, { summaryImageUrl: summaryImageUrl || null });
    res.json(updated);
  });

  app.get("/api/matches/:id/sponsor", async (req, res) => {
    try {
      const matchId = Number(req.params.id);
      if (!matchId || isNaN(matchId)) return res.json(null);
      const matchday = await storage.getClubMatchdayByMatchId(matchId);
      if (!matchday) return res.json(null);
      const team = await storage.getClubTeam(matchday.teamId);
      if (!team || !team.sponsorId) return res.json(null);
      const sponsor = await storage.getClubSponsor(team.sponsorId);
      res.json(sponsor || null);
    } catch (err) {
      console.error("Error fetching sponsor for match:", err);
      res.json(null);
    }
  });

  app.get("/api/matches/:id/roster", async (req, res) => {
    try {
      const matchId = Number(req.params.id);
      if (!matchId || isNaN(matchId)) return res.json({ local: [], away: [] });
      const matchday = await storage.getClubMatchdayByMatchId(matchId);
      if (!matchday) return res.json({ local: [], away: [] });
      const players = await storage.getClubPlayers(matchday.teamId);
      const team = await storage.getClubTeam(matchday.teamId);
      const isHome = matchday.isHome;
      res.json({
        local: isHome ? players : [],
        away: isHome ? [] : players,
        localTeamId: isHome ? matchday.teamId : null,
        awayTeamId: isHome ? null : matchday.teamId,
      });
    } catch (err) {
      console.error("Error fetching roster for match:", err);
      res.json({ local: [], away: [] });
    }
  });

  // Events
  app.get(api.events.list.path, async (req, res) => {
    const events = await storage.getMatchEvents(Number(req.params.id));
    res.json(events);
  });

  app.post(api.events.create.path, async (req, res) => {
    const { pin, ...eventData } = req.body;
    const matchId = Number(req.params.id);
    const authUserId = await getOptionalAuthUserId(req);
    
    const match = await storage.getMatch(matchId);
    if (!match) return res.status(404).json({ message: "Match not found" });
    if (!(await hasExtendedAdminAccess(match, pin, authUserId))) return res.status(401).json({ message: "Invalid PIN" });

    // If minute is not provided (0), calculate it
    if (eventData.minute === 0) {
        eventData.minute = calculateCurrentMinute(match);
    }

    const event = await storage.createEvent({
        ...eventData,
        matchId,
        half: eventData.half || getHalfNumber(match.status)
    });
    res.status(201).json(event);
  });

  app.delete("/api/matches/:id/events/:eventId", async (req, res) => {
    const matchId = Number(req.params.id);
    const eventId = Number(req.params.eventId);
    const { pin } = req.body;
    const authUserId = await getOptionalAuthUserId(req);

    const match = await storage.getMatch(matchId);
    if (!match) return res.status(404).json({ message: "Match not found" });
    if (!(await hasExtendedAdminAccess(match, pin, authUserId))) return res.status(401).json({ message: "Invalid PIN" });

    await storage.deleteEvent(eventId);
    res.json({ success: true });
  });

  // Update Event (for adding player/dorsal to goal events)
  app.patch("/api/matches/:id/events/:eventId", async (req, res) => {
    const matchId = Number(req.params.id);
    const eventId = Number(req.params.eventId);
    const { pin, player } = req.body;
    const authUserId = await getOptionalAuthUserId(req);

    // Validate input
    if (typeof player !== 'string') {
      return res.status(400).json({ message: "Invalid request body" });
    }

    const match = await storage.getMatch(matchId);
    if (!match) return res.status(404).json({ message: "Match not found" });
    if (!(await hasExtendedAdminAccess(match, pin, authUserId))) return res.status(401).json({ message: "Invalid PIN" });

    // Verify event belongs to this match
    const events = await storage.getMatchEvents(matchId);
    const event = events.find(e => e.id === eventId);
    if (!event) return res.status(404).json({ message: "Event not found in this match" });

    const updated = await storage.updateEvent(eventId, { player: player.trim() });
    res.json(updated);
  });

  // ============ SUPER ADMIN ROUTES ============
  
  // Middleware to check if user is superadmin (supports both Replit Auth and local auth)
  const isSuperAdmin = async (req: any, res: any, next: any) => {
    // Check local auth first
    if (req.localUser) {
      const localUser = await storage.getUser(req.localUser.userId);
      if (localUser && localUser.role === "superadmin") {
        return next();
      }
    }
    // Check Replit Auth
    if (req.user?.claims?.sub) {
      const authUserId = req.user.claims.sub;
      const user = await storage.getAuthUser(authUserId);
      if (user && user.role === "superadmin") {
        return next();
      }
    }
    return res.status(403).json({ message: "Access denied. Superadmin only." });
  };

  // Middleware that accepts either auth system
  const isEitherAuthenticated = async (req: any, res: any, next: any) => {
    // Try local auth via Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const jwt = await import("jsonwebtoken");
      try {
        const decoded = jwt.default.verify(authHeader.split(" ")[1], process.env.SESSION_SECRET!) as any;
        req.localUser = decoded;
        return next();
      } catch {}
    }
    // Fall back to Replit Auth session
    if (req.isAuthenticated && req.isAuthenticated() && req.user?.claims?.sub) {
      return next();
    }
    return res.status(401).json({ message: "Not authenticated" });
  };

  // Get admin stats
  app.get("/api/admin/stats", isEitherAuthenticated, isSuperAdmin, async (req: any, res) => {
    const stats = await storage.getAdminStats();
    res.json(stats);
  });

  // Get all users
  app.get("/api/admin/users", isEitherAuthenticated, isSuperAdmin, async (req: any, res) => {
    const replitUsers = await storage.getAllAuthUsers();
    const localUsers = await storage.getAllLocalUsers();
    const combinedUsers = [
      ...replitUsers,
      ...localUsers.map(u => ({
        id: `local_${u.id}`,
        email: null,
        firstName: u.username,
        lastName: null,
        profileImageUrl: null,
        role: u.role,
        createdAt: u.createdAt,
        updatedAt: u.createdAt,
      }))
    ];
    res.json(combinedUsers);
  });

  // Get all matches (admin view)
  app.get("/api/admin/matches", isEitherAuthenticated, isSuperAdmin, async (req: any, res) => {
    const allMatches = await storage.getAllMatches();
    const matchesWithOwner = await Promise.all(allMatches.map(async (match) => {
      let owner = null;
      if (match.authUserId) {
        if (match.authUserId.startsWith("local_")) {
          const localUserId = Number(match.authUserId.replace("local_", ""));
          const localUser = await storage.getUser(localUserId);
          if (localUser) {
            owner = { id: match.authUserId, firstName: localUser.username, lastName: null, email: null, profileImageUrl: null, role: localUser.role };
          }
        } else {
          owner = await storage.getAuthUser(match.authUserId);
        }
      }
      return { ...match, owner };
    }));
    res.json(matchesWithOwner);
  });

  // Edit user (superadmin) - update username, password, role for local users
  app.patch("/api/admin/users/:id", isEitherAuthenticated, isSuperAdmin, async (req: any, res) => {
    const userId = req.params.id;
    const { username, password, role } = req.body;
    
    if (userId.startsWith("local_")) {
      const localUserId = Number(userId.replace("local_", ""));
      const user = await storage.getUser(localUserId);
      if (!user) return res.status(404).json({ message: "User not found" });
      
      if (username && username !== user.username) {
        const existing = await storage.getUserByUsername(username);
        if (existing) return res.status(400).json({ message: "El nombre de usuario ya existe" });
        await db.update(users).set({ username }).where(eq(users.id, localUserId));
      }
      if (password) {
        const bcrypt = await import("bcrypt");
        const hashedPassword = await bcrypt.hash(password, 10);
        await storage.updateUserPassword(localUserId, hashedPassword);
      }
      if (role && ["user", "superadmin"].includes(role)) {
        await storage.updateUserRole(localUserId, role);
      }
      
      const updated = await storage.getUser(localUserId);
      return res.json({ 
        id: userId, 
        firstName: updated?.username, 
        lastName: null, 
        email: null, 
        profileImageUrl: null, 
        role: updated?.role,
        createdAt: updated?.createdAt 
      });
    }
    
    // Replit auth users - only role can be changed
    if (role && ["user", "superadmin"].includes(role)) {
      const updated = await storage.updateAuthUserRole(userId, role);
      if (!updated) return res.status(404).json({ message: "User not found" });
      return res.json(updated);
    }
    
    return res.status(400).json({ message: "No editable fields provided" });
  });

  // Update user role
  app.patch("/api/admin/users/:id/role", isEitherAuthenticated, isSuperAdmin, async (req: any, res) => {
    const userId = req.params.id;
    const { role } = req.body;
    if (!["user", "superadmin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }
    if (userId.startsWith("local_")) {
      const localUserId = Number(userId.replace("local_", ""));
      await storage.updateUserRole(localUserId, role);
      const user = await storage.getUser(localUserId);
      return res.json(user ? { id: userId, firstName: user.username, role: user.role } : null);
    }
    const updated = await storage.updateAuthUserRole(userId, role);
    if (!updated) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(updated);
  });

  // Delete user (admin)
  app.delete("/api/admin/users/:id", isEitherAuthenticated, isSuperAdmin, async (req: any, res) => {
    const userId = req.params.id;
    const currentAuthUserId = await getOptionalAuthUserId(req);
    
    if (userId === currentAuthUserId) {
      return res.status(400).json({ message: "Cannot delete your own account" });
    }
    
    if (userId.startsWith("local_")) {
      const localUserId = Number(userId.replace("local_", ""));
      await db.delete(users).where(eq(users.id, localUserId));
    } else {
      await storage.deleteAuthUser(userId);
    }
    res.json({ success: true });
  });

  // Delete match (admin)
  app.delete("/api/admin/matches/:id", isEitherAuthenticated, isSuperAdmin, async (req: any, res) => {
    const matchId = Number(req.params.id);
    await storage.deleteMatch(matchId);
    res.json({ success: true });
  });

  // Assign match to user
  app.patch("/api/admin/matches/:id/assign", isEitherAuthenticated, isSuperAdmin, async (req: any, res) => {
    const matchId = Number(req.params.id);
    const { authUserId } = req.body; // Can be null to unassign
    
    const updated = await storage.assignMatchToUser(matchId, authUserId || null);
    if (!updated) {
      return res.status(404).json({ message: "Match not found" });
    }
    res.json(updated);
  });

  // Check if current user is superadmin (supports both auth systems)
  app.get("/api/admin/check", isEitherAuthenticated, async (req: any, res) => {
    // Check local auth
    if (req.localUser) {
      const localUser = await storage.getUser(req.localUser.userId);
      if (localUser && localUser.role === "superadmin") {
        return res.json({ isSuperAdmin: true });
      }
    }
    // Check Replit Auth
    if (req.user?.claims?.sub) {
      const authUserId = req.user.claims.sub;
      const user = await storage.getAuthUser(authUserId);
      return res.json({ isSuperAdmin: user?.role === "superadmin" });
    }
    res.json({ isSuperAdmin: false });
  });

  // Background task: auto-finalize matches inactive for 24h, auto-pause timer for 90min inactive
  setInterval(async () => {
    try {
      const allMatches = await storage.getAllMatches();
      const now = Date.now();
      const NINETY_MINUTES = 90 * 60 * 1000;
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

      for (const match of allMatches) {
        if (match.status === MATCH_STATUS.FINISHED || match.status === MATCH_STATUS.SCHEDULED) continue;
        
        const lastActivity = new Date(match.lastActivityAt).getTime();
        const inactiveMs = now - lastActivity;

        // Auto-finalize after 24h of inactivity
        if (inactiveMs >= TWENTY_FOUR_HOURS) {
          let elapsed = match.timerElapsedSeconds;
          if (match.timerStartTime) {
            elapsed += Math.floor((now - new Date(match.timerStartTime).getTime()) / 1000);
          }
          await storage.updateMatch(match.id, { 
            status: MATCH_STATUS.FINISHED, 
            timerStartTime: null,
            timerElapsedSeconds: elapsed,
          });
          const existingEvents = await storage.getMatchEvents(match.id);
          const hasAutoFinishEvent = existingEvents.some(e => e.description === 'Finalizado automáticamente por inactividad');
          if (!hasAutoFinishEvent) {
            await storage.createEvent({
              matchId: match.id,
              type: 'whistle',
              team: null,
              player: null,
              minute: Math.floor(elapsed / 60),
              half: match.status === MATCH_STATUS.SECOND_HALF ? 2 : 1,
              description: 'Finalizado automáticamente por inactividad',
            });
          }
          console.log(`Auto-finalized match ${match.id} after 24h inactivity`);
        }
        // Auto-pause timer after 90min of inactivity (stop running timer)
        else if (inactiveMs >= NINETY_MINUTES && match.timerStartTime) {
          let elapsed = match.timerElapsedSeconds;
          elapsed += Math.floor((now - new Date(match.timerStartTime).getTime()) / 1000);
          await storage.updateMatch(match.id, {
            timerStartTime: null,
            timerElapsedSeconds: elapsed,
          });
          console.log(`Auto-paused timer for match ${match.id} after 90min inactivity`);
        }
      }
    } catch (err) {
      console.error('Auto-cleanup error:', err);
    }
  }, 5 * 60 * 1000); // Run every 5 minutes

  return httpServer;
}

// Helper to check if user has admin access (owner or PIN)
function hasAdminAccess(match: any, pin?: string, authUserId?: string): boolean {
  if (match.authUserId && authUserId && match.authUserId === authUserId) {
    return true;
  }
  if (match.userId && authUserId && authUserId.startsWith("local_")) {
    const localUserId = Number(authUserId.replace("local_", ""));
    if (match.userId === localUserId) return true;
  }
  if (match.adminPin && pin && match.adminPin === pin) {
    return true;
  }
  return false;
}

async function hasExtendedAdminAccess(match: any, pin?: string, authUserId?: string): Promise<boolean> {
  if (hasAdminAccess(match, pin, authUserId)) return true;
  if (!authUserId || !authUserId.startsWith("local_")) return false;
  const localUserId = Number(authUserId.replace("local_", ""));
  const user = await storage.getUser(localUserId);
  if (!user) return false;
  if (user.role === "superadmin") return true;
  const matchday = await storage.getClubMatchdayByMatchId(match.id);
  if (!matchday) return false;
  const club = await storage.getClub(matchday.clubId);
  if (club && club.coordinatorUserId === localUserId) return true;
  return false;
}

// Helper to optionally get authUserId from request (without requiring auth)
async function getOptionalAuthUserId(req: any): Promise<string | undefined> {
  try {
    // Check local auth first
    if (req.localUser) return `local_${req.localUser.userId}`;
    // Check for local auth via Authorization header
    const authHeader = req.headers?.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const jwt = await import("jsonwebtoken");
        const decoded = jwt.default.verify(authHeader.split(" ")[1], process.env.SESSION_SECRET!) as any;
        return `local_${decoded.userId}`;
      } catch {}
    }
    // Fall back to Replit Auth
    return req.user?.claims?.sub;
  } catch {
    return undefined;
  }
}

function calculateCurrentMinute(match: any): number {
    let seconds = match.timerElapsedSeconds;
    if (match.timerStartTime) {
        seconds += Math.floor((Date.now() - new Date(match.timerStartTime).getTime()) / 1000);
    }
    return Math.floor(seconds / 60);
}

function formatStatus(status: string): string {
    const statusMap: Record<string, string> = {
        [MATCH_STATUS.SCHEDULED]: "Programado",
        [MATCH_STATUS.FIRST_HALF]: "Inicio del partido",
        [MATCH_STATUS.HALFTIME]: "Descanso",
        [MATCH_STATUS.SECOND_HALF]: "Inicio segunda parte",
        [MATCH_STATUS.FINISHED]: "Finalizado",
    };
    return statusMap[status] || status.toUpperCase();
}

function getHalfNumber(status: string): number {
    if (status === MATCH_STATUS.SECOND_HALF || status === MATCH_STATUS.FINISHED) {
        return 2;
    }
    return 1;
}

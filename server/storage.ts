import { db } from "./db";
import { matches, matchEvents, matchSpectators, users, folders, teams, clubs, clubBranches, clubDelegates, clubTeams, clubPlayers, clubMatchdays, clubSponsors, type Match, type InsertMatch, type InsertUserMatch, type MatchEvent, type InsertMatchEvent, type MatchStatus, type User, type InsertUser, type Folder, type InsertFolder, type Team, type InsertTeam, type Club, type InsertClub, type ClubBranch, type InsertClubBranch, type ClubDelegate, type InsertClubDelegate, type ClubTeam, type InsertClubTeam, type ClubPlayer, type InsertClubPlayer, type ClubMatchday, type InsertClubMatchday, type ClubSponsor, type InsertClubSponsor, MATCH_STATUS } from "@shared/schema";
import { authUsers, type AuthUser, type UserRole } from "@shared/models/auth";
import { eq, desc, and, gt, not, count, sql, or, inArray } from "drizzle-orm";

export interface IStorage {
  // Users (local auth)
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUserByRecoveryContact(contact: string): Promise<User | undefined>;
  setRecoveryCode(userId: number, code: string, expiresAt: Date): Promise<void>;
  clearRecoveryCode(userId: number): Promise<void>;
  updateUserPassword(userId: number, hashedPassword: string): Promise<void>;
  updateUserRecovery(userId: number, updates: { recoveryEmail?: string | null; recoveryPhone?: string | null }): Promise<void>;

  // Folders
  createFolder(userId: number, folder: InsertFolder): Promise<Folder>;
  getFolders(userId: number): Promise<Folder[]>;
  deleteFolder(id: number, userId: number): Promise<void>;

  // Matches
  createMatch(match: (InsertMatch | InsertUserMatch) & { userId?: number; folderId?: number; authUserId?: string }): Promise<Match>;
  getMatch(id: number): Promise<Match | undefined>;
  getUserMatches(userId: number): Promise<Match[]>;
  getFolderMatches(folderId: number): Promise<Match[]>;
  updateMatch(id: number, updates: Partial<Match>): Promise<Match>;
  getActiveMatches(): Promise<Match[]>;
  getAllMatches(): Promise<Match[]>;
  deleteMatch(id: number): Promise<void>;
  
  // Events
  getMatchEvents(matchId: number): Promise<MatchEvent[]>;
  createEvent(event: InsertMatchEvent): Promise<MatchEvent>;
  updateEvent(id: number, updates: Partial<MatchEvent>): Promise<MatchEvent>;
  deleteEvent(id: number): Promise<void>;

  // Teams
  createTeam(authUserId: string, team: InsertTeam): Promise<Team>;
  getTeams(authUserId: string): Promise<Team[]>;
  getTeam(id: number): Promise<Team | undefined>;
  updateTeam(id: number, authUserId: string, updates: Partial<Team>): Promise<Team>;
  deleteTeam(id: number, authUserId: string): Promise<void>;

  // User Matches (by authUserId)
  getAuthUserMatches(authUserId: string): Promise<Match[]>;
  getUserMatchesByUserId(userId: number): Promise<Match[]>;

  // Spectators
  addSpectator(matchId: number, visitorId: string): Promise<boolean>;
  getSpectatorCount(matchId: number): Promise<number>;

  // Admin operations
  getAllAuthUsers(): Promise<AuthUser[]>;
  getAuthUser(id: string): Promise<AuthUser | undefined>;
  updateAuthUserRole(id: string, role: UserRole): Promise<AuthUser | undefined>;
  deleteAuthUser(id: string): Promise<void>;
  assignMatchToUser(matchId: number, newAuthUserId: string | null): Promise<Match | undefined>;
  getAdminStats(): Promise<{ totalUsers: number; finishedMatches: number; activeMatches: number }>;

  // Club operations
  createClub(club: InsertClub): Promise<Club>;
  getClub(id: number): Promise<Club | undefined>;
  getClubBySlug(slug: string): Promise<Club | undefined>;
  getAllClubs(): Promise<Club[]>;
  getClubsByCoordinator(userId: number): Promise<Club[]>;
  updateClub(id: number, updates: Partial<Club>): Promise<Club>;
  deleteClub(id: number): Promise<void>;

  // Club branches
  createClubBranch(branch: InsertClubBranch): Promise<ClubBranch>;
  getClubBranches(clubId: number): Promise<ClubBranch[]>;
  updateClubBranch(id: number, updates: Partial<ClubBranch>): Promise<ClubBranch>;
  deleteClubBranch(id: number): Promise<void>;

  // Club delegates
  createClubDelegate(delegate: InsertClubDelegate & { pin: string }): Promise<ClubDelegate>;
  getClubDelegates(clubId: number): Promise<ClubDelegate[]>;
  getClubDelegate(id: number): Promise<ClubDelegate | undefined>;
  getClubDelegateByPin(clubId: number, pin: string): Promise<ClubDelegate | undefined>;
  updateClubDelegate(id: number, updates: Partial<ClubDelegate>): Promise<ClubDelegate>;
  deleteClubDelegate(id: number): Promise<void>;

  // Club teams
  createClubTeam(clubId: number, team: InsertClubTeam): Promise<ClubTeam>;
  getClubTeams(clubId: number): Promise<ClubTeam[]>;
  getClubTeam(id: number): Promise<ClubTeam | undefined>;
  getClubTeamsByDelegate(delegateId: number): Promise<ClubTeam[]>;
  updateClubTeam(id: number, updates: Partial<ClubTeam>): Promise<ClubTeam>;
  deleteClubTeam(id: number): Promise<void>;

  // Club players
  createClubPlayer(player: InsertClubPlayer): Promise<ClubPlayer>;
  getClubPlayers(teamId: number): Promise<ClubPlayer[]>;
  updateClubPlayer(id: number, updates: Partial<ClubPlayer>): Promise<ClubPlayer>;
  deleteClubPlayer(id: number): Promise<void>;

  // Club matchdays
  createClubMatchday(clubId: number, matchday: InsertClubMatchday): Promise<ClubMatchday>;
  getClubMatchdays(teamId: number): Promise<ClubMatchday[]>;
  getClubMatchdaysByClub(clubId: number): Promise<ClubMatchday[]>;
  getClubMatchday(id: number): Promise<ClubMatchday | undefined>;
  getClubMatchdayByMatchId(matchId: number): Promise<ClubMatchday | undefined>;
  updateClubMatchday(id: number, updates: Partial<ClubMatchday>): Promise<ClubMatchday>;
  deleteClubMatchday(id: number): Promise<void>;

  // Club sponsors
  createClubSponsor(sponsor: InsertClubSponsor): Promise<ClubSponsor>;
  getClubSponsor(id: number): Promise<ClubSponsor | undefined>;
  getClubSponsors(clubId: number): Promise<ClubSponsor[]>;
  updateClubSponsor(id: number, updates: Partial<ClubSponsor>): Promise<ClubSponsor>;
  deleteClubSponsor(id: number): Promise<void>;

  // Local users for admin
  getAllLocalUsers(): Promise<User[]>;
  updateUserRole(userId: number, role: string): Promise<void>;
}

// Initialize superadmin on startup
async function initializeSuperAdmin() {
  const superAdminEmail = "miguelangel.perezona@gmail.com";
  try {
    const [existingUser] = await db.select().from(authUsers).where(eq(authUsers.email, superAdminEmail));
    if (existingUser && existingUser.role !== 'superadmin') {
      await db.update(authUsers).set({ role: 'superadmin' }).where(eq(authUsers.email, superAdminEmail));
      console.log(`[init] Updated ${superAdminEmail} to superadmin role`);
    }
  } catch (error) {
    console.log('[init] Could not initialize superadmin:', error);
  }
}

// Run initialization
initializeSuperAdmin();

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getUserByRecoveryContact(contact: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(
      or(
        eq(users.recoveryEmail, contact),
        eq(users.recoveryPhone, contact)
      )
    );
    return user;
  }

  async setRecoveryCode(userId: number, code: string, expiresAt: Date): Promise<void> {
    await db.update(users).set({ recoveryCode: code, recoveryCodeExpiresAt: expiresAt }).where(eq(users.id, userId));
  }

  async clearRecoveryCode(userId: number): Promise<void> {
    await db.update(users).set({ recoveryCode: null, recoveryCodeExpiresAt: null }).where(eq(users.id, userId));
  }

  async updateUserPassword(userId: number, hashedPassword: string): Promise<void> {
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));
  }

  async updateUserRecovery(userId: number, updates: { recoveryEmail?: string | null; recoveryPhone?: string | null }): Promise<void> {
    await db.update(users).set(updates).where(eq(users.id, userId));
  }

  async createFolder(userId: number, folder: InsertFolder): Promise<Folder> {
    const [newFolder] = await db.insert(folders).values({ ...folder, userId }).returning();
    return newFolder;
  }

  async getFolders(userId: number): Promise<Folder[]> {
    return db.select().from(folders).where(eq(folders.userId, userId));
  }

  async deleteFolder(id: number, userId: number): Promise<void> {
    await db.delete(folders).where(and(eq(folders.id, id), eq(folders.userId, userId)));
  }

  async createMatch(match: (InsertMatch | InsertUserMatch) & { userId?: number; folderId?: number; authUserId?: string }): Promise<Match> {
    const [newMatch] = await db.insert(matches).values(match as any).returning();
    return newMatch;
  }

  async getMatch(id: number): Promise<Match | undefined> {
    const [match] = await db.select().from(matches).where(eq(matches.id, id));
    return match;
  }

  async getUserMatches(userId: number): Promise<Match[]> {
    return db.select().from(matches).where(eq(matches.userId, userId));
  }

  async getFolderMatches(folderId: number): Promise<Match[]> {
    return db.select().from(matches).where(eq(matches.folderId, folderId));
  }

  async updateMatch(id: number, updates: Partial<Match>): Promise<Match> {
    const [updatedMatch] = await db
      .update(matches)
      .set({ ...updates, lastActivityAt: new Date() })
      .where(eq(matches.id, id))
      .returning();
    return updatedMatch;
  }

  async getActiveMatches(): Promise<Match[]> {
    // A match is active if its status is not finished AND it had activity in the last 4 hours
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    return db.select()
      .from(matches)
      .where(
        and(
          not(eq(matches.status, MATCH_STATUS.FINISHED)),
          gt(matches.lastActivityAt, fourHoursAgo)
        )
      )
      .orderBy(desc(matches.lastActivityAt));
  }

  async getAllMatches(): Promise<Match[]> {
    return db.select()
      .from(matches)
      .orderBy(desc(matches.createdAt));
  }

  async deleteMatch(id: number): Promise<void> {
    await db.delete(matchEvents).where(eq(matchEvents.matchId, id));
    await db.delete(matchSpectators).where(eq(matchSpectators.matchId, id));
    await db.delete(matches).where(eq(matches.id, id));
  }

  async getMatchEvents(matchId: number): Promise<MatchEvent[]> {
    return db
      .select()
      .from(matchEvents)
      .where(eq(matchEvents.matchId, matchId))
      .orderBy(desc(matchEvents.createdAt));
  }

  async createEvent(event: InsertMatchEvent): Promise<MatchEvent> {
    const [newEvent] = await db.insert(matchEvents).values(event).returning();
    return newEvent;
  }

  async updateEvent(id: number, updates: Partial<MatchEvent>): Promise<MatchEvent> {
    const [updated] = await db.update(matchEvents).set(updates).where(eq(matchEvents.id, id)).returning();
    return updated;
  }

  async deleteEvent(id: number): Promise<void> {
    await db.delete(matchEvents).where(eq(matchEvents.id, id));
  }

  // Teams
  async createTeam(authUserId: string, team: InsertTeam): Promise<Team> {
    const [newTeam] = await db.insert(teams).values({ ...team, authUserId }).returning();
    return newTeam;
  }

  async getTeams(authUserId: string): Promise<Team[]> {
    return db.select().from(teams).where(eq(teams.authUserId, authUserId)).orderBy(desc(teams.createdAt));
  }

  async getTeam(id: number): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team;
  }

  async updateTeam(id: number, authUserId: string, updates: Partial<Team>): Promise<Team> {
    const [updated] = await db
      .update(teams)
      .set(updates)
      .where(and(eq(teams.id, id), eq(teams.authUserId, authUserId)))
      .returning();
    return updated;
  }

  async deleteTeam(id: number, authUserId: string): Promise<void> {
    await db.delete(teams).where(and(eq(teams.id, id), eq(teams.authUserId, authUserId)));
  }

  // User Matches (by authUserId)
  async getAuthUserMatches(authUserId: string): Promise<Match[]> {
    return db.select()
      .from(matches)
      .where(eq(matches.authUserId, authUserId))
      .orderBy(desc(matches.createdAt));
  }

  async getUserMatchesByUserId(userId: number): Promise<Match[]> {
    return db.select()
      .from(matches)
      .where(eq(matches.userId, userId))
      .orderBy(desc(matches.createdAt));
  }

  // Spectators - returns true if this is a new unique visitor
  async addSpectator(matchId: number, visitorId: string): Promise<boolean> {
    const existing = await db.select()
      .from(matchSpectators)
      .where(and(eq(matchSpectators.matchId, matchId), eq(matchSpectators.visitorId, visitorId)))
      .limit(1);
    
    if (existing.length > 0) {
      return false;
    }
    
    await db.insert(matchSpectators).values({ matchId, visitorId });
    return true;
  }

  async getSpectatorCount(matchId: number): Promise<number> {
    const result = await db.select({ count: count() })
      .from(matchSpectators)
      .where(eq(matchSpectators.matchId, matchId));
    
    return result[0]?.count || 0;
  }

  // Admin operations
  async getAllAuthUsers(): Promise<AuthUser[]> {
    return db.select().from(authUsers).orderBy(desc(authUsers.createdAt));
  }

  async getAuthUser(id: string): Promise<AuthUser | undefined> {
    const [user] = await db.select().from(authUsers).where(eq(authUsers.id, id));
    return user;
  }

  async updateAuthUserRole(id: string, role: UserRole): Promise<AuthUser | undefined> {
    const [updated] = await db
      .update(authUsers)
      .set({ role, updatedAt: new Date() })
      .where(eq(authUsers.id, id))
      .returning();
    return updated;
  }

  async deleteAuthUser(id: string): Promise<void> {
    // Delete user's matches and associated events/spectators first
    const userMatches = await db.select().from(matches).where(eq(matches.authUserId, id));
    for (const match of userMatches) {
      await db.delete(matchEvents).where(eq(matchEvents.matchId, match.id));
      await db.delete(matchSpectators).where(eq(matchSpectators.matchId, match.id));
    }
    await db.delete(matches).where(eq(matches.authUserId, id));
    // Delete user's teams
    await db.delete(teams).where(eq(teams.authUserId, id));
    // Finally delete the user
    await db.delete(authUsers).where(eq(authUsers.id, id));
  }

  async assignMatchToUser(matchId: number, newAuthUserId: string | null): Promise<Match | undefined> {
    const [updated] = await db
      .update(matches)
      .set({ authUserId: newAuthUserId, adminPin: null, lastActivityAt: new Date() })
      .where(eq(matches.id, matchId))
      .returning();
    return updated;
  }

  async getAdminStats(): Promise<{ totalUsers: number; finishedMatches: number; activeMatches: number }> {
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    
    const [usersResult] = await db.select({ count: count() }).from(authUsers);
    const [finishedResult] = await db.select({ count: count() })
      .from(matches)
      .where(eq(matches.status, MATCH_STATUS.FINISHED));
    const [activeResult] = await db.select({ count: count() })
      .from(matches)
      .where(
        and(
          not(eq(matches.status, MATCH_STATUS.FINISHED)),
          gt(matches.lastActivityAt, fourHoursAgo)
        )
      );
    
    return {
      totalUsers: usersResult?.count || 0,
      finishedMatches: finishedResult?.count || 0,
      activeMatches: activeResult?.count || 0
    };
  }

  // ============ CLUB OPERATIONS ============

  async createClub(club: InsertClub): Promise<Club> {
    const [newClub] = await db.insert(clubs).values(club).returning();
    return newClub;
  }

  async getClub(id: number): Promise<Club | undefined> {
    const [club] = await db.select().from(clubs).where(eq(clubs.id, id));
    return club;
  }

  async getClubBySlug(slug: string): Promise<Club | undefined> {
    const [club] = await db.select().from(clubs).where(eq(clubs.slug, slug));
    return club;
  }

  async getAllClubs(): Promise<Club[]> {
    return db.select().from(clubs).orderBy(desc(clubs.createdAt));
  }

  async getClubsByCoordinator(userId: number): Promise<Club[]> {
    return db.select().from(clubs).where(eq(clubs.coordinatorUserId, userId)).orderBy(desc(clubs.createdAt));
  }

  async updateClub(id: number, updates: Partial<Club>): Promise<Club> {
    const [updated] = await db.update(clubs).set(updates).where(eq(clubs.id, id)).returning();
    return updated;
  }

  async deleteClub(id: number): Promise<void> {
    const clubTeamsList = await db.select().from(clubTeams).where(eq(clubTeams.clubId, id));
    for (const team of clubTeamsList) {
      await db.delete(clubPlayers).where(eq(clubPlayers.teamId, team.id));
    }
    await db.delete(clubMatchdays).where(eq(clubMatchdays.clubId, id));
    await db.delete(clubTeams).where(eq(clubTeams.clubId, id));
    await db.delete(clubDelegates).where(eq(clubDelegates.clubId, id));
    await db.delete(clubBranches).where(eq(clubBranches.clubId, id));
    await db.delete(clubSponsors).where(eq(clubSponsors.clubId, id));
    await db.delete(clubs).where(eq(clubs.id, id));
  }

  // Club branches
  async createClubBranch(branch: InsertClubBranch): Promise<ClubBranch> {
    const [newBranch] = await db.insert(clubBranches).values(branch).returning();
    return newBranch;
  }

  async getClubBranches(clubId: number): Promise<ClubBranch[]> {
    return db.select().from(clubBranches).where(eq(clubBranches.clubId, clubId));
  }

  async updateClubBranch(id: number, updates: Partial<ClubBranch>): Promise<ClubBranch> {
    const [updated] = await db.update(clubBranches).set(updates).where(eq(clubBranches.id, id)).returning();
    return updated;
  }

  async deleteClubBranch(id: number): Promise<void> {
    await db.delete(clubBranches).where(eq(clubBranches.id, id));
  }

  // Club delegates
  async createClubDelegate(delegate: InsertClubDelegate & { pin: string }): Promise<ClubDelegate> {
    const [newDelegate] = await db.insert(clubDelegates).values(delegate).returning();
    return newDelegate;
  }

  async getClubDelegates(clubId: number): Promise<ClubDelegate[]> {
    return db.select().from(clubDelegates).where(eq(clubDelegates.clubId, clubId));
  }

  async getClubDelegate(id: number): Promise<ClubDelegate | undefined> {
    const [delegate] = await db.select().from(clubDelegates).where(eq(clubDelegates.id, id));
    return delegate;
  }

  async getClubDelegateByPin(clubId: number, pin: string): Promise<ClubDelegate | undefined> {
    const [delegate] = await db.select().from(clubDelegates)
      .where(and(eq(clubDelegates.clubId, clubId), eq(clubDelegates.pin, pin)));
    return delegate;
  }

  async updateClubDelegate(id: number, updates: Partial<ClubDelegate>): Promise<ClubDelegate> {
    const [updated] = await db.update(clubDelegates).set(updates).where(eq(clubDelegates.id, id)).returning();
    return updated;
  }

  async deleteClubDelegate(id: number): Promise<void> {
    await db.update(clubTeams).set({ delegateId: null }).where(eq(clubTeams.delegateId, id));
    await db.delete(clubDelegates).where(eq(clubDelegates.id, id));
  }

  // Club teams
  async createClubTeam(clubId: number, team: InsertClubTeam): Promise<ClubTeam> {
    const [newTeam] = await db.insert(clubTeams).values({ ...team, clubId }).returning();
    return newTeam;
  }

  async getClubTeams(clubId: number): Promise<ClubTeam[]> {
    return db.select().from(clubTeams).where(eq(clubTeams.clubId, clubId)).orderBy(clubTeams.name);
  }

  async getClubTeam(id: number): Promise<ClubTeam | undefined> {
    const [team] = await db.select().from(clubTeams).where(eq(clubTeams.id, id));
    return team;
  }

  async getClubTeamsByDelegate(delegateId: number): Promise<ClubTeam[]> {
    return db.select().from(clubTeams).where(eq(clubTeams.delegateId, delegateId));
  }

  async updateClubTeam(id: number, updates: Partial<ClubTeam>): Promise<ClubTeam> {
    const [updated] = await db.update(clubTeams).set(updates).where(eq(clubTeams.id, id)).returning();
    return updated;
  }

  async deleteClubTeam(id: number): Promise<void> {
    await db.delete(clubPlayers).where(eq(clubPlayers.teamId, id));
    await db.delete(clubMatchdays).where(eq(clubMatchdays.teamId, id));
    await db.delete(clubTeams).where(eq(clubTeams.id, id));
  }

  // Club players
  async createClubPlayer(player: InsertClubPlayer): Promise<ClubPlayer> {
    const [newPlayer] = await db.insert(clubPlayers).values(player).returning();
    return newPlayer;
  }

  async getClubPlayers(teamId: number): Promise<ClubPlayer[]> {
    return db.select().from(clubPlayers).where(eq(clubPlayers.teamId, teamId)).orderBy(clubPlayers.number);
  }

  async updateClubPlayer(id: number, updates: Partial<ClubPlayer>): Promise<ClubPlayer> {
    const [updated] = await db.update(clubPlayers).set(updates).where(eq(clubPlayers.id, id)).returning();
    return updated;
  }

  async deleteClubPlayer(id: number): Promise<void> {
    await db.delete(clubPlayers).where(eq(clubPlayers.id, id));
  }

  // Club matchdays
  async createClubMatchday(clubId: number, matchday: InsertClubMatchday): Promise<ClubMatchday> {
    const [newMatchday] = await db.insert(clubMatchdays).values({ ...matchday, clubId }).returning();
    return newMatchday;
  }

  async getClubMatchdays(teamId: number): Promise<ClubMatchday[]> {
    return db.select().from(clubMatchdays).where(eq(clubMatchdays.teamId, teamId)).orderBy(desc(clubMatchdays.date));
  }

  async getClubMatchdaysByClub(clubId: number): Promise<ClubMatchday[]> {
    return db.select().from(clubMatchdays).where(eq(clubMatchdays.clubId, clubId)).orderBy(desc(clubMatchdays.date));
  }

  async getClubMatchday(id: number): Promise<ClubMatchday | undefined> {
    const [matchday] = await db.select().from(clubMatchdays).where(eq(clubMatchdays.id, id));
    return matchday;
  }

  async getClubMatchdayByMatchId(matchId: number): Promise<ClubMatchday | undefined> {
    const [matchday] = await db.select().from(clubMatchdays).where(eq(clubMatchdays.matchId, matchId));
    return matchday;
  }

  async updateClubMatchday(id: number, updates: Partial<ClubMatchday>): Promise<ClubMatchday> {
    const [updated] = await db.update(clubMatchdays).set(updates).where(eq(clubMatchdays.id, id)).returning();
    return updated;
  }

  async deleteClubMatchday(id: number): Promise<void> {
    await db.delete(clubMatchdays).where(eq(clubMatchdays.id, id));
  }

  // Club sponsors
  async createClubSponsor(sponsor: InsertClubSponsor): Promise<ClubSponsor> {
    const [newSponsor] = await db.insert(clubSponsors).values(sponsor).returning();
    return newSponsor;
  }

  async getClubSponsor(id: number): Promise<ClubSponsor | undefined> {
    const [sponsor] = await db.select().from(clubSponsors).where(eq(clubSponsors.id, id));
    return sponsor;
  }

  async getClubSponsors(clubId: number): Promise<ClubSponsor[]> {
    return db.select().from(clubSponsors).where(eq(clubSponsors.clubId, clubId));
  }

  async updateClubSponsor(id: number, updates: Partial<ClubSponsor>): Promise<ClubSponsor> {
    const [updated] = await db.update(clubSponsors).set(updates).where(eq(clubSponsors.id, id)).returning();
    return updated;
  }

  async deleteClubSponsor(id: number): Promise<void> {
    await db.delete(clubSponsors).where(eq(clubSponsors.id, id));
  }

  // Local users for admin
  async getAllLocalUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUserRole(userId: number, role: string): Promise<void> {
    await db.update(users).set({ role }).where(eq(users.id, userId));
  }
}

export const storage = new DatabaseStorage();

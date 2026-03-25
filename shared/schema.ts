import { pgTable, text, serial, integer, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Export auth schemas for Replit Auth
export * from "./models/auth";

export const MATCH_STATUS = {
  SCHEDULED: "scheduled",
  FIRST_HALF: "first_half",
  HALFTIME: "halftime",
  SECOND_HALF: "second_half",
  FINISHED: "finished",
} as const;

export type MatchStatus = typeof MATCH_STATUS[keyof typeof MATCH_STATUS];

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").default("user").notNull(),
  recoveryEmail: text("recovery_email"),
  recoveryPhone: text("recovery_phone"),
  recoveryCode: text("recovery_code"),
  recoveryCodeExpiresAt: timestamp("recovery_code_expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const folders = pgTable("folders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Teams table for saved favorite teams
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  authUserId: varchar("auth_user_id").notNull(),
  name: text("name").notNull(),
  color: text("color").default("#3b82f6").notNull(),
  logoUrl: text("logo_url"),
  category: text("category"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  authUserId: varchar("auth_user_id"),
  folderId: integer("folder_id"),
  adminPin: varchar("admin_pin", { length: 4 }),
  localTeam: text("local_team").notNull(),
  awayTeam: text("away_team").notNull(),
  localTeamColor: text("local_team_color").default("#3b82f6").notNull(),
  awayTeamColor: text("away_team_color").default("#ef4444").notNull(),
  localTeamLogo: text("local_team_logo"),
  awayTeamLogo: text("away_team_logo"),
  localScore: integer("local_score").default(0).notNull(),
  awayScore: integer("away_score").default(0).notNull(),
  status: text("status").$type<MatchStatus>().default(MATCH_STATUS.SCHEDULED).notNull(),
  timerStartTime: timestamp("timer_start_time"), 
  timerElapsedSeconds: integer("timer_elapsed_seconds").default(0).notNull(),
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
  scheduledDate: timestamp("scheduled_date"),
  scheduledTime: text("scheduled_time"),
  venue: text("venue"),
  category: text("category"),
  league: text("league"),
  spectatorCount: integer("spectator_count").default(0).notNull(),
  lastSpectatorUpdateAt: timestamp("last_spectator_update_at"),
  chronicle: text("chronicle"),
  summaryImageUrl: text("summary_image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const matchEvents = pgTable("match_events", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull(),
  type: text("type").notNull(),
  team: text("team"),
  player: text("player"),
  minute: integer("minute").notNull(),
  half: integer("half").default(1).notNull(),
  description: text("description"),
  currentScore: text("current_score"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const matchSpectators = pgTable("match_spectators", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull(),
  visitorId: text("visitor_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ 
  id: true, 
  createdAt: true, 
  recoveryCode: true, 
  recoveryCodeExpiresAt: true 
});

export const registerUserSchema = z.object({
  username: z.string()
    .min(3, "El usuario debe tener al menos 3 caracteres")
    .max(20, "El usuario no puede tener más de 20 caracteres")
    .regex(/^[a-zA-Z0-9_]+$/, "Solo letras, números y guion bajo"),
  password: z.string()
    .min(6, "La contraseña debe tener al menos 6 caracteres"),
  confirmPassword: z.string(),
  recoveryEmail: z.string().email("Email no válido").optional().or(z.literal("")),
  recoveryPhone: z.string().optional().or(z.literal("")),
}).refine(data => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

export const loginSchema = z.object({
  username: z.string().min(1, "Ingresa tu nombre de usuario"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});
export const insertFolderSchema = createInsertSchema(folders).omit({ id: true, createdAt: true, userId: true });
export const insertMatchSchema = createInsertSchema(matches).omit({ 
  id: true, 
  createdAt: true,
  lastActivityAt: true,
  localScore: true, 
  awayScore: true, 
  status: true,
  timerStartTime: true,
  timerElapsedSeconds: true,
  userId: true,
  authUserId: true,
  folderId: true,
  spectatorCount: true,
  lastSpectatorUpdateAt: true
}).extend({
  adminPin: z.string().length(4, "PIN must be 4 digits").regex(/^\d+$/, "PIN must be numeric"),
  localTeam: z.string().min(1, "Local team name is required"),
  awayTeam: z.string().min(1, "Away team name is required"),
});

export const insertUserMatchSchema = createInsertSchema(matches).omit({ 
  id: true, 
  createdAt: true,
  lastActivityAt: true,
  localScore: true, 
  awayScore: true, 
  status: true,
  timerStartTime: true,
  timerElapsedSeconds: true,
  userId: true,
  authUserId: true,
  folderId: true,
  adminPin: true,
  spectatorCount: true,
  lastSpectatorUpdateAt: true
}).extend({
  localTeam: z.string().min(1, "Local team name is required"),
  awayTeam: z.string().min(1, "Away team name is required"),
});

export const insertEventSchema = createInsertSchema(matchEvents).omit({ 
  id: true, 
  createdAt: true 
});

export const insertTeamSchema = createInsertSchema(teams).omit({ 
  id: true, 
  createdAt: true,
  authUserId: true
}).extend({
  name: z.string().min(1, "El nombre del equipo es obligatorio"),
  color: z.string().optional(),
  logoUrl: z.string().optional(),
  category: z.string().optional(),
});

// ============ CLUB SYSTEM TABLES ============

export const CLUB_CATEGORIES = [
  'Bebé',
  'Prebenjamín',
  'Benjamín',
  'Alevín',
  'Infantil',
  'Cadete',
  'Juvenil',
  'Senior',
  'Veterano',
  'Femenino',
] as const;

export type ClubCategory = typeof CLUB_CATEGORIES[number];

export const MATCHDAY_STATUS = {
  PENDING: "pending",
  NEXT: "next",
  PLAYED: "played",
} as const;

export type MatchdayStatus = typeof MATCHDAY_STATUS[keyof typeof MATCHDAY_STATUS];

export const clubs = pgTable("clubs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").default("#1e40af").notNull(),
  secondaryColor: text("secondary_color").default("#ffffff").notNull(),
  coordinatorUserId: integer("coordinator_user_id"),
  status: text("status").default("active").notNull(),
  chronicleTone: text("chronicle_tone").default("cercano"),
  chronicleCustomTone: text("chronicle_custom_tone"),
  chronicleMentionScorers: boolean("chronicle_mention_scorers").default(true),
  chronicleHideBlowout: boolean("chronicle_hide_blowout").default(true),
  chronicleBlowoutThreshold: integer("chronicle_blowout_threshold").default(4),
  chronicleSlogans: text("chronicle_slogans").array(),
  chronicleValues: text("chronicle_values").array(),
  chronicleExtraInstructions: text("chronicle_extra_instructions"),
  templateMatchday: text("template_matchday").default("classic"),
  templateResult: text("template_result").default("classic"),
  templateWeekly: text("template_weekly").default("classic"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const clubBranches = pgTable("club_branches", {
  id: serial("id").primaryKey(),
  clubId: integer("club_id").notNull(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const clubDelegates = pgTable("club_delegates", {
  id: serial("id").primaryKey(),
  clubId: integer("club_id").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  pin: varchar("pin", { length: 4 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const clubTeams = pgTable("club_teams", {
  id: serial("id").primaryKey(),
  clubId: integer("club_id").notNull(),
  branchId: integer("branch_id"),
  name: text("name").notNull(),
  category: text("category").notNull(),
  league: text("league"),
  color: text("color").default("#3b82f6").notNull(),
  fieldName: text("field_name"),
  delegateId: integer("delegate_id"),
  sponsorId: integer("sponsor_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const clubPlayers = pgTable("club_players", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(),
  name: text("name").notNull(),
  number: integer("number"),
  position: text("position"),
  goals: integer("goals").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const clubMatchdays = pgTable("club_matchdays", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(),
  clubId: integer("club_id").notNull(),
  matchdayNumber: integer("matchday_number"),
  date: timestamp("date"),
  time: text("time"),
  rival: text("rival").notNull(),
  venue: text("venue"),
  isHome: boolean("is_home").default(true).notNull(),
  status: text("status").default("pending").notNull(),
  matchId: integer("match_id"),
  resultHome: integer("result_home"),
  resultAway: integer("result_away"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const clubSponsors = pgTable("club_sponsors", {
  id: serial("id").primaryKey(),
  clubId: integer("club_id").notNull(),
  teamId: integer("team_id"),
  name: text("name").notNull(),
  description: text("description"),
  logoUrl: text("logo_url"),
  websiteUrl: text("website_url"),
  tier: text("tier").default("standard").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Club insert schemas
export const insertClubSchema = createInsertSchema(clubs).omit({
  id: true,
  createdAt: true,
}).extend({
  name: z.string().min(1, "El nombre del club es obligatorio"),
  slug: z.string().min(1, "El slug es obligatorio").regex(/^[a-z0-9-]+$/, "Solo letras minúsculas, números y guiones"),
});

export const insertClubBranchSchema = createInsertSchema(clubBranches).omit({
  id: true,
  createdAt: true,
  clubId: true,
}).extend({
  name: z.string().min(1, "El nombre de la filial es obligatorio"),
});

export const insertClubDelegateSchema = createInsertSchema(clubDelegates).omit({
  id: true,
  createdAt: true,
  pin: true,
  clubId: true,
}).extend({
  name: z.string().min(1, "El nombre del delegado es obligatorio"),
});

export const insertClubTeamSchema = createInsertSchema(clubTeams).omit({
  id: true,
  createdAt: true,
  clubId: true,
  delegateId: true,
  sponsorId: true,
}).extend({
  name: z.string().min(1, "El nombre del equipo es obligatorio"),
  category: z.string().min(1, "La categoría es obligatoria"),
});

export const insertClubPlayerSchema = createInsertSchema(clubPlayers).omit({
  id: true,
  createdAt: true,
  goals: true,
  teamId: true,
}).extend({
  name: z.string().min(1, "El nombre del jugador es obligatorio"),
  number: z.union([z.number(), z.string().transform(v => { if (!v) return undefined; const n = parseInt(v); return isNaN(n) ? undefined : n; })]).optional(),
});

export const insertClubMatchdaySchema = createInsertSchema(clubMatchdays).omit({
  id: true,
  createdAt: true,
  clubId: true,
  matchId: true,
  resultHome: true,
  resultAway: true,
  status: true,
}).extend({
  rival: z.string().min(1, "El rival es obligatorio"),
});

export const insertClubSponsorSchema = createInsertSchema(clubSponsors).omit({
  id: true,
  createdAt: true,
  clubId: true,
}).extend({
  name: z.string().min(1, "El nombre del patrocinador es obligatorio"),
});

// Club types
export type Club = typeof clubs.$inferSelect;
export type ClubBranch = typeof clubBranches.$inferSelect;
export type ClubDelegate = typeof clubDelegates.$inferSelect;
export type ClubTeam = typeof clubTeams.$inferSelect;
export type ClubPlayer = typeof clubPlayers.$inferSelect;
export type ClubMatchday = typeof clubMatchdays.$inferSelect;
export type ClubSponsor = typeof clubSponsors.$inferSelect;
export type InsertClub = z.infer<typeof insertClubSchema>;
export type InsertClubBranch = z.infer<typeof insertClubBranchSchema>;
export type InsertClubDelegate = z.infer<typeof insertClubDelegateSchema>;
export type InsertClubTeam = z.infer<typeof insertClubTeamSchema>;
export type InsertClubPlayer = z.infer<typeof insertClubPlayerSchema>;
export type InsertClubMatchday = z.infer<typeof insertClubMatchdaySchema>;
export type InsertClubSponsor = z.infer<typeof insertClubSponsorSchema>;

// Existing types
export type User = typeof users.$inferSelect;
export type PublicUser = Omit<User, 'password' | 'recoveryCode' | 'recoveryCodeExpiresAt'>;
export type Folder = typeof folders.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type MatchEvent = typeof matchEvents.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertFolder = z.infer<typeof insertFolderSchema>;
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type InsertUserMatch = z.infer<typeof insertUserMatchSchema>;
export type InsertMatchEvent = z.infer<typeof insertEventSchema>;
export type InsertTeam = z.infer<typeof insertTeamSchema>;

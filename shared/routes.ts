import { z } from "zod";
import { insertMatchSchema, insertEventSchema, matches, matchEvents, folders, insertFolderSchema, MATCH_STATUS } from "./schema";

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

export const api = {
  auth: {
    register: {
      method: "POST" as const,
      path: "/api/register",
      input: z.object({ username: z.string(), password: z.string() }),
      responses: {
        201: z.object({ id: z.number(), username: z.string() }),
        400: errorSchemas.validation,
      },
    },
    login: {
      method: "POST" as const,
      path: "/api/login",
      input: z.object({ username: z.string(), password: z.string() }),
      responses: {
        200: z.object({ id: z.number(), username: z.string() }),
        401: errorSchemas.unauthorized,
      },
    },
    me: {
      method: "GET" as const,
      path: "/api/me",
      responses: {
        200: z.object({ id: z.number(), username: z.string() }).nullable(),
      },
    },
    logout: {
      method: "POST" as const,
      path: "/api/logout",
      responses: {
        200: z.object({ success: z.boolean() }),
      },
    },
  },
  folders: {
    list: {
      method: "GET" as const,
      path: "/api/folders",
      responses: {
        200: z.array(z.custom<typeof folders.$inferSelect>()),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/folders",
      input: insertFolderSchema,
      responses: {
        201: z.custom<typeof folders.$inferSelect>(),
      },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/folders/:id",
      responses: {
        200: z.object({ success: z.boolean() }),
      },
    },
  },
  matches: {
    list: {
      method: "GET" as const,
      path: "/api/matches",
      responses: {
        200: z.array(z.custom<typeof matches.$inferSelect>()),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/matches",
      input: insertMatchSchema.extend({ folderId: z.number().optional() }),
      responses: {
        201: z.custom<typeof matches.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    get: {
      method: "GET" as const,
      path: "/api/matches/:id",
      responses: {
        200: z.custom<typeof matches.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    verifyPin: {
      method: "POST" as const,
      path: "/api/matches/:id/verify",
      input: z.object({ pin: z.string() }),
      responses: {
        200: z.object({ success: z.boolean() }),
        401: errorSchemas.unauthorized,
      },
    },
    updateScore: {
      method: "POST" as const,
      path: "/api/matches/:id/score",
      input: z.object({
        team: z.enum(["local", "away"]),
        delta: z.number(),
        pin: z.string(),
      }),
      responses: {
        200: z.custom<typeof matches.$inferSelect>(),
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      },
    },
    updateStatus: {
      method: "POST" as const,
      path: "/api/matches/:id/status",
      input: z.object({
        status: z.enum([
          MATCH_STATUS.SCHEDULED,
          MATCH_STATUS.FIRST_HALF,
          MATCH_STATUS.HALFTIME,
          MATCH_STATUS.SECOND_HALF,
          MATCH_STATUS.FINISHED
        ]),
        pin: z.string(),
      }),
      responses: {
        200: z.custom<typeof matches.$inferSelect>(),
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      },
    },
    controlTimer: {
      method: "POST" as const,
      path: "/api/matches/:id/timer",
      input: z.object({
        action: z.enum(["start", "pause", "reset"]),
        pin: z.string(),
      }),
      responses: {
        200: z.custom<typeof matches.$inferSelect>(),
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      },
    },
    updateColors: {
      method: "POST" as const,
      path: "/api/matches/:id/colors",
      input: z.object({
        localTeamColor: z.string().optional(),
        awayTeamColor: z.string().optional(),
        pin: z.string(),
      }),
      responses: {
        200: z.custom<typeof matches.$inferSelect>(),
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      },
    },
  },
  events: {
    list: {
      method: "GET" as const,
      path: "/api/matches/:id/events",
      responses: {
        200: z.array(z.custom<typeof matchEvents.$inferSelect>()),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/matches/:id/events",
      input: insertEventSchema.extend({ pin: z.string() }),
      responses: {
        201: z.custom<typeof matchEvents.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/matches/:id/events/:eventId",
      input: z.object({ pin: z.string() }),
      responses: {
        200: z.object({ success: z.boolean() }),
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      },
    },
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`:${key}`, String(value));
    });
  }
  return url;
}

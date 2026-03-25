import { storage } from "./storage";
import { MATCH_STATUS } from "@shared/schema";

async function seed() {
  const existing = await storage.getMatch(1);
  if (!existing) {
    console.log("Seeding database...");
    
    // Create a match
    const match = await storage.createMatch({
      localTeam: "Real Madrid",
      awayTeam: "Barcelona",
      adminPin: "1234",
    });
    
    console.log("Match created:", match);
    
    // Add some events
    await storage.createEvent({
      matchId: match.id,
      type: "whistle",
      minute: 0,
      description: "Match Scheduled",
    });
  } else {
    console.log("Database already seeded");
  }
}

seed().catch(console.error);

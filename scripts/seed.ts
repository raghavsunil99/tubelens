import { seedDemo } from "@/demo/seed";
import { databasePath } from "@/lib/db";

const report = seedDemo();
console.log(`Seeded demo data into ${databasePath()}: ${report.channels} channels, ${report.historyDays} days of history (all flagged is_demo = 1).`);

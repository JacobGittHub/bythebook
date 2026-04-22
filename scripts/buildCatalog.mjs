import fs from "fs/promises";
import path from "path";

const VOLUMES = ["a", "b", "c", "d", "e"];
const BASE_URL = "https://raw.githubusercontent.com/lichess-org/chess-openings/master";

async function buildCatalog() {
  const allOpenings = [];

  console.log("Downloading ECO databases from Lichess...");
  
  for (const vol of VOLUMES) {
    const url = `${BASE_URL}/${vol}.tsv`;
    console.log(`Fetching ${url}...`);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch ${vol}.tsv: ${res.statusText}`);
    }
    
    const text = await res.text();
    const lines = text.split("\n");
    
    // Skip the first line containing the source URL/headers if present
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Skip empty lines, separators, or the header row "eco\tname\tpgn"
        if (!line || line.startsWith("---") || line.startsWith("Source:") || line.startsWith("eco\tname")) {
            continue;
        }

        const [eco, name, pgn] = line.split("\t");
        if (eco && name && pgn) {
            allOpenings.push({ eco, name, pgn });
        }
    }
  }

  console.log(`Parsed ${allOpenings.length} openings total.`);
  
  const outputDir = path.join(process.cwd(), "src", "lib", "chess");
  await fs.mkdir(outputDir, { recursive: true });
  
  const outputPath = path.join(outputDir, "ecoData.json");
  await fs.writeFile(outputPath, JSON.stringify(allOpenings, null, 2));
  
  console.log(`✅ Success! Wrote opening catalog to ${outputPath}`);
}

buildCatalog().catch(console.error);

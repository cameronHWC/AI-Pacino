$ cat "/Users/cameronstark/Hard Work Club Dropbox/Cameron Stark/My Mac (Camerons-MacBook-Air.local)/Desktop/Claude Research Assistant/chatbot-starter/api/chat.js"

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Reads every file inside the "skill-content" folder and combines them.
// You never need to edit this file to add or change your reference
// material — just add, remove, or edit files inside skill-content/.
function loadSkillContent() {
  const dir = path.join(process.cwd(), "skill-content");
  if (!fs.existsSync(dir)) return "";

  const files = fs
    .readdirSync(dir)
    .filter((name) => !name.startsWith("_"))
    .sort();

  return files
    .map((name) => `--- ${name} ---\n${fs.readFileSync(path.join(dir, name), "utf-8")}`)
    .join("\n\n");
}

const SKILL_CONTENT = loadSkillContent();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { messages } = req.body;

  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2048,
      system: [
        {
          type: "text",
          text: SKILL_CONTENT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages,
    });

    const textBlock = response.content.find((block) => block.type === "text");
    res.status(200).json({ reply: textBlock ? textBlock.text : "" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong talking to Claude." });
  }
}

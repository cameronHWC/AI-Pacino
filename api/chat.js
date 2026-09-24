import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ---- Cost controls (edit these to tune) ----
const MODEL = "claude-opus-4-8";   // swap for a cheaper model (e.g. Sonnet or Haiku) to cut cost per message
const MAX_OUTPUT_TOKENS = 500;     // Pacino's replies are short; caps the cost of each answer
const MAX_HISTORY_MESSAGES = 10;   // only the most recent messages are sent to Claude
const MAX_USER_CHARS = 500;        // longest question a visitor can send
const MAX_ASSISTANT_CHARS = 3000;  // longest earlier reply we'll pass back in as history

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

// Clean up whatever the browser sent: right shape, trimmed length, recent messages only.
function sanitizeMessages(raw) {
  if (!Array.isArray(raw)) return null;

  let messages = raw
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim()
    )
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, m.role === "user" ? MAX_USER_CHARS : MAX_ASSISTANT_CHARS),
    }))
    .slice(-MAX_HISTORY_MESSAGES);

  // Conversation must start with the user and end with the user's new question
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") return null;

  return messages;
}

function isSpendLimitError(error) {
  const text = (JSON.stringify(error?.error || {}) + " " + (error?.message || "")).toLowerCase();
  return text.includes("spend limit") || text.includes("spend_limit") || text.includes("credit balance");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const messages = sanitizeMessages(req.body?.messages);
  if (!messages) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
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
    if (isSpendLimitError(error)) {
      // Monthly budget used up: tell the page so it can show the "closed" message
      res.status(503).json({ error: "Monthly limit reached", code: "LIMIT_REACHED" });
    } else if (error?.status === 429) {
      res.status(429).json({ error: "Too many requests", code: "BUSY" });
    } else {
      res.status(500).json({ error: "Something went wrong talking to Claude." });
    }
  }
}

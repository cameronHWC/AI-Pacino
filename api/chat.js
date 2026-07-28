import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ============================================================
// STEP: Replace the text below with your skill's instructions
// and reference material. Everything between the backticks
// (` `) is what gets sent to Claude before every question.
// ============================================================
const SKILL_INSTRUCTIONS = `
PASTE_YOUR_SKILL_CONTENT_HERE
`;
// ============================================================

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
      system: SKILL_INSTRUCTIONS,
      messages,
    });

    const textBlock = response.content.find((block) => block.type === "text");
    res.status(200).json({ reply: textBlock ? textBlock.text : "" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong talking to Claude." });
  }
}

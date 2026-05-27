import mongoose from "mongoose";
import "dotenv/config";
import Resume from "../src/models/Resume.js";
import { getPromptConfig, resolveLlmRuntimeConfig } from "../src/services/config.service.js";
import { completeJson } from "../src/services/llm.service.js";

const mongoUri = "mongodb://admin:admin123@localhost:27017/test?authSource=admin";

function renderTemplate(template = "", values = {}) {
  return String(template || "").replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) =>
    values[key] === undefined || values[key] === null ? "" : String(values[key])
  );
}

async function main() {
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB");

  const resume = await Resume.findById("6a1694a19bac2a2e23f59a54");
  const parsedData = resume.parsedData || {};

  const runtimeConfig = await resolveLlmRuntimeConfig();
  const promptConfig = await getPromptConfig();

  const prompt = renderTemplate(promptConfig.templates?.enrichment?.analyze, {
    output_language: "English",
    resume_json: JSON.stringify(parsedData, null, 2),
  });

  console.log("Runtime Config:", runtimeConfig);
  console.log("System Prompt merged or not? Checking completeJson...");

  try {
    const result = await completeJson({
      feature: "enrichment_analyze",
      prompt,
      systemPrompt: "You are a resume analyst. Return structured JSON only and do not invent facts.",
      maxTokens: 4096,
      retries: 1,
      config: runtimeConfig,
    });
    console.log("Success Result:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error occurred:", error);
    if (error.response_text) {
      console.log("Raw response snippet:", error.response_text);
    }
  }

  await mongoose.disconnect();
}

main().catch(console.error);

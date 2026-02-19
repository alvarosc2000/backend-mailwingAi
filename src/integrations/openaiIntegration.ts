// src/integrations/openAIIntegration.ts
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function analizarConOpenAI(prompt: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.15,
    messages: [
      {
        role: "system",
        content:
          "Eres un analista senior especializado en correos empresariales críticos."
      },
      {
        role: "user",
        content: prompt
      }
    ]
  });

    const choice = response.choices?.[0];
    const content = choice?.message?.content;

    if (!content) {
        throw new Error("OpenAI no devolvió contenido");
    }

    return content;
}

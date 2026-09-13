import { cleanGeneratedCopy } from "../../generative-ui/primitives/content/clean-generated-copy.ts";

const metadataLine = /^(?:[•*\-]\s*)?(?:corte de per[ií]odos|per[ií]odos consultados|fuentes? consultadas?|datos consultados|metodolog[ií]a)\s*:/iu;

export function cleanAnswerText(answer: string) {
  return cleanGeneratedCopy(answer)
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

export function summarizeAnswer(answer: string) {
  const clean = cleanAnswerText(answer);
  if (!clean) return "";
  const blocks = clean.split(/\n\s*\n/u)
    .map((block) => block.split("\n").filter((line) => !metadataLine.test(line)).join(" ").trim())
    .filter(Boolean);
  const block = blocks.find((item) => !/^(?:\d+\.|[•\-]\s)/u.test(item)) ?? blocks[0];
  if (!block) return "";
  const narrative = block.replace(/^Comparando meses completos\s*\([^)]*\),\s*/iu, "").replace(/^([a-záéíóúñ])/u, (letter) => letter.toLocaleUpperCase("es-MX"));
  const causeLead = /^(.{1,120}?\b(?:proviene de|se explica por|se concentra en)):\s*/iu.exec(narrative)?.[1];
  const causeLabels = [...narrative.matchAll(/(?:^|\s[-•]\s+|\s\d+\.\s+)([\p{Lu}][\p{L}\s]{2,35}):/gu)]
    .map((match) => match[1].trim())
    .filter((label) => label.toLocaleLowerCase("es-MX") !== causeLead?.toLocaleLowerCase("es-MX"));
  if (causeLead && causeLabels.length > 0) {
    return `${causeLead} ${causeLabels.slice(0, 2).join(" y ")}${causeLabels.length > 2 ? ", entre otras categorías" : ""}.`;
  }
  const firstSentence = narrative.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ0-9])/u)[0].trim();
  if (firstSentence.length <= 320) return firstSentence;
  const prefix = firstSentence.slice(0, 320);
  const lastSpace = prefix.lastIndexOf(" ");
  return `${prefix.slice(0, lastSpace > 220 ? lastSpace : 319).trimEnd()}…`;
}

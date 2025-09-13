export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function sanitizeField(input: string): string {
  // Anki TSV: no tabs/newlines in fields
  return input.replace(/[\t\r\n]+/g, " ").trim();
}

export function toTSV(cards: { question: string; answer: string; tags: string[]; source_timestamp: string; }[]): string {
  const header = "Question\tAnswer\tTags\tSourceTimestamp";
  const rows = cards.map(c =>
    [sanitizeField(c.question), sanitizeField(c.answer), sanitizeField(c.tags.join(" ")), sanitizeField(c.source_timestamp)].join("\t")
  );
  return [header, ...rows].join("\n");
}

export function toCSV(cards: { question: string; answer: string; tags: string[]; source_timestamp: string; }[]): string {
  const esc = (s: string) => `\"${sanitizeField(s).replace(/"/g, '""')}\"`;
  const header = [esc("Question"), esc("Answer"), esc("Tags"), esc("SourceTimestamp")].join(",");
  const rows = cards.map(c =>
    [esc(c.question), esc(c.answer), esc(c.tags.join(" ")), esc(c.source_timestamp)].join(",")
  );
  return [header, ...rows].join("\n");
}

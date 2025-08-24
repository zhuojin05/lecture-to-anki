// frontend/src/lib/types.ts
export type CardType = "basic" | "cloze";

export type Section = {
  title: string;
  start: number;
  end: number;
  key_points: string[];
  text: string;
};

export type Card = {
  question: string;
  answer: string;
  tags: string[];
  source_timestamp: string;
};

// Request to /api/cards
export type GenerateCardsRequest = {
  lectureTitle: string;
  lectureSlug: string;
  cardType: CardType;
  // Optional exact target
  targetCount?: number; // if omitted => exhaustive
  sections: Section[];
  slidesText?: string;
  transcriptText?: string;
};

export type TranscriptSegment = { start: number; end: number; text: string };
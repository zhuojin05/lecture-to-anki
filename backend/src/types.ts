export type TranscriptSegment = {
  start: number; // seconds
  end: number;   // seconds
  text: string;
};

export type Section = {
  title: string;
  start: number;
  end: number;
  key_points: string[];
  text: string;
};

export type SectionsResponse = {
  sections: Section[];
};

export type CardType = "basic" | "cloze";
export type Amount = "few" | "normal" | "a_lot" | "unbounded";

export type Card = {
  question: string;
  answer: string;
  tags: string[];
  source_timestamp: string; // "mm:ss-mm:ss"
};

export type GenerateCardsBody = {
  lectureTitle: string;
  lectureSlug: string;
  cardType: CardType;
  amount: Amount;
  sections: Section[];
};

export type ExportBody = {
  cards: Card[];
  deck?: string;
};

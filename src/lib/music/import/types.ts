export type ChordChartFormat = "PLAIN" | "CHORDPRO";

export type ChordSectionType =
  | "INTRO"
  | "VERSE"
  | "PRE_CHORUS"
  | "CHORUS"
  | "BRIDGE"
  | "INSTRUMENTAL"
  | "SPONTANEOUS"
  | "ENDING"
  | "OTHER";

export type ImportWarningCode =
  | "EMPTY_CONTENT"
  | "UNKNOWN_DIRECTIVE"
  | "UNCLOSED_SECTION"
  | "AMBIGUOUS_CHORD_LINE"
  | "UNALIGNED_CHORDS"
  | "INVALID_KEY"
  | "INVALID_BPM"
  | "INVALID_TIME_SIGNATURE"
  | "CONFLICTING_METADATA"
  | "UNRECOGNIZED_CONTENT";

export type ImportWarning = {
  code: ImportWarningCode;
  message: string;
  line?: number;
};

export type ParsedChordSection = {
  type: ChordSectionType;
  label: string | null;
  position: number;
  sourceStartLine: number;
  sourceEndLine: number;
  content: string;
};

export type ChordChartMetadata = {
  title: string | null;
  artist: string | null;
  key: string | null;
  bpm: number | null;
  timeSignature: string | null;
};

export type ParsedChordChart = {
  detectedFormat: ChordChartFormat;
  originalContent: string;
  normalizedSource: string;
  chordProContent: string;
  metadata: ChordChartMetadata;
  sections: ParsedChordSection[];
  warnings: ImportWarning[];
};

export type ParseChordChartInput = {
  content: string;
  filename?: string;
  extension?: string;
};

export type ContentParseResult = Omit<
  ParsedChordChart,
  "detectedFormat" | "originalContent" | "normalizedSource"
>;

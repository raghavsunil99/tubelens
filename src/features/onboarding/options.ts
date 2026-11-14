export const GOALS = [
  "Get my first 1,000 subscribers",
  "Grow views per video",
  "Upload more consistently",
  "Reach monetisation",
  "Grow an established channel",
] as const;

/** ISO 639-1 codes YouTube accepts for relevanceLanguage, most relevant to Indian creators first. */
export const LANGUAGES: [string, string][] = [
  ["te", "Telugu"],
  ["en", "English"],
  ["hi", "Hindi"],
  ["ta", "Tamil"],
  ["kn", "Kannada"],
  ["ml", "Malayalam"],
  ["bn", "Bengali"],
  ["mr", "Marathi"],
  ["es", "Spanish"],
  ["pt", "Portuguese"],
  ["id", "Indonesian"],
];

export const NICHE_EXAMPLES = ["budget phones", "Telugu cooking", "personal finance India", "study vlogs", "BGMI gameplay", "home workouts"];

export const languageName = (code: string | null | undefined) => LANGUAGES.find(([c]) => c === code)?.[1] ?? null;

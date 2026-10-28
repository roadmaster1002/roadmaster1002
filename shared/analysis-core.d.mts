export type Evidence = {
  id: string;
  title: string;
  summary: string;
  implication: string;
  sourceName: string;
  sourceUrl: string;
  date: string;
  companyId: string;
  isDemo: boolean;
};

export type AnalysisPeriod = { start: string; end: string };
export type ValidatedInput = {
  question: string;
  company: string;
  period?: AnalysisPeriod;
  signals: Evidence[];
  brief: boolean;
};
export type AnalysisResult = {
  answer: string;
  mode: 'local' | 'llm';
  citations: string[];
};

export class InputError extends Error {}
export function validateInput(body: unknown, brief?: boolean): ValidatedInput;
export function selectSignals(input: ValidatedInput): Evidence[];
export function provenanceNotice(signals: Evidence[]): string;
export function sourcesText(signals: Evidence[]): string;
export function periodText(input: ValidatedInput): string;
export function createLocalAnalysis(input: ValidatedInput): AnalysisResult;

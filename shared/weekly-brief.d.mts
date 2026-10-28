export type BriefCompanyId = 'ncchem' | 'kci' | 'verdant';
export type BriefPeriod = { start: string; end: string };
export type WeeklySignal = {
  id: string;
  title: string;
  companyId: string;
  companyIds?: BriefCompanyId[];
  evidenceType?: 'feed-metadata' | 'registered';
  date?: string;
  summary?: string;
  implication?: string;
  sourceName?: string;
  sourceUrl?: string;
  isDemo: boolean;
  impact?: '높음' | '보통' | '낮음';
  category?: string;
  articleDetails?: { notes?: { followUp?: string } };
};
export type WeeklyBriefInput = {
  signals: WeeklySignal[];
  company?: string;
  period: BriefPeriod;
  includeExamples?: boolean;
  previousSignals?: WeeklySignal[];
  asOfISO?: string;
};
export type WeeklyBriefCoverage = {
  currentCount: number;
  previousCount: number;
  sourceCount: number;
  feedMetadataCount: number;
  previousSourceCount: number;
  excludedDemoCount: number;
  excludedOutsidePeriodCount: number;
  undatedCount: number;
  duplicateCount: number;
  truncatedCount: number;
  previousTruncatedCount: number;
};
export type WeeklyBriefChange = {
  id: string;
  title: string;
  companyId: string;
  companyIds: BriefCompanyId[];
  evidenceType: 'feed-metadata' | 'registered';
  date: string;
  summary: string;
  implication: string;
  sourceName: string;
  sourceUrl: string;
  impact: '높음' | '보통' | '낮음';
  category: string;
  isDemo: boolean;
  comparison: '신규' | '지속' | '비교 불가';
};
export type WeeklyBriefBusiness = {
  companyId: BriefCompanyId;
  label: string;
  signalCount: number;
  sourceCount: number;
  observations: string[];
  implications: string[];
  evidenceIds: string[];
  status: '자료 있음' | '자료 없음';
};
export type WeeklyBriefAction = {
  id: string;
  companyId: BriefCompanyId;
  evidenceIds: string[];
  task: string;
  owner: string;
  dueDate: string | null;
  status: '미착수' | '진행 중' | '완료';
};
export type WeeklyBriefSource = {
  id: string;
  title: string;
  date: string;
  sourceName: string;
  sourceUrl: string;
  isDemo: boolean;
  evidenceType: 'feed-metadata' | 'registered';
  companyIds: BriefCompanyId[];
};
export type WeeklyBrief = {
  period: BriefPeriod;
  previousPeriod: BriefPeriod;
  scope: BriefCompanyId | 'all';
  generatedAt: string | null;
  meetingNotes?: string;
  coverage: WeeklyBriefCoverage;
  executiveSummary: string[];
  topChanges: WeeklyBriefChange[];
  businesses: WeeklyBriefBusiness[];
  actionItems: WeeklyBriefAction[];
  limitations: string[];
  sources: WeeklyBriefSource[];
  markdown: string;
};
export class WeeklyBriefError extends Error {}
export function buildWeeklyBrief(input: WeeklyBriefInput): WeeklyBrief;

export function weeklyBriefToMarkdown(brief: WeeklyBrief): string;

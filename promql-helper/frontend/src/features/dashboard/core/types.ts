export type Severity = 'critical' | 'warning' | 'info' | 'success';
export type Confidence = 'high' | 'medium' | 'low';
export type Category = 'performance' | 'ux' | 'sre';

export interface Finding {
  id: string;
  severity: Severity;
  confidence: Confidence;
  category: Category;
  title: string;
  description: string;
  recommendation?: string;
  panel?: string;
  variable?: string;
}

export interface AnalysisResult {
  stats: {
    totalPanels: number;
    queryPanels: number;
    totalTargets: number;
    variables: number;
    checksRun: number;
    passed: number;
    warnings: number;
    critical: number;
    info: number;
  };
  findings: Finding[];
  originalDash: any;
}

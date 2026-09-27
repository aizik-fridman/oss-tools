import { z } from 'zod';
import type { Finding, AnalysisResult, Confidence } from './types';
export const DashboardSchema = z.object({
  panels: z.array(z.any()).optional(),
  templating: z.object({
    list: z.array(z.any()).optional()
  }).passthrough().optional(),
}).passthrough();

export function performAnalysis(dash: any): AnalysisResult {
  const findings: Finding[] = [];
  const checksRun = new Set<string>();
  
  let totalPanels = 0;
  let queryPanels = 0;
  let totalTargets = 0;
  let variables = 0;

  // Track issues to report successes
  let hasLongTimeRange = false;
  let hasFastRefresh = false;
  let badVarRefresh = 0;
  let orphanedVars = 0;
  let broadRegexVars = 0;
  let missingDesc = 0;
  let missingDP = 0;
  let missingUnits = 0;
  let missingThresholds = 0;
  let legacyAlerts = 0;
  let badPromQL = 0;

  const addFinding = (f: Omit<Finding, 'id'>) => {
    findings.push({ ...f, id: Math.random().toString(36).substr(2, 9) });
  };

  const markCheck = (checkName: string) => checksRun.add(checkName);

  // Flatten panels
  const flatPanels: any[] = [];
  const walkPanels = (panels: any[]) => {
    panels.forEach(p => {
      if (p.type === 'row' && p.panels) {
        walkPanels(p.panels);
      } else if (p.type !== 'row') {
        flatPanels.push(p);
      }
    });
  };
  if (dash.panels) walkPanels(dash.panels);

  totalPanels = flatPanels.length;
  
  // Dashboard Level Checks
  markCheck('time_range');
  if (dash.time && dash.time.from) {
    const from = dash.time.from;
    if (from.match(/now-[7-9]d|now-[1-9][0-9]d|now-[1-9]w|now-[1-9]M|now-[1-9]y/)) {
      hasLongTimeRange = true;
      addFinding({
        severity: 'info',
        confidence: 'medium',
        category: 'performance',
        title: 'Long default time range',
        description: `Long default time range detected (${from}).`,
        recommendation: 'Large time ranges can increase query cost depending on metric cardinality and query structure.'
      });
    }
  }

  markCheck('refresh_interval');
  if (dash.refresh && ['5s', '10s'].includes(dash.refresh)) {
    hasFastRefresh = true;
    addFinding({
      severity: 'warning',
      confidence: 'medium',
      category: 'performance',
      title: 'Fast dashboard refresh',
      description: `Fast dashboard refresh detected: ${dash.refresh}.`,
      recommendation: 'Frequent refreshes may increase datasource load.'
    });
  }

  // Variables Checks
  const templating = dash.templating?.list || [];
  variables = templating.length;
  const dashString = JSON.stringify(dash);

  templating.forEach((v: any) => {
    markCheck('variable_refresh');
    if (v.type === 'query' && v.refresh === 2) {
      badVarRefresh++;
      addFinding({
        severity: 'warning',
        confidence: 'medium',
        category: 'performance',
        title: 'Variable refresh on time range change',
        description: `Variable '${v.name}' is set to refresh on Time Range Change.`,
        recommendation: 'Consider setting this to "On Dashboard Load" to avoid extra queries on every zoom action.',
        variable: v.name
      });
    }

    markCheck('variable_orphaned');
    const varRegex = new RegExp(`\\$${v.name}(?![a-zA-Z0-9_])|\\$\\{${v.name}(:[a-zA-Z0-9_]+)?\\}`, 'g');
    const matches = dashString.match(varRegex);
    if (!matches || matches.length === 0) {
      orphanedVars++;
      addFinding({
        severity: 'warning',
        confidence: 'high',
        category: 'sre',
        title: 'Orphaned template variable',
        description: `Variable '${v.name}' is defined but does not appear to be used in any panel or query.`,
        recommendation: 'Remove unused variables to keep the dashboard clean and avoid unnecessary queries.',
        variable: v.name
      });
    }

    markCheck('variable_regex');
    let queryString = '';
    if (typeof v.query === 'string') {
      queryString = v.query;
    } else if (v.query && typeof v.query.query === 'string') {
      queryString = v.query.query;
    }
    
    if (queryString && queryString.match(/=~\s*['"].*\*['"]/)) {
      broadRegexVars++;
      addFinding({
        severity: 'warning',
        confidence: 'medium',
        category: 'sre',
        title: 'Broad regex matcher',
        description: `Broad regex matcher detected (=~ ".*") in variable '${v.name}'.`,
        recommendation: 'Consider narrowing the matcher when possible, especially on high-cardinality labels.',
        variable: v.name
      });
    }
  });

  // Panel Checks
  flatPanels.forEach(p => {
    const title = p.title || 'Untitled';
    if (p.targets && p.targets.length > 0) {
      queryPanels++;
      totalTargets += p.targets.length;
    }

    markCheck('panel_description');
    if (!p.description || p.description.trim() === '') {
      missingDesc++;
      let conf: Confidence = 'low';
      if (['timeseries', 'graph', 'stat', 'gauge'].includes(p.type)) conf = 'medium';
      
      addFinding({
        severity: 'info',
        confidence: conf,
        category: 'ux',
        title: 'No panel description',
        description: 'No panel description detected.',
        recommendation: 'Consider adding context for on-call users to explain what this panel indicates.',
        panel: title
      });
    }

    markCheck('panel_maxDataPoints');
    if (['timeseries', 'graph'].includes(p.type)) {
      if (!p.maxDataPoints) {
        missingDP++;
        addFinding({
          severity: 'info',
          confidence: 'low',
          category: 'performance',
          title: 'Missing maxDataPoints',
          description: 'Panel does not explicitly define maxDataPoints. Grafana may still handle resolution automatically.',
          recommendation: 'Consider configuring it only when the dashboard has known high-cardinality or high-resolution workloads.',
          panel: title
        });
      }
    }

    markCheck('panel_units');
    const unit = p.fieldConfig?.defaults?.unit || p.fieldConfig?.overrides?.find((o: any) => o.properties?.find((prop: any) => prop.id === 'unit')) || (p.yaxes && p.yaxes[0]?.format);
    if (!unit || unit === 'none' || unit === 'short') {
      const skipUnits = ['text', 'table', 'logs', 'traces', 'alertlist', 'dashlist'];
      if (!skipUnits.includes(p.type)) {
        missingUnits++;
        addFinding({
          severity: 'info',
          confidence: 'medium',
          category: 'ux',
          title: 'No explicit unit',
          description: 'No explicit unit detected.',
          recommendation: 'Consider defining a unit when the metric represents a measurable quantity (e.g. avoid unit on booleans or status codes).',
          panel: title
        });
      }
    }

    markCheck('panel_thresholds');
    if (['stat', 'gauge'].includes(p.type)) {
      const steps = p.fieldConfig?.defaults?.thresholds?.steps || p.options?.fieldOptions?.thresholds?.steps;
      if (!steps || steps.length < 2) {
        missingThresholds++;
        let conf: Confidence = 'low';
        const tLower = title.toLowerCase();
        if (tLower.includes('cpu') || tLower.includes('memory') || tLower.includes('disk') || tLower.includes('latency') || tLower.includes('error') || tLower.includes('availability')) {
          conf = 'medium';
        }
        addFinding({
          severity: 'info',
          confidence: conf,
          category: 'ux',
          title: 'No thresholds configured',
          description: 'No color thresholds configured for this panel.',
          recommendation: 'Consider thresholds when this panel represents health, saturation, capacity, or severity.',
          panel: title
        });
      }
    }

    markCheck('legacy_alert');
    if (p.alert) {
      legacyAlerts++;
      addFinding({
        severity: 'warning',
        confidence: 'high',
        category: 'sre',
        title: 'Legacy alerting',
        description: 'Legacy panel alert configuration detected.',
        recommendation: 'Consider migrating this alert to Grafana Unified Alerting.',
        panel: title
      });
    }

    markCheck('promql_heuristics');
    if (p.targets && Array.isArray(p.targets)) {
      p.targets.forEach((t: any) => {
        if (t.expr && typeof t.expr === 'string') {
          const expr = t.expr;
          
          if ((expr.includes('rate(') || expr.includes('irate(')) && !expr.includes('$__rate_interval')) {
            badPromQL++;
            addFinding({
              severity: 'warning',
              confidence: 'medium',
              category: 'performance',
              title: 'Fixed rate interval',
              description: 'Fixed rate interval detected.',
              recommendation: 'Consider using $__rate_interval when the query should adapt to the dashboard resolution.',
              panel: title
            });
          }

          const heavyConstructs = ['sort(', 'sort_desc(', 'count_values(', 'histogram_quantile(', 'label_replace(', 'label_join('];
          for (const construct of heavyConstructs) {
            if (expr.includes(construct)) {
              badPromQL++;
              addFinding({
                severity: 'info',
                confidence: 'medium',
                category: 'performance',
                title: 'Heavy PromQL construct',
                description: `Potentially expensive PromQL construct detected: ${construct.replace('(', '()')}.`,
                recommendation: 'This may increase query cost depending on cardinality and query structure. Ensure it is bounded appropriately.',
                panel: title
              });
            }
          }

          if (expr.match(/{[a-zA-Z_]+}=~\s*['"].*\*['"]/)) {
            badPromQL++;
            addFinding({
              severity: 'warning',
              confidence: 'medium',
              category: 'sre',
              title: 'Broad PromQL selector',
              description: 'Broad regex selector detected (e.g. =~ ".*").',
              recommendation: 'Consider narrowing the matcher when possible, especially on high-cardinality labels.',
              panel: title
            });
          }
        }
      });
    }
  });

  // Explicit Success Findings
  if (!hasLongTimeRange) addFinding({ severity: 'success', confidence: 'high', category: 'performance', title: 'Efficient Time Range', description: 'Dashboard default time range is reasonably bounded.' });
  if (!hasFastRefresh) addFinding({ severity: 'success', confidence: 'high', category: 'performance', title: 'Safe Refresh Interval', description: 'No overly aggressive dashboard refresh intervals detected.' });
  if (variables > 0) {
    if (badVarRefresh === 0) addFinding({ severity: 'success', confidence: 'high', category: 'performance', title: 'Optimal Variable Refresh', description: 'All query variables refresh efficiently on dashboard load.' });
    if (orphanedVars === 0) addFinding({ severity: 'success', confidence: 'high', category: 'sre', title: 'No Orphaned Variables', description: 'All defined template variables are actively used.' });
    if (broadRegexVars === 0) addFinding({ severity: 'success', confidence: 'high', category: 'sre', title: 'Optimized Regex Variables', description: 'No broad regex matchers detected in variables.' });
  }
  if (totalPanels > 0) {
    if (missingDesc === 0) addFinding({ severity: 'success', confidence: 'high', category: 'ux', title: 'Complete Descriptions', description: 'All relevant panels have descriptive context for on-call users.' });
    if (missingDP === 0 && queryPanels > 0) addFinding({ severity: 'success', confidence: 'high', category: 'performance', title: 'Bounded Data Points', description: 'All timeseries panels explicitly define maxDataPoints.' });
    if (missingUnits === 0) addFinding({ severity: 'success', confidence: 'high', category: 'ux', title: 'Explicit Units', description: 'All relevant panels have explicitly defined units.' });
    if (missingThresholds === 0) addFinding({ severity: 'success', confidence: 'high', category: 'ux', title: 'Configured Thresholds', description: 'All relevant stat/gauge panels have color thresholds.' });
    if (legacyAlerts === 0) addFinding({ severity: 'success', confidence: 'high', category: 'sre', title: 'Modern Alerting', description: 'No legacy panel alerts detected.' });
    if (badPromQL === 0 && queryPanels > 0) addFinding({ severity: 'success', confidence: 'high', category: 'performance', title: 'Efficient PromQL', description: 'Queries utilize efficient rate intervals and bounded selections.' });
  }

  const warnings = findings.filter(f => f.severity === 'warning').length;
  const critical = findings.filter(f => f.severity === 'critical').length;
  const info = findings.filter(f => f.severity === 'info').length;

  return {
    stats: {
      totalPanels,
      queryPanels,
      totalTargets,
      variables,
      checksRun: checksRun.size,
      passed: findings.filter(f => f.severity === 'success').length, 
      warnings,
      critical,
      info
    },
    findings,
    originalDash: dash
  };
}


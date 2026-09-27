import { describe, it, expect } from 'vitest';
import { performAnalysis } from './analyzer';

describe('DashboardAnalyzerTool Static Analysis', () => {
  it('1. Dashboard ללא panels', () => {
    const dash = { title: 'Empty' };
    const res = performAnalysis(dash);
    expect(res.stats.totalPanels).toBe(0);
  });

  it('2. Dashboard עם Row', () => {
    const dash = {
      panels: [
        { type: 'row', panels: [{ type: 'timeseries' }, { type: 'stat' }] },
        { type: 'graph' }
      ]
    };
    const res = performAnalysis(dash);
    expect(res.stats.totalPanels).toBe(3);
  });

  it('3. Panel עם rate()', () => {
    const dash = {
      panels: [{
        type: 'timeseries',
        targets: [{ expr: 'rate(http_requests_total[5m])' }]
      }]
    };
    const res = performAnalysis(dash);
    const finding = res.findings.find(f => f.title === 'Fixed rate interval');
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('warning');
    expect(finding?.confidence).toBe('medium');
  });

  it('4. Panel עם $__rate_interval', () => {
    const dash = {
      panels: [{
        type: 'timeseries',
        targets: [{ expr: 'rate(http_requests_total[$__rate_interval])' }]
      }]
    };
    const res = performAnalysis(dash);
    const finding = res.findings.find(f => f.title === 'Fixed rate interval');
    expect(finding).toBeUndefined();
  });

  it('5. Variable עם $instance', () => {
    const dash = {
      templating: { list: [{ type: 'query', name: 'instance' }] },
      panels: [{ title: 'test', description: 'desc', type: 'text', content: 'Using $instance here' }]
    };
    const res = performAnalysis(dash);
    const finding = res.findings.find(f => f.title === 'Orphaned template variable');
    expect(finding).toBeUndefined();
  });

  it('6. Variable עם ${instance}', () => {
    const dash = {
      templating: { list: [{ type: 'query', name: 'instance' }] },
      panels: [{ title: 'test', type: 'text', content: 'Using ${instance} here' }]
    };
    const res = performAnalysis(dash);
    const finding = res.findings.find(f => f.title === 'Orphaned template variable');
    expect(finding).toBeUndefined();
  });

  it('7. Variable עם ${instance:regex}', () => {
    const dash = {
      templating: { list: [{ type: 'query', name: 'instance' }] },
      panels: [{ title: 'test', type: 'text', content: 'Using ${instance:regex} here' }]
    };
    const res = performAnalysis(dash);
    const finding = res.findings.find(f => f.title === 'Orphaned template variable');
    expect(finding).toBeUndefined();
  });

  it('8. Variable orphaned', () => {
    const dash = {
      templating: { list: [{ type: 'query', name: 'unused_var' }] },
      panels: [{ title: 'test', type: 'text', content: 'Using $instance here' }]
    };
    const res = performAnalysis(dash);
    const finding = res.findings.find(f => f.title === 'Orphaned template variable');
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('warning');
    expect(finding?.confidence).toBe('high');
  });

  it('9. =~".*" regex', () => {
    const dash = {
      templating: { list: [{ type: 'query', name: 'var', query: 'label_values({job=~".*"}, instance)' }] },
      panels: []
    };
    const res = performAnalysis(dash);
    const finding = res.findings.find(f => f.title === 'Broad regex matcher');
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('warning');
    expect(finding?.confidence).toBe('medium');
  });

  it('10. maxDataPoints = 1000', () => {
    const dash = {
      panels: [{ type: 'timeseries', maxDataPoints: 1000 }]
    };
    const res = performAnalysis(dash);
    const finding = res.findings.find(f => f.title === 'Missing maxDataPoints');
    expect(finding).toBeUndefined();
  });

  it('11. maxDataPoints = 5000', () => {
    const dash = {
      panels: [{ type: 'timeseries', maxDataPoints: 5000 }]
    };
    const res = performAnalysis(dash);
    const finding = res.findings.find(f => f.title === 'Missing maxDataPoints');
    expect(finding).toBeUndefined(); // we don't alert on 5000 anymore
  });

  it('12. Panel עם unit ב-defaults', () => {
    const dash = {
      panels: [{ type: 'stat', fieldConfig: { defaults: { unit: 'bytes' } } }]
    };
    const res = performAnalysis(dash);
    const finding = res.findings.find(f => f.title === 'No explicit unit');
    expect(finding).toBeUndefined();
  });

  it('13. Panel עם unit ב-overrides', () => {
    const dash = {
      panels: [{
        type: 'stat',
        fieldConfig: { overrides: [{ properties: [{ id: 'unit', value: 'ms' }] }] }
      }]
    };
    const res = performAnalysis(dash);
    const finding = res.findings.find(f => f.title === 'No explicit unit');
    expect(finding).toBeUndefined();
  });

  it('14. Panel עם legacy yaxis unit', () => {
    const dash = {
      panels: [{ type: 'graph', yaxes: [{ format: 'percent' }] }]
    };
    const res = performAnalysis(dash);
    const finding = res.findings.find(f => f.title === 'No explicit unit');
    expect(finding).toBeUndefined();
  });

  it('15. Stat ללא thresholds', () => {
    const dash = {
      panels: [{ type: 'stat', title: 'CPU Usage' }]
    };
    const res = performAnalysis(dash);
    const finding = res.findings.find(f => f.title === 'No thresholds configured');
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('info');
    expect(finding?.confidence).toBe('medium'); // Because title has CPU
  });

  it('16. Stat עם thresholds', () => {
    const dash = {
      panels: [{ type: 'stat', title: 'CPU Usage', fieldConfig: { defaults: { thresholds: { steps: [{}, {}] } } } }]
    };
    const res = performAnalysis(dash);
    const finding = res.findings.find(f => f.title === 'No thresholds configured');
    expect(finding).toBeUndefined();
  });

  it('17. Legacy alert', () => {
    const dash = {
      panels: [{ type: 'graph', alert: { name: 'legacy alert' } }]
    };
    const res = performAnalysis(dash);
    const finding = res.findings.find(f => f.title === 'Legacy alerting');
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('warning');
    expect(finding?.confidence).toBe('high');
  });

  it('18. Dashboard עם refresh של 5s', () => {
    const dash = { refresh: '5s' };
    const res = performAnalysis(dash);
    const finding = res.findings.find(f => f.title === 'Fast dashboard refresh');
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('warning');
    expect(finding?.confidence).toBe('medium');
  });

  it('19. Dashboard עם time range של 30d', () => {
    const dash = { time: { from: 'now-30d', to: 'now' } };
    const res = performAnalysis(dash);
    const finding = res.findings.find(f => f.title === 'Long default time range');
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('info');
    expect(finding?.confidence).toBe('medium');
  });

});

import { describe, it, expect } from 'vitest';
import { convertToUnified } from './converter';

describe('Alert Converter', () => {
  it('should gracefully handle empty rules', () => {
    const res = convertToUnified({ original: { groups: [] }, rules: [] });
    expect(res).toBeDefined();
    expect(res.groups).toBeDefined();
  });

  it('should format legacy prometheus rules into unified format structure', () => {
    const res = convertToUnified({ 
      original: { groups: [] },
      rules: [
        {
          alert: 'TestAlert',
          expr: 'up == 0',
          for: '5m',
          labels: { severity: 'critical' },
          annotations: { summary: 'Instance down' }
        }
      ]
    });
    
    expect(res.groups[0].rules[0].title).toBe('TestAlert');
    expect(res.groups[0].rules[0].labels.severity).toBe('critical');
    // Ensure data model expr matches
    expect(res.groups[0].rules[0].data[0].model.expr).toBe('up == 0');
  });
});
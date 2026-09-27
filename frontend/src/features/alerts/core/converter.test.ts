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
      original: { 
        groups: [{
          name: 'test-group',
          rules: [
            {
              alert: 'TestAlert',
              expr: 'up == 0',
              for: '5m',
              labels: { severity: 'critical' },
              annotations: { summary: 'Instance down' }
            }
          ]
        }]
      }
    });
    
    expect(res.groups[0].rules[0].title).toBe('TestAlert');
    expect(res.groups[0].rules[0].labels.severity).toBe('critical');
    expect(res.groups[0].rules[0].uid).toBeDefined(); // UID should be generated
    expect(res.groups[0].rules[0].data[0].model.expr).toBe('up == 0');
    expect(res.groups[0].rules[0].data[1].model.type).toBe('reduce');
    expect(res.groups[0].rules[0].data[2].model.type).toBe('math');
    expect(res.groups[0].rules[0].condition).toBe('C');
  });
});
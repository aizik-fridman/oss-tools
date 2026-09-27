import { describe, it, expect } from 'vitest';
import { PrometheusAlertsSchema } from './schemas';

describe('Alert Schemas', () => {
  it('should parse valid prometheus rules', () => {
    const valid = {
      groups: [
        {
          name: 'test-group',
          rules: [
            {
              alert: 'HighCPU',
              expr: 'cpu > 80'
            }
          ]
        }
      ]
    };
    
    const res = PrometheusAlertsSchema.safeParse(valid);
    expect(res.success).toBe(true);
  });

  it('should allow recording rules', () => {
    const recordingRule = {
      groups: [
        {
          name: 'recording-group',
          rules: [
            {
              record: 'job:http_requests:rate5m',
              expr: 'rate(http_requests_total[5m])'
            }
          ]
        }
      ]
    };
    
    const res = PrometheusAlertsSchema.safeParse(recordingRule);
    expect(res.success).toBe(true);
  });
});

import { z } from 'zod';

export const AlertRuleSchema = z.object({
  alert: z.string().optional(),
  title: z.string().optional(),
  expr: z.string().optional(),
  data: z.array(z.any()).optional(),
  for: z.string().optional(),
  labels: z.any().optional(),
  annotations: z.any().optional()
}).passthrough();

export const AlertGroupSchema = z.object({
  name: z.string(),
  rules: z.array(AlertRuleSchema)
}).passthrough();

export const PrometheusAlertsSchema = z.union([
  z.object({
    groups: z.array(AlertGroupSchema)
  }).passthrough(),
  z.array(AlertRuleSchema)
]);

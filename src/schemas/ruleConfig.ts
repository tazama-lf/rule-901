// SPDX-License-Identifier: Apache-2.0

import { baseConfigSchema, baseRuleConfigSchema, BandSchema, OutcomeResultSchema } from '@tazama-lf/frms-coe-lib';
import type { RuleConfig } from '@tazama-lf/frms-coe-lib/lib/interfaces';
import { z } from 'zod';

export const RULE_ID = '901';

const rule901ConfigSchema = baseConfigSchema.extend({
  bands: z.array(BandSchema).min(1),
  exitConditions: z.array(OutcomeResultSchema).min(1),
  parameters: z.object({
    maxQueryRange: z.number().positive(),
  }),
});

export const ruleConfigSchema = baseRuleConfigSchema.extend({
  config: rule901ConfigSchema,
});

export const validateConfig = (config: RuleConfig): void => {
  ruleConfigSchema.parse(config);
};

// SPDX-License-Identifier: Apache-2.0

import { RULE_ID, ruleConfigSchema, validateConfig } from '../../src/schemas/ruleConfig';

const validConfig = {
  id: '901@1.0.0',
  cfg: '1.0.0',
  tenantId: 'DEFAULT',
  config: {
    bands: [{ subRuleRef: '.01', reason: 'Low' }],
    exitConditions: [{ subRuleRef: '.x00', reason: 'Unsuccessful transaction' }],
    parameters: { maxQueryRange: 86400000 },
  },
};

describe('RULE_ID', () => {
  it('should equal 901', () => {
    expect(RULE_ID).toBe('901');
  });
});

describe('ruleConfigSchema', () => {
  it('should accept a valid config', () => {
    expect(() => ruleConfigSchema.parse(validConfig)).not.toThrow();
  });

  it('should reject when bands is empty', () => {
    expect(() => ruleConfigSchema.parse({ ...validConfig, config: { ...validConfig.config, bands: [] } })).toThrow();
  });

  it('should reject when bands is absent', () => {
    const { bands: _b, ...configNoBands } = validConfig.config;
    expect(() => ruleConfigSchema.parse({ ...validConfig, config: configNoBands })).toThrow();
  });

  it('should reject when exitConditions is empty', () => {
    expect(() => ruleConfigSchema.parse({ ...validConfig, config: { ...validConfig.config, exitConditions: [] } })).toThrow();
  });

  it('should reject when exitConditions is absent', () => {
    const { exitConditions: _e, ...configNoExit } = validConfig.config;
    expect(() => ruleConfigSchema.parse({ ...validConfig, config: configNoExit })).toThrow();
  });

  it('should reject when parameters is absent', () => {
    const { parameters: _p, ...configNoParams } = validConfig.config;
    expect(() => ruleConfigSchema.parse({ ...validConfig, config: configNoParams })).toThrow();
  });

  it('should reject when maxQueryRange is absent', () => {
    expect(() =>
      ruleConfigSchema.parse({ ...validConfig, config: { ...validConfig.config, parameters: {} } }),
    ).toThrow();
  });

  it('should reject when maxQueryRange is not positive', () => {
    expect(() =>
      ruleConfigSchema.parse({ ...validConfig, config: { ...validConfig.config, parameters: { maxQueryRange: 0 } } }),
    ).toThrow();
    expect(() =>
      ruleConfigSchema.parse({ ...validConfig, config: { ...validConfig.config, parameters: { maxQueryRange: -1000 } } }),
    ).toThrow();
  });

  it('should reject when maxQueryRange is not a number', () => {
    expect(() =>
      ruleConfigSchema.parse({ ...validConfig, config: { ...validConfig.config, parameters: { maxQueryRange: 'daily' } } }),
    ).toThrow();
  });

  it('should reject when top-level required fields are missing', () => {
    const { id: _id, ...noId } = validConfig;
    expect(() => ruleConfigSchema.parse(noId)).toThrow();

    const { cfg: _cfg, ...noCfg } = validConfig;
    expect(() => ruleConfigSchema.parse(noCfg)).toThrow();

    const { tenantId: _t, ...noTenant } = validConfig;
    expect(() => ruleConfigSchema.parse(noTenant)).toThrow();
  });
});

describe('validateConfig', () => {
  it('should not throw for a valid config', () => {
    expect(() => validateConfig(validConfig as any)).not.toThrow();
  });

  it('should throw for an invalid config', () => {
    expect(() => validateConfig({ ...validConfig, config: { ...validConfig.config, bands: [] } } as any)).toThrow();
  });
});

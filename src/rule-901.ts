// SPDX-License-Identifier: Apache-2.0

import type { DatabaseManagerInstance, LoggerService, ManagerConfig } from '@tazama-lf/frms-coe-lib';
import type { OutcomeResult, RuleConfig, RuleRequest, RuleResult } from '@tazama-lf/frms-coe-lib/lib/interfaces';

export type RuleExecutorConfig = ManagerConfig &
  Required<Pick<ManagerConfig, 'rawHistory' | 'eventHistory' | 'configuration' | 'localCacheConfig'>>;
interface CountRow {
  length: number;
}

export async function handleTransaction(
  req: RuleRequest,
  determineOutcome: (value: number, ruleConfig: RuleConfig, ruleResult: RuleResult) => RuleResult,
  ruleRes: RuleResult,
  loggerService: LoggerService,
  ruleConfig: RuleConfig,
  databaseManager: DatabaseManagerInstance<RuleExecutorConfig>,
): Promise<RuleResult> {
  const context = `Rule-${ruleConfig.id ? ruleConfig.id : '<unresolved>'} handleTransaction()`;
  const msgId = req.transaction.FIToFIPmtSts.GrpHdr.MsgId;

  loggerService.trace('Start - handle transaction', context, msgId);

  // Throw errors early if something we know we need is not provided - Guard Pattern
  if (!ruleConfig.config.bands?.length) {
    throw new Error('Invalid ruleConfig provided - bands not provided or empty');
  }
  if (!ruleConfig.config.exitConditions) throw new Error('Invalid ruleConfig provided - exitConditions not provided');
  if (!ruleConfig.config.parameters) throw new Error('Invalid ruleConfig provided - parameters not provided');
  if (!ruleConfig.config.parameters.maxQueryRange) throw new Error('Invalid ruleConfig provided - maxQueryRange parameter not provided');
  if (!req.DataCache.dbtrAcctId) throw new Error('Data Cache does not have required dbtrAcctId');

  // Step 1: Early exit conditions

  loggerService.trace('Step 1 - Early exit conditions', context, msgId);

  const UnsuccessfulTransaction = ruleConfig.config.exitConditions.find((b: OutcomeResult) => b.subRuleRef === '.x00');

  if (req.transaction.FIToFIPmtSts.TxInfAndSts.TxSts !== 'ACCC') {
    if (UnsuccessfulTransaction === undefined) throw new Error('Unsuccessful transaction and no exit condition in ruleConfig');

    return {
      ...ruleRes,
      reason: UnsuccessfulTransaction.reason,
      subRuleRef: UnsuccessfulTransaction.subRuleRef,
    };
  }

  // Step 2: Query Setup

  loggerService.trace('Step 2 - Query setup', context, msgId);

  const currentPacs002TimeFrame = req.transaction.FIToFIPmtSts.GrpHdr.CreDtTm;
  const debtorAccountId = req.DataCache.dbtrAcctId;
  const maxQueryRange: number = ruleConfig.config.parameters.maxQueryRange as number;
  const tenantId = req.transaction.TenantId;

  const values = [debtorAccountId, currentPacs002TimeFrame, maxQueryRange, tenantId];

  const queryString = `SELECT COUNT(*)::int AS length
FROM transaction tr
WHERE tr.destination = $1
AND tr."txtp" = 'pacs.002.001.12'
AND ($2::timestamptz - tr."credttm"::timestamptz) <= $3 * interval '1 millisecond'
AND tr.tenantId = $4;`;

  // Step 3: Query Execution

  loggerService.trace('Step 3 - Query execution', context, msgId);

  const res = await databaseManager._eventHistory.query<CountRow>(queryString, values);

  const [{ length }] = res.rows;

  loggerService.trace('Step 4 - Query post-processing', context, msgId);

  if (length == null) {
    // 0 is a legal value
    throw new Error('Data error: irretrievable transaction history');
  }

  if (typeof length !== 'number') {
    throw new Error('Data error: query result type mismatch - expected a number');
  }

  // Return control to the rule-executer for rule result calculation
  loggerService.trace('End - handle transaction', context, msgId);

  return determineOutcome(length, ruleConfig, ruleRes);
}

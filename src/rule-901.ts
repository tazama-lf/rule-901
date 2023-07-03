import { DatabaseManagerInstance, LoggerService, ManagerConfig } from '@frmscoe/frms-coe-lib';
import {  RuleConfig, RuleRequest, RuleResult } from '@frmscoe/frms-coe-lib/lib/interfaces';
import { aql } from 'arangojs';

export async function handleTransaction(
    req: RuleRequest,
    determineOutcome: (value: number, ruleConfig: RuleConfig, ruleResult: RuleResult) => RuleResult,
    ruleRes: RuleResult,
    loggerService: LoggerService,
    ruleConfig: RuleConfig,
    databaseManager: DatabaseManagerInstance<ManagerConfig>,
): Promise<RuleResult> {
    loggerService.log("Rule Received request", "handleTransaction");
    // Throw errors early if something we know we need is not provided - Guard Pattern
    if (!ruleConfig?.config?.timeframes) throw new Error("No timeframs were provided by config")
    if (!ruleConfig?.config?.timeframes[0]?.threshold) throw new Error("Config Threshold not specified");
    if (!req.DataCache.dbtrAcctId) throw new Error("Data Cache does not have required dbtrAcctId");

    const debtorAccountId = `accounts/${req.DataCache.dbtrAcctId}`;
    const debtorAccountIdAql = aql`${debtorAccountId}`;

    // Query database to get all transactions from this debtor in the timespan configured. 
    const debtorAccount = `accounts/${dataCache.dbtrAcctId}`;
    const debtorAccountAql = aql`${debtorAccount}`;
    const transactionAmount = await (await databaseManager._pseudonymsDb.query(aql`
        FOR 
            doc
        IN 
            transactionRelationship
        FILTER
            doc.TxTp=="pacs.002.001.12"
            AND doc._from == ${debtorAccountIdAql}
            AND DATE_DIFF(DATE_TIMESTAMP(doc.CreDtTm), DATE_NOW(), "millisecond", false) <= ${ruleConfig.config.timeframes[0].threshold}
        COLLECT WITH COUNT INTO length
        RETURN 
            length
    `)).batches.all();


    if (!transactionAmount || !transactionAmount[0] || (transactionAmount[0][0] === undefined))
        throw new Error("Error while retrieving transaction history information");

    ruleRes = await determineOutcome(transactionAmount[0][0], ruleConfig, ruleRes);
    loggerService.log(`Rule ${ruleRes.id}@${ruleRes.cfg} processed with outcome: ${ruleRes.subRuleRef}`);
    return ruleRes;
}
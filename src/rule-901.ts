import { DatabaseManagerInstance, LoggerService, ManagerConfig } from '@frmscoe/frms-coe-lib';
import { DataCache, RuleConfig, RuleRequest, RuleResult } from '@frmscoe/frms-coe-lib/lib/interfaces';

export async function handleTransaction(
    req: RuleRequest,
    determineOutcome: (value: number, ruleConfig: RuleConfig, ruleResult: RuleResult) => RuleResult,
    ruleRes: RuleResult,
    loggerService: LoggerService,
    ruleConfig: RuleConfig,
    databaseManager: DatabaseManagerInstance<ManagerConfig>,
    dataCache: DataCache
): Promise<RuleResult> {
    loggerService.log("Rule Received request", "handleTransaction");
    if(!ruleConfig.config.timeframes[0].threshold) throw new Error("Config Threshold not specified");
    if(!dataCache.dbtrAcctId) throw new Error("Data Cache does not have required dbtrAcctId");

    const transactionAmount = await (await databaseManager._pseudonymsDb.query(`
        FOR 
            doc
        IN 
            transactionRelationship
        FILTER
            doc.TxTp=="pacs.002.001.12"
            AND doc._from=="accounts/${dataCache.dbtrAcctId}"
            AND DATE_DIFF(DATE_TIMESTAMP(doc.CreDtTm), DATE_NOW(), "millisecond", false) <= ${ruleConfig.config.timeframes[0].threshold}
        COLLECT WITH COUNT INTO length
        RETURN 
            length
    `)).batches.all();
    if (!transactionAmount || !transactionAmount[0] || transactionAmount[0][0])
        throw new Error("Error while retrieving transaction history information");

    const outcome = await determineOutcome(transactionAmount[0][0], ruleConfig, ruleRes);
    ruleRes.reason = outcome.reason;
    ruleRes.result = outcome.result;
    ruleRes.subRuleRef = outcome.subRuleRef;
    loggerService.log(`Rule ${ruleRes.id}@${ruleRes.cfg} processed with outcome: ${ruleRes.subRuleRef}`);
    return ruleRes;
}
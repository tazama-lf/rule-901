// SPDX-License-Identifier: Apache-2.0

import { handleTransaction } from '../../src';
import { type DatabaseManagerInstance, LoggerService, CreateDatabaseManager, ManagerConfig } from '@tazama-lf/frms-coe-lib';
import { type Band, type DataCache, type RuleConfig, type RuleRequest, type RuleResult } from '@tazama-lf/frms-coe-lib/lib/interfaces';
import { RuleExecutorConfig } from '../../src/rule-901';

jest.mock('@tazama-lf/frms-coe-lib', () => {
  const original = jest.requireActual('@tazama-lf/frms-coe-lib');
  return {
    ...original,
    aql: jest.fn(),
  };
});

const getMockRequest = (): RuleRequest => {
  const quote = {
    transaction: JSON.parse(
      `{"TxTp":"pacs.002.001.12","FIToFIPmtSts":{"GrpHdr":{"MsgId":"6b444365119746c5be7dfb5516ba67c4","CreDtTm":"${new Date(
        'Mon Dec 03 2021 09:24:48 GMT+0000',
      ).toISOString()}"},"TxInfAndSts":{"OrgnlInstrId":"5ab4fc7355de4ef8a75b78b00a681ed2","OrgnlEndToEndId":"2c516801007642dfb892944dde1cf845","TxSts":"ACCC","ChrgsInf":[{"Amt":{"Amt":307.14,"Ccy":"USD"},"Agt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp001"}}}},{"Amt":{"Amt":153.57,"Ccy":"USD"},"Agt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp001"}}}},{"Amt":{"Amt":30.71,"Ccy":"USD"},"Agt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp002"}}}}],"AccptncDtTm":"2021-12-03T15:36:16.000Z","InstgAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp001"}}},"InstdAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp002"}}}}}}`,
    ),

    networkMap: JSON.parse(
      '{"_key":"26345403","_id":"networkConfiguration/26345403","_rev":"_cxc-1vO---","messages":[{"id":"004@1.0.0","cfg":"1.0.0","txTp":"pacs.002.001.12","channels":[{"id":"001@1.0.0","cfg":"1.0.0","typologies":[{"id":"901@1.0.0","cfg":"028@1.0","rules":[{"id":"004@1.0.0","cfg":"1.0.0"},{"id":"028@1.0","cfg":"1.0.0"}]},{"id":"029@1.0","cfg":"029@1.0","rules":[{"id":"003@1.0","cfg":"1.0"},{"id":"005@1.0","cfg":"1.0"}]}]},{"id":"002@1.0","cfg":"1.0","typologies":[{"id":"030@1.0","cfg":"030@1.0","rules":[{"id":"003@1.0","cfg":"1.0"},{"id":"006@1.0","cfg":"1.0"}]},{"id":"031@1.0","cfg":"031@1.0","rules":[{"id":"003@1.0","cfg":"1.0"},{"id":"007@1.0","cfg":"1.0"}]}]}]}]}',
    ),

    DataCache: {
      dbtrId: 'dbtr_516c7065d75b4fcea6fffb52a9539357',
      cdtrId: 'cdtr_b086a1e193794192b32c8af8550d721d',
      dbtrAcctId: 'dbtrAcct_1fd08e408c184dd28cbaeef03bff1af5',
      cdtrAcctId: 'cdtrAcct_d531e1ba4ed84a248fe26617e79fcb64',
      evtId: 'eventId',
      amt: {
        amt: 1234.56,
        ccy: 'XTS',
      },
      creDtTm: `${new Date(Date.now() - 60 * 1000).toISOString()}`,
    },
  };
  return quote as RuleRequest;
};

const databaseManagerConfig: RuleExecutorConfig = {
  pseudonyms: {
    certPath: '',
    databaseName: '',
    user: '',
    password: '',
    url: '',
  },
  transactionHistory: {
    certPath: '',
    databaseName: '',
    user: '',
    password: '',
    url: '',
  },
  configuration: {
    certPath: '',
    databaseName: '',
    user: '',
    password: '',
    url: '',
  },
  localCacheConfig: {
    localCacheEnabled: false,
    localCacheTTL: 0,
  },
};

let databaseManager: DatabaseManagerInstance<RuleExecutorConfig>;
let ruleRes: RuleResult;
const loggerService: LoggerService = new LoggerService({ maxCPU: 1, functionName: 'rule-901Test', nodeEnv: 'test' });

const ruleConfig: RuleConfig = {
  id: '901@1.0.0',
  cfg: '1.0.0',
  desc: 'Number of outgoing transactions - debtor',
  config: {
    parameters: {
      maxQueryRange: 86400000,
    },
    exitConditions: [
      {
        subRuleRef: '.x00',
        reason: 'Incoming transaction is unsuccessful',
      },
    ],
    bands: [
      {
        subRuleRef: '.01',
        upperLimit: 2,
        reason: 'The debtor has performed one transaction to date',
      },
      {
        subRuleRef: '.02',
        lowerLimit: 2,
        upperLimit: 4,
        reason: 'The debtor has performed two or three transactions to date',
      },
      {
        subRuleRef: '.03',
        lowerLimit: 4,
        reason: 'The debtor has performed 4 or more transactions to date',
      },
    ],
  },
};

beforeAll(async () => {
  databaseManager = await CreateDatabaseManager(databaseManagerConfig);
  ruleRes = {
    id: '901@1.0.0',
    cfg: '1.0.0',

    subRuleRef: '.00',
    reason: '',
  };
});

afterAll(() => {
  databaseManager.quit();
});

const determineOutcome = (value: number, ruleConfig: RuleConfig, ruleResult: RuleResult): RuleResult => {
  if (value != null) {
    if (ruleConfig.config.bands)
      for (const band of ruleConfig.config.bands) {
        if ((!band.lowerLimit || value >= band.lowerLimit) && (!band.upperLimit || value < band.upperLimit)) {
          ruleResult.subRuleRef = band.subRuleRef;

          ruleResult.reason = band.reason;
          break;
        }
      }
  } else throw new Error('Value provided undefined, so cannot determine rule outcome');
  return ruleResult;
};
let req: RuleRequest;
beforeEach(() => {
  req = getMockRequest();
});

describe('Happy path', () => {
  test('Should respond with .01: The debtor has performed one transaction to date', async () => {
    const mockQueryFn = jest.fn();
    const mockBatchesAllFn = jest.fn().mockResolvedValue([[1]]);
    databaseManager._pseudonymsDb.query = mockQueryFn.mockResolvedValue({
      batches: {
        all: mockBatchesAllFn,
      },
    });
    jest.spyOn(databaseManager._pseudonymsDb, 'query');

    const res = await handleTransaction(req, determineOutcome, ruleRes, loggerService, ruleConfig, databaseManager);

    expect(res).toEqual(
      JSON.parse('{"id":"901@1.0.0", "cfg":"1.0.0","subRuleRef":".01","reason":"The debtor has performed one transaction to date"}'),
    );
  });

  test('Should respond with .02: The debtor has performed two or three transactions to date', async () => {
    const mockQueryFn = jest.fn();

    const mockBatchesAllFn = jest.fn().mockResolvedValue([[2]]);
    databaseManager._pseudonymsDb.query = mockQueryFn.mockResolvedValue({
      batches: {
        all: mockBatchesAllFn,
      },
    });
    jest.spyOn(databaseManager._pseudonymsDb, 'query');

    const res = await handleTransaction(req, determineOutcome, ruleRes, loggerService, ruleConfig, databaseManager);

    expect(res).toEqual(
      JSON.parse(
        '{"id":"901@1.0.0", "cfg":"1.0.0","subRuleRef":".02","reason":"The debtor has performed two or three transactions to date"}',
      ),
    );
  });

  test('Should respond with .02: The debtor has performed two or three transactions to date', async () => {
    const mockQueryFn = jest.fn();

    const mockBatchesAllFn = jest.fn().mockResolvedValue([[3]]);
    databaseManager._pseudonymsDb.query = mockQueryFn.mockResolvedValue({
      batches: {
        all: mockBatchesAllFn,
      },
    });
    jest.spyOn(databaseManager._pseudonymsDb, 'query');

    const res = await handleTransaction(req, determineOutcome, ruleRes, loggerService, ruleConfig, databaseManager);

    expect(res).toEqual(
      JSON.parse(
        '{"id":"901@1.0.0", "cfg":"1.0.0","subRuleRef":".02","reason":"The debtor has performed two or three transactions to date"}',
      ),
    );
  });

  test('Should respond with .03: The debtor has performed 4 or more transactions to date', async () => {
    const mockQueryFn = jest.fn();

    const mockBatchesAllFn = jest.fn().mockResolvedValue([[4]]);
    databaseManager._pseudonymsDb.query = mockQueryFn.mockResolvedValue({
      batches: {
        all: mockBatchesAllFn,
      },
    });
    jest.spyOn(databaseManager._pseudonymsDb, 'query');

    const res = await handleTransaction(req, determineOutcome, ruleRes, loggerService, ruleConfig, databaseManager);

    expect(res).toEqual(
      JSON.parse('{"id":"901@1.0.0", "cfg":"1.0.0","subRuleRef":".03","reason":"The debtor has performed 4 or more transactions to date"}'),
    );
  });
});

describe('Exit conditions', () => {
  test('Should respond with .x00: Incoming transaction is unsuccessful', async () => {
    const mockQueryFn = jest.fn();

    const objClone = (req: Object) => JSON.parse(JSON.stringify(req));
    const newReq: RuleRequest = objClone(req);
    newReq.transaction.FIToFIPmtSts.TxInfAndSts.TxSts = 'something else';
    const res = await handleTransaction(newReq, determineOutcome, ruleRes, loggerService, ruleConfig, databaseManager);

    expect(res).toEqual(
      JSON.parse('{"id":"901@1.0.0", "cfg":"1.0.0","subRuleRef":".x00","reason":"Incoming transaction is unsuccessful"}'),
    );
  });
});

describe('Error conditions', () => {
  test('Unsuccessful transaction and no exit condition', async () => {
    const mockQueryFn = jest.fn();
    const mockBatchesAllFn = jest.fn().mockResolvedValue([[{ currentAmount: 14, highestAmount: 15 }]]);
    databaseManager._pseudonymsDb.query = mockQueryFn.mockResolvedValue({
      batches: {
        all: mockBatchesAllFn,
      },
    });
    jest.spyOn(databaseManager._pseudonymsDb, 'query');
    const objClone = (req: Object) => JSON.parse(JSON.stringify(req));
    const newReq: RuleRequest = objClone(req);
    newReq.transaction.FIToFIPmtSts.TxInfAndSts.TxSts = 'something else';
    const newConfig: RuleConfig = objClone(ruleConfig);
    newConfig.config.exitConditions![0].subRuleRef = 'something';
    try {
      await handleTransaction(newReq, determineOutcome, ruleRes, loggerService, newConfig, databaseManager);
    } catch (error) {
      expect((error as Error).message).toBe('Unsuccessful transaction and no exit condition in config');
    }
  });

  test('No transactions', async () => {
    const mockQueryFn = jest.fn();

    const mockBatchesAllFn = jest.fn().mockResolvedValue([[0]]);
    databaseManager._pseudonymsDb.query = mockQueryFn.mockResolvedValue({
      batches: {
        all: mockBatchesAllFn,
      },
    });
    jest.spyOn(databaseManager._pseudonymsDb, 'query');

    try {
      await handleTransaction(req, determineOutcome, ruleRes, loggerService, ruleConfig, databaseManager);
    } catch (error) {
      expect((error as Error).message).toBe('Data error: irretrievable transaction history');
    }
  });

  test('Not a number', async () => {
    const mockQueryFn = jest.fn();

    const mockBatchesAllFn = jest.fn().mockResolvedValue([['abc']]);
    databaseManager._pseudonymsDb.query = mockQueryFn.mockResolvedValue({
      batches: {
        all: mockBatchesAllFn,
      },
    });
    jest.spyOn(databaseManager._pseudonymsDb, 'query');

    try {
      await handleTransaction(req, determineOutcome, ruleRes, loggerService, ruleConfig, databaseManager);
    } catch (error) {
      expect((error as Error).message).toBe('Data error: query result type mismatch - expected a number');
    }
  });

  test('Invalid query result', async () => {
    // Mocking the request of getting oldes transation timestamp
    const mockQueryFn = jest.fn();
    const mockBatchesAllFn = jest.fn().mockResolvedValue([[undefined]]);
    databaseManager._pseudonymsDb.query = mockQueryFn.mockResolvedValue({
      batches: {
        all: mockBatchesAllFn,
      },
    });
    jest.spyOn(databaseManager._pseudonymsDb, 'query');

    try {
      await handleTransaction(req, determineOutcome, ruleRes, loggerService, ruleConfig, databaseManager);
    } catch (error) {
      expect((error as Error).message).toBe('Data error: irretrievable transaction history');
    }
  });

  test('No data cache', async () => {
    // Mocking the request of getting oldes transation timestamp
    const mockQueryFn = jest.fn();
    const mockBatchesAllFn = jest.fn().mockResolvedValue([[undefined]]);
    databaseManager._pseudonymsDb.query = mockQueryFn.mockResolvedValue({
      batches: {
        all: mockBatchesAllFn,
      },
    });
    jest.spyOn(databaseManager._pseudonymsDb, 'query');

    try {
      await handleTransaction(
        { ...req, DataCache: { ...req.DataCache, dbtrAcctId: undefined } },
        determineOutcome,
        ruleRes,
        loggerService,
        ruleConfig,
        databaseManager,
      );
    } catch (error) {
      expect((error as Error).message).toBe('Data Cache does not have required dbtrAcctId');
    }
  });

  test('Invalid config', async () => {
    const mockQueryFn = jest.fn();

    const mockBatchesAllFn = jest.fn().mockResolvedValue([['abc']]);
    databaseManager._pseudonymsDb.query = mockQueryFn.mockResolvedValue({
      batches: {
        all: mockBatchesAllFn,
      },
    });
    jest.spyOn(databaseManager._pseudonymsDb, 'query');

    try {
      await handleTransaction(
        req,
        determineOutcome,
        ruleRes,
        loggerService,
        {
          ...ruleConfig,
          config: { ...ruleConfig.config, parameters: undefined },
        },
        databaseManager,
      );
    } catch (error) {
      expect((error as Error).message).toBe('Invalid config provided - parameters not provided');
    }

    try {
      await handleTransaction(
        req,
        determineOutcome,
        ruleRes,
        loggerService,
        {
          ...ruleConfig,
          config: { ...ruleConfig.config, parameters: { '1': 2 } },
        },
        databaseManager,
      );
    } catch (error) {
      expect((error as Error).message).toBe('Invalid config provided - maxQueryRange parameter not provided');
    }

    try {
      await handleTransaction(
        req,
        determineOutcome,
        ruleRes,
        loggerService,
        {
          ...ruleConfig,
          config: { ...ruleConfig.config, exitConditions: undefined },
        },
        databaseManager,
      );
    } catch (error) {
      expect((error as Error).message).toBe('Invalid config provided - exitConditions not provided');
    }

    try {
      await handleTransaction(
        req,
        determineOutcome,
        ruleRes,
        loggerService,
        {
          ...ruleConfig,
          config: { ...ruleConfig.config, bands: [] },
        },
        databaseManager,
      );
    } catch (error) {
      expect((error as Error).message).toBe('Invalid config provided - bands not provided or empty');
    }

    try {
      await handleTransaction(
        req,
        determineOutcome,
        ruleRes,
        loggerService,
        {
          ...ruleConfig,
          config: {
            ...ruleConfig.config,
            bands: undefined as unknown as Band[],
          },
        },
        databaseManager,
      );
    } catch (error) {
      expect((error as Error).message).toBe('Invalid config provided - bands not provided or empty');
    }
  });
});
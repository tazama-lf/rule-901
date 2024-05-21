# Rule-901
Number of outgoing transactions - debtor

# Sample configuration
```json
{
  "_key": "901@1.0.0@1.0.0",
  "id": "901@1.0.0",
  "cfg": "1.0.0",
  "desc": "Number of outgoing transactions - debtor",
  "config": {
    "parameters": {
      "maxQueryRange": 86400000
    },
    "exitConditions": [
      {
        "subRuleRef": ".x00", 
        "reason": "Incoming transaction is unsuccessful"
      },
    ],
    "bands": [
      {
        "subRuleRef": ".01",
        "upperLimit": 2,
        "reason": "The debtor has performed one transaction to date"
      },
      {
        "subRuleRef": ".02",
        "lowerLimit": 2,
        "upperLimit": 4,
        "reason": "The debtor has performed two or three transactions to date"
      },
      {
        "subRuleRef": ".03",
        "lowerLimit": 4,
        "reason": "The debtor has performed 4 or more transactions to date"
      }
    ]
  }
}
```

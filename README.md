# Rule-901
Amount of transactions debtor made

# Sample configuration
```json
{
    "id": "901@1.0.0",
    "cfg": "1.0.0",
    "desc": "Amount of transactions debtor made",
    "config": {
      "exitConditions": [
        {
          "subRuleRef": ".x00",
          "outcome": false,
          "reason": "Unsuccessful transaction"
        }
      ],
      "timeframes": [
        {
          "threshold": 86400000
        }
      ],
      "bands": [
        {
          "subRuleRef": ".01",
          "upperLimit": 2,
          "outcome": true,
          "reason": "Debtor made less than two transactions"
        },
        {
          "subRuleRef": ".02",
          "lowerLimit": 2,
          "upperLimit": 3,
          "outcome": true,
          "reason": "Debtor made three transactions"
        },
        {
          "subRuleRef": ".03",
          "lowerLimit": 3,
          "outcome": false,
          "reason": "Debtor made four or more transactions"
        }
      ]
    }
  }
```

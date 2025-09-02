import { Idl } from '@coral-xyz/anchor';

const IDL_JSON = {
  "address": "CFTz6LKRNHgWJhYqPvQFYVjYAiCnkdLbK2KM5FDoUgPg",
  "metadata": {
    "name": "roomiesplit",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "add_expense",
      "discriminator": [
        171,
        23,
        8,
        240,
        62,
        31,
        254,
        144
      ],
      "accounts": [
        {
          "name": "group",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  114,
                  111,
                  117,
                  112
                ]
              },
              {
                "kind": "account",
                "path": "group.creator",
                "account": "Group"
              }
            ]
          }
        },
        {
          "name": "expense",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  120,
                  112,
                  101,
                  110,
                  115,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "group"
              },
              {
                "kind": "account",
                "path": "group.expense_count",
                "account": "Group"
              }
            ]
          }
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "description",
          "type": "string"
        }
      ]
    },
    {
      "name": "calculate_balances",
      "discriminator": [
        122,
        17,
        252,
        23,
        210,
        0,
        139,
        94
      ],
      "accounts": [
        {
          "name": "group",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  114,
                  111,
                  117,
                  112
                ]
              },
              {
                "kind": "account",
                "path": "group.creator",
                "account": "Group"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "create_group",
      "discriminator": [
        79,
        60,
        158,
        134,
        61,
        199,
        56,
        248
      ],
      "accounts": [
        {
          "name": "group",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  114,
                  111,
                  117,
                  112
                ]
              },
              {
                "kind": "account",
                "path": "creator"
              }
            ]
          }
        },
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "members",
          "type": {
            "vec": "pubkey"
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "Expense",
      "discriminator": [
        49,
        167,
        206,
        160,
        209,
        254,
        24,
        100
      ]
    },
    {
      "name": "Group",
      "discriminator": [
        209,
        249,
        208,
        63,
        182,
        89,
        186,
        254
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "TooManyMembers",
      "msg": "Too many members in group"
    },
    {
      "code": 6001,
      "name": "NotMember",
      "msg": "User is not a member of this group"
    },
    {
      "code": 6002,
      "name": "InvalidAmount",
      "msg": "Invalid expense amount"
    },
    {
      "code": 6003,
      "name": "NoMembers",
      "msg": "Group has no members"
    }
  ],
  "types": [
    {
      "name": "Balance",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "member",
            "type": "pubkey"
          },
          {
            "name": "owed",
            "type": "i64"
          },
          {
            "name": "spent",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "Expense",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "expense_id",
            "type": "u64"
          },
          {
            "name": "group",
            "type": "pubkey"
          },
          {
            "name": "payer",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "description",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "Group",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "members",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "total_expenses",
            "type": "u64"
          },
          {
            "name": "expense_count",
            "type": "u64"
          },
          {
            "name": "balances",
            "type": {
              "vec": {
                "defined": {
                  "name": "Balance"
                }
              }
            }
          }
        ]
      }
    }
  ]
} as const;

export const IDL: Idl = IDL_JSON as any;
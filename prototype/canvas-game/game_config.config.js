/* Generated prototype config (data, not code) — composed by backend/prototype/scaffold.py
 * from an approved PrototypePlan + rule set. Edit the kit (runtime.js/modules.js) for
 * behaviour; edit this file for content. */
window.GAME_CONFIG = {
  "title": "Build",
  "canvas": {
    "W": 960,
    "H": 600
  },
  "first": "MENU",
  "seed": 123456789,
  "labels": {
    "characterPrompt": "Choose your character",
    "locationPrompt": "Choose a stage",
    "locationCta": "Start",
    "action": "Press SPACE to act",
    "finish": "Finish",
    "count": "GOT",
    "results": "RESULTS",
    "unit": "pts",
    "item": "item",
    "playAgain": "Play again",
    "home": "BASE",
    "miniGame": "Hold SPACE to keep the dot in the green zone",
    "tiers": [
      "",
      "LOW",
      "MID",
      "TOP"
    ]
  },
  "assets": {
    "screens": {},
    "sprites": {}
  },
  "data": {
    "sessionSeconds": 120,
    "resultsState": "LEADERBOARD",
    "avatarSprite": "avatar",
    "charIndex": 0,
    "locationIndex": 0,
    "collected": [],
    "phase": "roam",
    "characters": [
      {
        "name": "Player One"
      },
      {
        "name": "Player Two"
      }
    ],
    "locations": [
      {
        "name": "Stage 1",
        "diff": "Easy",
        "mix": [
          1,
          1,
          1,
          2,
          2
        ]
      },
      {
        "name": "Stage 2",
        "diff": "Medium",
        "mix": [
          1,
          2,
          2,
          2,
          3
        ]
      },
      {
        "name": "Stage 3",
        "diff": "Hard",
        "mix": [
          1,
          2,
          3,
          3,
          3
        ]
      }
    ],
    "gear": [
      {
        "label": "Tool",
        "name": "Starter"
      }
    ],
    "itemTypes": [
      {
        "type": "Item A"
      },
      {
        "type": "Item B"
      },
      {
        "type": "Item C"
      }
    ],
    "tables": {}
  },
  "mechanics": [
    "SessionTimer",
    "DeterministicPlay"
  ],
  "states": [
    {
      "name": "MENU",
      "screen": "Menu",
      "cfg": {
        "title": "MENU",
        "navLabels": [
          "CHOOSEDIFFICUL",
          "STORE",
          "SETTINGS",
          "FACTIONANDCHAR",
          "INVENTORY",
          "HELP",
          "LEADERBOARD",
          "VIEWREPLAYS",
          "TECHTREE"
        ],
        "labels": [
          "CHOOSEDIFFICUL",
          "STORE",
          "SETTINGS",
          "FACTIONANDCHAR",
          "INVENTORY",
          "HELP",
          "LEADERBOARD",
          "VIEWREPLAYS",
          "TECHTREE"
        ],
        "back": "CHOOSEDIFFICUL"
      },
      "next": [
        "CHOOSEDIFFICUL",
        "STORE",
        "SETTINGS",
        "FACTIONANDCHAR",
        "INVENTORY",
        "HELP",
        "LEADERBOARD",
        "VIEWREPLAYS",
        "TECHTREE"
      ]
    },
    {
      "name": "CHOOSEDIFFICUL",
      "screen": "Stub",
      "cfg": {
        "title": "CHOOSE DIFFICULTY",
        "navLabels": [
          "GAMEPLAY"
        ],
        "labels": [
          "GAMEPLAY"
        ],
        "back": "GAMEPLAY"
      },
      "next": [
        "GAMEPLAY"
      ]
    },
    {
      "name": "STORE",
      "screen": "Store",
      "cfg": {
        "title": "STORE",
        "navLabels": [
          "MENU"
        ],
        "labels": [
          "MENU"
        ],
        "back": "MENU"
      },
      "next": [
        "MENU"
      ]
    },
    {
      "name": "SETTINGS",
      "screen": "Settings",
      "cfg": {
        "title": "SETTINGS",
        "navLabels": [
          "MENU",
          "STATESHARNESS"
        ],
        "labels": [
          "MENU",
          "STATESHARNESS"
        ],
        "back": "MENU"
      },
      "next": [
        "MENU",
        "STATESHARNESS"
      ]
    },
    {
      "name": "FACTIONANDCHAR",
      "screen": "Stub",
      "cfg": {
        "title": "FACTION AND CHARS",
        "navLabels": [
          "MENU"
        ],
        "labels": [
          "MENU"
        ],
        "back": "MENU"
      },
      "next": [
        "MENU"
      ]
    },
    {
      "name": "INVENTORY",
      "screen": "Inventory",
      "cfg": {
        "title": "INVENTORY",
        "navLabels": [
          "MENU"
        ],
        "labels": [
          "MENU"
        ],
        "back": "MENU"
      },
      "next": [
        "MENU"
      ]
    },
    {
      "name": "HELP",
      "screen": "Stub",
      "cfg": {
        "title": "HELP",
        "navLabels": [
          "MENU"
        ],
        "labels": [
          "MENU"
        ],
        "back": "MENU"
      },
      "next": [
        "MENU"
      ]
    },
    {
      "name": "LEADERBOARD",
      "screen": "Stub",
      "cfg": {
        "title": "LEADERBOARD",
        "navLabels": [
          "MENU"
        ],
        "labels": [
          "MENU"
        ],
        "back": "MENU"
      },
      "next": [
        "MENU"
      ]
    },
    {
      "name": "VIEWREPLAYS",
      "screen": "PlayField",
      "cfg": {
        "title": "VIEW REPLAYS",
        "navLabels": [
          "MENU"
        ],
        "labels": [
          "MENU"
        ]
      },
      "next": [
        "MENU"
      ],
      "gameplay": true
    },
    {
      "name": "TECHTREE",
      "screen": "Stub",
      "cfg": {
        "title": "Tech Tree",
        "navLabels": [
          "MENU"
        ],
        "labels": [
          "MENU"
        ],
        "back": "MENU"
      },
      "next": [
        "MENU"
      ]
    },
    {
      "name": "GAMEPLAY",
      "screen": "PlayField",
      "cfg": {
        "title": "PLAY",
        "navLabels": [
          "RESULTS"
        ],
        "labels": [
          "RESULTS"
        ]
      },
      "next": [
        "RESULTS"
      ],
      "gameplay": true
    },
    {
      "name": "STATESHARNESS",
      "screen": "Stub",
      "cfg": {
        "title": "STATES HARNESS",
        "navLabels": [
          "SETTINGS"
        ],
        "labels": [
          "SETTINGS"
        ],
        "back": "SETTINGS"
      },
      "next": [
        "SETTINGS"
      ]
    },
    {
      "name": "RESULTS",
      "screen": "Stub",
      "cfg": {
        "title": "RESULTS",
        "navLabels": [
          "MENU"
        ],
        "labels": [
          "MENU"
        ],
        "back": "MENU"
      },
      "next": [
        "MENU"
      ]
    },
    {
      "name": "LOADINGSCREEN",
      "screen": "Stub",
      "cfg": {
        "title": "LOADING SCREEN",
        "navLabels": [
          "MENU"
        ],
        "labels": [
          "MENU"
        ],
        "back": "MENU"
      },
      "next": [
        "MENU"
      ]
    }
  ]
};

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
    "screens": {
      "SC_scrab5f1vj": "content/screens/SC_scrab5f1vj.png",
      "SC_scrbky3bf6": "content/screens/SC_scrbky3bf6.png",
      "SC_scru4678ee": "content/screens/SC_scru4678ee.png",
      "SC_scrzc7dhlv": "content/screens/SC_scrzc7dhlv.png",
      "SC_scrrskt6dn": "content/screens/SC_scrrskt6dn.png",
      "SC_scrae09vxa": "content/screens/SC_scrae09vxa.png",
      "SC_scrwp1ium2": "content/screens/SC_scrwp1ium2.png",
      "SC_scrlcmu93t": "content/screens/SC_scrlcmu93t.png",
      "SC_screr2mf9n": "content/screens/SC_screr2mf9n.png",
      "SC_scr29xml07": "content/screens/SC_scr29xml07.png",
      "SC_scrm8rpgxd": "content/screens/SC_scrm8rpgxd.png",
      "SC_scrxn5t664": "content/screens/SC_scrxn5t664.png"
    },
    "sprites": {
      "4typeoftopdownviewofcomi": "content/sprites/4typeoftopdownviewofcomi.png",
      "art17top": "content/sprites/art17top.png",
      "art23top": "content/sprites/art23top.png",
      "art29top": "content/sprites/art29top.png",
      "art34top": "content/sprites/art34top.png",
      "art8top": "content/sprites/art8top.png",
      "chaplaingunnerruthbellam": "content/sprites/chaplaingunnerruthbellam.png",
      "envoylyra9theleaderofthe": "content/sprites/envoylyra9theleaderofthe.png",
      "mothersporeilyaleaderoft": "content/sprites/mothersporeilyaleaderoft.png",
      "sheet": "content/sprites/sheet.png",
      "tidepriestessmarenaleade": "content/sprites/tidepriestessmarenaleade.png",
      "topdownviewof4typesofsep": "content/sprites/topdownviewof4typesofsep.png"
    }
  },
  "data": {
    "sessionSeconds": 120,
    "resultsState": "LEADERBOARD",
    "avatarSprite": "4typeoftopdownviewofcomi",
    "charIndex": 0,
    "locationIndex": 0,
    "collected": [],
    "phase": "roam",
    "characters": [
      {
        "name": "Player One",
        "spr": "4typeoftopdownviewofcomi"
      },
      {
        "name": "Player Two",
        "spr": "art17top"
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
    ]
  },
  "mechanics": [
    "SessionTimer",
    "DeterministicPlay"
  ],
  "states": [
    {
      "name": "MENU",
      "screen": "Stub",
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
          "VIEWREPLAYS"
        ],
        "labels": [
          "CHOOSEDIFFICUL",
          "STORE",
          "SETTINGS",
          "FACTIONANDCHAR",
          "INVENTORY",
          "HELP",
          "LEADERBOARD",
          "VIEWREPLAYS"
        ],
        "asset": "SC_scrab5f1vj",
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
        "VIEWREPLAYS"
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
        "asset": "SC_scru4678ee",
        "back": "GAMEPLAY"
      },
      "next": [
        "GAMEPLAY"
      ]
    },
    {
      "name": "STORE",
      "screen": "Stub",
      "cfg": {
        "title": "STORE",
        "navLabels": [
          "MENU"
        ],
        "labels": [
          "MENU"
        ],
        "asset": "SC_scrrskt6dn",
        "back": "MENU"
      },
      "next": [
        "MENU"
      ]
    },
    {
      "name": "SETTINGS",
      "screen": "Stub",
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
        "asset": "SC_screr2mf9n",
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
        "asset": "SC_scrm8rpgxd",
        "back": "MENU"
      },
      "next": [
        "MENU"
      ]
    },
    {
      "name": "INVENTORY",
      "screen": "Stub",
      "cfg": {
        "title": "INVENTORY",
        "navLabels": [
          "MENU"
        ],
        "labels": [
          "MENU"
        ],
        "asset": "SC_scrae09vxa",
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
        "asset": "SC_scrbky3bf6",
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
        "asset": "SC_scrwp1ium2",
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
        ],
        "asset": "SC_scrlcmu93t"
      },
      "next": [
        "MENU"
      ],
      "gameplay": true
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
        ],
        "asset": "SC_scrzc7dhlv"
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
        "asset": "SC_scr29xml07",
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
        "asset": "SC_scrxn5t664",
        "back": "MENU"
      },
      "next": [
        "MENU"
      ]
    }
  ]
};

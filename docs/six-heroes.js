export const SIX_HEROES = [
  {
    "id": "ailianna",
    "name": "爱莲娜之誓",
    "role": "output",
    "base": {
      "hp": 410,
      "atk": 64,
      "def": 16,
      "interval": 2.4,
      "intervalSeconds": 2.4
    },
    "weapons": {
      "main": [
        "战刃",
        "拳套"
      ],
      "off": [],
      "twoHandCannotUseOffhand": true
    },
    "row": "后排",
    "active": {
      "name": "刃舞",
      "cd": 10,
      "coefficient": 1.55,
      "targets": "all",
      "singleMultiplier": 2.5,
      "cooldownSeconds": 10,
      "kind": "ailianna"
    },
    "passive": {
      "name": "牛马",
      "allyCastReduction": 0.5,
      "kind": "ailianna"
    },
    "star3Fields": [
      "active.coefficient"
    ],
    "star5": {
      "name": "熟练加班",
      "allyCastsRequired": 6,
      "nextBladeMultiplier": 1.15
    },
    "recommendedRow": "back"
  },
  {
    "id": "mozhate",
    "name": "魔扎特",
    "role": "tank",
    "base": {
      "hp": 630,
      "atk": 42,
      "def": 28,
      "interval": 2.8,
      "intervalSeconds": 2.8
    },
    "weapons": {
      "main": [
        "战刃",
        "拳套"
      ],
      "off": [],
      "twoHandCannotUseOffhand": true
    },
    "row": "前排",
    "active": {
      "name": "灵魂裂劈",
      "cd": 8,
      "coefficient": 0.8,
      "targets": 3,
      "baseHealMaxHp": 0.04,
      "healPerSoulMaxHp": 0.035,
      "cooldownSeconds": 8,
      "kind": "mozhate"
    },
    "passive": {
      "name": "灵魂残片",
      "lossPerSoulMaxHp": 0.1,
      "maxSouls": 5,
      "kind": "mozhate"
    },
    "star3Fields": [
      "active.coefficient",
      "active.baseHealMaxHp",
      "active.healPerSoulMaxHp"
    ],
    "star5": {
      "name": "残魂余温",
      "postConsumeReduction": 0.08,
      "duration": 3
    },
    "recommendedRow": "front"
  },
  {
    "id": "jinnailuo",
    "name": "紧奈洛丶",
    "role": "output",
    "base": {
      "hp": 380,
      "atk": 65,
      "def": 13,
      "interval": 2.5,
      "intervalSeconds": 2.5
    },
    "weapons": {
      "main": [
        "法杖",
        "单手剑",
        "匕首",
        "魔杖"
      ],
      "off": [
        "护符"
      ],
      "twoHandCannotUseOffhand": true
    },
    "row": "后排",
    "active": {
      "name": "冰风暴",
      "cd": 9,
      "coefficient": 2.5,
      "targets": 2,
      "chillDuration": 6,
      "actionRateReduction": 0.15,
      "cooldownSeconds": 9,
      "kind": "jinnailuo"
    },
    "passive": {
      "name": "碎冰",
      "chilledBasicCoefficient": 1.25,
      "secondaryCoefficient": 0.4,
      "secondaryTargets": 1,
      "kind": "jinnailuo"
    },
    "star3Fields": [
      "active.coefficient"
    ],
    "star5": {
      "name": "余寒",
      "chillDuration": 8
    },
    "recommendedRow": "back"
  },
  {
    "id": "juwoyaer",
    "name": "居沃亚尔",
    "role": "output",
    "base": {
      "hp": 455,
      "atk": 61,
      "def": 21,
      "interval": 2.6,
      "intervalSeconds": 2.6
    },
    "weapons": {
      "main": [
        "双手剑",
        "双手斧",
        "双手锤"
      ],
      "off": [],
      "twoHandCannotUseOffhand": true
    },
    "row": "后排",
    "active": {
      "name": "处决宣判",
      "cd": 12,
      "coefficient": 3.2,
      "targets": 1,
      "windowBasics": 3,
      "windowSeconds": 12,
      "settlementRatio": 0.5,
      "cooldownSeconds": 12,
      "kind": "juwoyaer"
    },
    "passive": {
      "name": "神圣风暴",
      "mainCoefficient": 1,
      "secondaryCoefficient": 0.35,
      "targets": "all",
      "kind": "juwoyaer"
    },
    "star3Fields": [
      "active.coefficient"
    ],
    "star5": {
      "name": "终审",
      "settlementRatio": 0.6
    },
    "recommendedRow": "back"
  },
  {
    "id": "zhangdanaodai",
    "name": "张大脑袋",
    "role": "tank",
    "base": {
      "hp": 625,
      "atk": 40,
      "def": 30,
      "interval": 2.8,
      "intervalSeconds": 2.8
    },
    "weapons": {
      "main": [
        "单手剑",
        "单手斧",
        "单手锤"
      ],
      "off": [
        "盾牌"
      ],
      "twoHandCannotUseOffhand": true
    },
    "row": "前排",
    "active": {
      "name": "复仇者之盾",
      "cd": 8,
      "coefficient": 1.5,
      "targets": 3,
      "cooldownSeconds": 8,
      "kind": "zhangdanaodai"
    },
    "passive": {
      "name": "秩序壁垒",
      "damageToShield": 2,
      "ownShieldMaxHp": 0.3,
      "duration": 8,
      "kind": "zhangdanaodai"
    },
    "star3Fields": [
      "active.coefficient"
    ],
    "star5": {
      "name": "壁垒余护",
      "postCastReduction": 0.06,
      "duration": 4
    },
    "recommendedRow": "front"
  },
  {
    "id": "dunjigaoshou",
    "name": "炖鸡高手",
    "role": "healer",
    "base": {
      "hp": 440,
      "atk": 40,
      "def": 23,
      "interval": 2.8,
      "intervalSeconds": 2.8
    },
    "weapons": {
      "main": [
        "单手剑",
        "单手斧",
        "单手锤"
      ],
      "off": [
        "盾牌"
      ],
      "twoHandCannotUseOffhand": true
    },
    "row": "后排",
    "active": {
      "name": "正义盾击",
      "cd": 9,
      "coefficient": 0.7,
      "targets": "all",
      "cooldownSeconds": 9,
      "kind": "dunjigaoshou"
    },
    "passive": {
      "name": "光铸祝福",
      "healPerAllyAtk": 1.5,
      "includeSelf": true,
      "canCrit": false,
      "trigger": "successful_original_cast",
      "kind": "dunjigaoshou"
    },
    "star3Fields": [
      "active.coefficient"
    ],
    "star5": {
      "name": "温暖余光",
      "healPerAllyAtk": 1.65
    },
    "recommendedRow": "back"
  }
];
export const RETIRED_HERO_IDS=['yan','lan','jin','shuo','ling'];
export const ROSTER_REVISION='roster-20260922';

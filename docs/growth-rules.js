// Adopted numerical design v0.26; UI v0.6.
export const GROWTH_REVISION = 'rewind-growth-v0.26';
export const RETIRED_TALENTS = ["P01","P02","P05","P06","P11"];
export const GROWTH_TALENTS = [
  {
    "id": "P03",
    "branch": "战斗",
    "name": "耐久训练",
    "effect": "hp_pct",
    "per_level": 0.03,
    "max_level": null,
    "max_effect": null,
    "costs": null,
    "total_cost": null,
    "prerequisites": [],
    "cost_family": "infinite_base_stat_polynomial"
  },
  {
    "id": "P04",
    "branch": "支援",
    "name": "风险应对",
    "effect": "extra_damage_reduction",
    "per_level": 0.005,
    "max_level": 10,
    "max_effect": 0.05,
    "costs": [
      8,
      13,
      20,
      30,
      47,
      72,
      111,
      172,
      267,
      414
    ],
    "total_cost": 1154,
    "prerequisites": [],
    "cost_family": "finite_utility_geometric"
  },
  {
    "id": "P07",
    "branch": "经济",
    "name": "后勤扩容",
    "effect": "idle_gold_pct",
    "per_level": 0.03,
    "max_level": 15,
    "max_effect": 0.44999999999999996,
    "costs": [
      8,
      13,
      20,
      30,
      47,
      72,
      111,
      172,
      267,
      414,
      641,
      993,
      1539,
      2385,
      3697
    ],
    "total_cost": 10409,
    "prerequisites": [],
    "cost_family": "finite_utility_geometric"
  },
  {
    "id": "P08",
    "branch": "经济",
    "name": "节料工艺",
    "effect": "upgrade_discount",
    "per_level": 0.01,
    "max_level": 12,
    "max_effect": 0.12,
    "costs": [
      8,
      13,
      20,
      30,
      47,
      72,
      111,
      172,
      267,
      414,
      641,
      993
    ],
    "total_cost": 2788,
    "prerequisites": [],
    "cost_family": "finite_utility_geometric"
  },
  {
    "id": "P09",
    "branch": "经济",
    "name": "招募联络",
    "effect": "idle_recruit_pct",
    "per_level": 0.01,
    "max_level": 10,
    "max_effect": 0.1,
    "costs": [
      8,
      13,
      20,
      30,
      47,
      72,
      111,
      172,
      267,
      414
    ],
    "total_cost": 1154,
    "prerequisites": [],
    "cost_family": "finite_utility_geometric"
  },
  {
    "id": "P10",
    "branch": "搜集",
    "name": "品质复检",
    "effect": "one_step_quality_promotion_chance",
    "per_level": 0.01,
    "max_level": 10,
    "max_effect": 0.1,
    "costs": [
      8,
      13,
      20,
      30,
      47,
      72,
      111,
      172,
      267,
      414
    ],
    "total_cost": 1154,
    "prerequisites": [],
    "cost_family": "finite_utility_geometric"
  },
  {
    "id": "P12",
    "branch": "搜集",
    "name": "拆解回收",
    "effect": "base_salvage_pct",
    "per_level": 0.02,
    "max_level": 10,
    "max_effect": 0.2,
    "costs": [
      8,
      13,
      20,
      30,
      47,
      72,
      111,
      172,
      267,
      414
    ],
    "total_cost": 1154,
    "prerequisites": [],
    "cost_family": "finite_utility_geometric"
  },
  {
    "id": "P13",
    "branch": "战斗",
    "name": "攻势积累",
    "effect": "atk_pct",
    "per_level": 0.03,
    "max_level": null,
    "max_effect": null,
    "costs": null,
    "total_cost": null,
    "prerequisites": [],
    "cost_family": "infinite_base_stat_polynomial"
  },
  {
    "id": "P14",
    "branch": "战斗",
    "name": "防线积累",
    "effect": "def_pct",
    "per_level": 0.03,
    "max_level": null,
    "max_effect": null,
    "costs": null,
    "total_cost": null,
    "prerequisites": [],
    "cost_family": "infinite_base_stat_polynomial"
  },
  {
    "id": "P15",
    "branch": "战斗",
    "name": "精准训练",
    "effect": "crit_pct",
    "per_level": 0.01,
    "max_level": 10,
    "max_effect": 0.1,
    "costs": [
      8,
      13,
      20,
      30,
      47,
      72,
      111,
      172,
      267,
      414
    ],
    "total_cost": 1154,
    "prerequisites": [],
    "cost_family": "finite_utility_geometric"
  },
  {
    "id": "P16",
    "branch": "战斗",
    "name": "致命训练",
    "effect": "crit_damage_pct",
    "per_level": 0.03,
    "max_level": 10,
    "max_effect": 0.3,
    "costs": [
      8,
      13,
      20,
      30,
      47,
      72,
      111,
      172,
      267,
      414
    ],
    "total_cost": 1154,
    "prerequisites": [],
    "cost_family": "finite_utility_geometric"
  },
  {
    "id": "P17",
    "branch": "养成",
    "name": "回溯积累",
    "effect": "rebirth_income_pct",
    "per_level": 0.05,
    "max_level": 10,
    "max_effect": 0.5,
    "costs": [
      8,
      13,
      20,
      30,
      47,
      72,
      111,
      172,
      267,
      414
    ],
    "total_cost": 1154,
    "prerequisites": [],
    "cost_family": "finite_utility_geometric"
  }
];
export const BREAKTHROUGH_PHASES = [
  {
    "id": "attribute_2",
    "starRequired": 2,
    "maxLevel": 5,
    "perLevel": 0.01,
    "scope": "hp_atk_def",
    "costs": [
      5,
      10,
      15,
      20,
      25
    ],
    "totalCost": 75
  },
  {
    "id": "skill_3",
    "starRequired": 3,
    "maxLevel": 5,
    "perLevel": 0.02,
    "scope": "per_hero_whitelisted_original_active_coefficients",
    "costs": [
      10,
      20,
      30,
      40,
      50
    ],
    "totalCost": 150
  },
  {
    "id": "attribute_4",
    "starRequired": 4,
    "maxLevel": 5,
    "perLevel": 0.01,
    "scope": "hp_atk_def",
    "costs": [
      20,
      40,
      60,
      80,
      100
    ],
    "totalCost": 300
  }
];

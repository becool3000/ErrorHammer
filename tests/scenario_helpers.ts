import { createInitialSkills } from "../src/core/playerFlow";
import { createInitialGameState } from "../src/core/resolver";
import { ContentBundle, EventDef, GameState } from "../src/core/types";

export function makeScenarioBundle(): ContentBundle {
  return {
    tools: [
      {
        id: "hammer",
        name: "Hammer",
        tier: 1,
        price: 30,
        maxDurability: 6,
        tags: ["carpenter", "framer"],
        flavor: {
          description: "Reliable impact.",
          quip_buy: "Purchased confidence.",
          quip_break: "Retired by physics."
        }
      },
      {
        id: "drill",
        name: "Drill",
        tier: 2,
        price: 90,
        maxDurability: 8,
        tags: ["electrician", "solar_panel_installer"],
        flavor: {
          description: "Very loud certainty.",
          quip_buy: "Purchased speed.",
          quip_break: "Now hums nostalgically."
        }
      },
      {
        id: "saw",
        name: "Saw",
        tier: 2,
        price: 70,
        maxDurability: 7,
        tags: ["carpenter", "millworker"],
        flavor: {
          description: "Straight cuts.",
          quip_buy: "Purchased sawdust.",
          quip_break: "Teeth became philosophy."
        }
      }
    ],
    jobs: [
      {
        id: "job-alpha",
        name: "Porch Anchor",
        primarySkill: "framer",
        tier: 1,
        districtId: "residential",
        requiredTools: ["hammer"],
        staminaCost: 2,
        basePayout: 200,
        risk: 0.1,
        repGainSuccess: 4,
        repLossFail: 2,
        durabilityCost: 2,
        workUnits: 3,
        materialNeeds: [
          { supplyId: "anchor-set", quantity: 1 },
          { supplyId: "fastener-box", quantity: 1 }
        ],
        tags: ["outdoor", "framer", "residential"],
        flavor: {
          client_quote: "Please make it less dramatic.",
          success_line: "The porch now trusts gravity.",
          fail_line: "The porch remains interpretive.",
          neutral_line: "The porch improved in committee-approved ways."
        }
      },
      {
        id: "job-beta",
        name: "Panel Rewire",
        primarySkill: "electrician",
        tier: 2,
        districtId: "residential",
        requiredTools: ["drill"],
        staminaCost: 2,
        basePayout: 260,
        risk: 0.18,
        repGainSuccess: 5,
        repLossFail: 2,
        durabilityCost: 3,
        workUnits: 4,
        materialNeeds: [
          { supplyId: "wire-spool", quantity: 2 },
          { supplyId: "junction-box", quantity: 1 }
        ],
        tags: ["electrician", "indoor", "commercial"],
        flavor: {
          client_quote: "I would enjoy fewer sparks.",
          success_line: "The panel now behaves professionally.",
          fail_line: "The panel still negotiates with fire.",
          neutral_line: "The panel reached a modest understanding."
        }
      },
      {
        id: "job-gamma",
        name: "Trim Rescue",
        primarySkill: "carpenter",
        tier: 1,
        districtId: "residential",
        requiredTools: ["saw"],
        staminaCost: 2,
        basePayout: 150,
        risk: 0.05,
        repGainSuccess: 3,
        repLossFail: 1,
        durabilityCost: 2,
        workUnits: 2,
        materialNeeds: [
          { supplyId: "trim-kit", quantity: 1 },
          { supplyId: "paint-sleeve", quantity: 1 }
        ],
        tags: ["carpenter", "indoor", "residential"],
        flavor: {
          client_quote: "Please give the corners a better upbringing.",
          success_line: "The trim accepted right angles.",
          fail_line: "The trim embraced modernism.",
          neutral_line: "The trim looked fine from the doorway."
        }
      }
    ],
    babaJobs: [
      {
        id: "job-baba-g",
        name: "Baba G Roof Bucket Rotation",
        primarySkill: "roofer",
        tier: 1,
        districtId: "residential",
        requiredTools: ["hammer"],
        staminaCost: 2,
        basePayout: 120,
        risk: 0.62,
        repGainSuccess: 3,
        repLossFail: 2,
        durabilityCost: 2,
        workUnits: 2,
        materialNeeds: [
          { supplyId: "anchor-set", quantity: 1 },
          { supplyId: "fastener-box", quantity: 1 }
        ],
        tags: ["baba-g", "roof", "absurd"],
        flavor: {
          client_quote: "The roof leaks in six accents today. Please assign each drip a bucket.",
          success_line: "Buckets aligned and the leaks respected boundaries.",
          fail_line: "The roof mocked the bucket strategy and evolved.",
          neutral_line: "The leak intensity dropped, but only to a manageable panic."
        }
      },
      {
        id: "job-baba-g-2",
        name: "Baba G Grease Trap Waltz",
        primarySkill: "plumber",
        tier: 1,
        districtId: "residential",
        requiredTools: ["drill"],
        staminaCost: 2,
        basePayout: 118,
        risk: 0.68,
        repGainSuccess: 3,
        repLossFail: 2,
        durabilityCost: 2,
        workUnits: 2,
        materialNeeds: [
          { supplyId: "wire-spool", quantity: 1 },
          { supplyId: "junction-box", quantity: 1 }
        ],
        tags: ["baba-g", "plumber", "absurd"],
        flavor: {
          client_quote: "Grease trap sounds like jazz. Please restore regular percussion.",
          success_line: "Trap calmed down and stopped improvising.",
          fail_line: "Trap gained confidence and a brass section.",
          neutral_line: "Trap is quieter, but still clearly opinionated."
        }
      }
    ],
    events: [
      {
        id: "event-rain",
        name: "Rain",
        weight: 1,
        mods: {
          payoutMultByTag: { outdoor: 0.8 },
          riskDeltaByTag: { outdoor: 0.1 }
        },
        flavor: {
          headline: "Rain Has Notes",
          detail: "Outdoor schedules turned into literature.",
          impact_line: "Outdoor work is slower and riskier.",
          success_line: "The rain allowed one decent decision.",
          fail_line: "The rain remained unconvinced.",
          neutral_line: "The rain observed and judged."
        }
      },
      {
        id: "event-sale",
        name: "Hardware Sale",
        weight: 1,
        mods: {
          toolPriceMult: 0.5
        },
        flavor: {
          headline: "Hardware Sale",
          detail: "Shelves are feeling generous.",
          impact_line: "Tools and supplies feel cheaper today.",
          success_line: "Discounts were witnessed.",
          fail_line: "The sale ended mid-thought.",
          neutral_line: "The sale existed briefly."
        }
      }
    ],
    districts: [
      {
        id: "residential",
        name: "Residential",
        tier: 1,
        travel: {
          shopToSiteTicks: 2,
          shopToSiteFuel: 1,
          supplierToSiteTicks: 2,
          supplierToSiteFuel: 1
        },
        flavor: {
          description: "Starter district."
        }
      }
    ],
    bots: [
      {
        id: "doug",
        name: "Doug",
        weights: {
          wCash: 1,
          wRep: 0.5,
          wRiskAvoid: 0.5,
          wToolBuy: 1
        },
        flavorLines: ["Doug bought two identical hammers to avoid favoritism."]
      }
    ],
    supplies: [
      supply("anchor-set", "Anchor Set", 18, ["general", "fastener"]),
      supply("fastener-box", "Fastener Box", 16, ["fastener", "general"]),
      supply("wire-spool", "Wire Spool", 26, ["electrical"]),
      supply("junction-box", "Junction Box", 21, ["electrical"]),
      supply("trim-kit", "Trim Kit", 20, ["finish"]),
      supply("paint-sleeve", "Paint Sleeve", 12, ["finish"]),
      supply("board-pack", "Board Pack", 32, ["framing"]),
      supply("sealant-tube", "Sealant Tube", 15, ["seal"]),
      supply("pipe-kit", "Pipe Kit", 28, ["plumbing"]),
      supply("hinge-pack", "Hinge Pack", 22, ["mechanical"]),
      supply("roof-patch", "Roof Patch", 30, ["roof"]),
      supply("safety-kit", "Safety Kit", 14, ["inspection"])
    ],
    strings: {
      title: "Error Hammer",
      subtitle: "You did the work. The work happened.",
      continueMissing: "No save file.",
      continueIncompatible: "Old save file.",
      dayReportTitle: "Field Log",
      storeTitle: "Store",
      companyTitle: "Company",
      supplierTitle: "Supplier",
      workdayTitle: "Workday",
      assignmentHint: "Accept jobs.",
      noContracts: "No contracts.",
      neutralLogFallback: "The day resolved in a shrug.",
      crewDeferred: "Crews are deferred.",
      fuelLabel: "Fuel",
      homeSuppliesTitle: "Home Supplies",
      truckSuppliesTitle: "Truck Supplies",
      siteSuppliesTitle: "Site Supplies",
      skillsTitle: "Skills",
      activeJobTitle: "Active Job",
      boardTitle: "Board",
      overtimeLabel: "Overtime",
      hoursLabel: "Hours",
      titlePlayerLabel: "Your Name",
      titlePlayerPlaceholder: "Field name",
      titleCompanyLabel: "Company Name",
      titleCompanyPlaceholder: "Field Co.",
      titleNameHint: "Both player and company names are required to start.",
      quickBuyDescription: "Use spare hours to quick buy missing tools before committing to the job.",
      quickBuyButtonLabel: "Quick Buy Tools",
      defaultPlayerName: "You",
      defaultCompanyName: "Field Ops",
      companyDistrictButton: "District Access",
      companyCrewButton: "Crew Status",
      companyNewsButton: "Competitor News"
    }
  };
}

export function makeScenarioState(seed = 91): GameState {
  const state = createInitialGameState(makeScenarioBundle(), seed);
  state.player.skills = createInitialSkills();
  return state;
}

export function eventById(bundle: ContentBundle, eventId: string): EventDef {
  return bundle.events.find((event) => event.id === eventId)!;
}

function supply(id: string, name: string, price: number, tags: string[]) {
  return {
    id,
    name,
    prices: {
      low: Math.max(1, Math.floor(price * 0.75)),
      medium: price,
      high: Math.max(price + 1, Math.ceil(price * 1.35))
    },
    tags,
    flavor: {
      description: `${name} keeps the paperwork honest.`,
      quip_buy: `Purchased ${name.toLowerCase()}.`
    }
  };
}

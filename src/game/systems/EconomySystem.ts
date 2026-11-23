import {CHARACTER_PRESETS} from '@/src/config/constants';
import {getShopItemById} from '@/src/game/data/catalog';
import {
  getUpgradeCost,
  getVehicleModelSpec,
  UpgradeStatKey,
} from '@/src/game/data/cityLifeData';
import {getCollectibleById, getSecretLocationById} from '@/src/game/data/explorationData';
import {getPropertyById} from '@/src/game/data/propertyData';
import {
  captureStoryMissionBaseline,
  EXPANDED_ACHIEVEMENTS,
  FULL_MISSIONS,
  getActiveStoryCampaignMission,
  getDailyResetKey,
  getLevelForXp,
  getStoryMissionProgressSnapshot,
  getWeeklyResetKey,
  LEVEL_MILESTONES,
  STORY_ALLIANCE_CHOICES,
  STORY_CAMPAIGN_MISSIONS,
  STORY_CHAPTERS,
  TIMED_ROTATING_CHALLENGES,
} from '@/src/game/data/progressionData';
import {saveSystem} from '@/src/game/systems/SaveSystem';
import {
  AnimationState,
  CharacterIdentitySnapshot,
  ClothingSlot,
  EquippedClothing,
  HairOverride,
  HairStyleId,
  InventoryEntry,
  OutfitPreset,
  OwnedVehicleRecord,
  ProgressionState,
  SaveDataV1,
  TransactionRecord,
  VehicleCustomization,
  VehicleModelId,
} from '@/src/game/types/gameTypes';
import {clamp} from '@/src/game/utils/helpers';

export interface PurchaseResult {
  ok: boolean;
  reason?: string;
  balance: number;
  itemId: string;
}

export interface ConsumeResult {
  ok: boolean;
  reason?: string;
  energyRestored: number;
  speedBoostSec: number;
  newEnergy: number;
}

export interface IEconomyService {
  getCoins(): number;
  getEnergy(): number;
  getInventory(): InventoryEntry[];
  getEquippedClothing(): EquippedClothing;
  getHairOverride(): HairOverride;
  ownsItem(itemId: string): boolean;
  getItemQuantity(itemId: string): number;
  purchaseItem(itemId: string): PurchaseResult;
  awardCoins(amount: number, reason: string): number;
  spendCoins(amount: number, reason: string): boolean;
  equipClothing(itemId: string): boolean;
  unequipSlot(slot: ClothingSlot): boolean;
  consumeItem(itemId: string): ConsumeResult;
}

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  goal: number;
}

export const CITY_ACHIEVEMENTS: AchievementDefinition[] = EXPANDED_ACHIEVEMENTS.map((a) => ({
  id: a.id,
  title: a.title,
  description: a.description,
  goal: a.goal,
}));

export interface ProgressionAwardSummary {
  coinsAwarded: number;
  xpAwarded: number;
  leveledUpTo: number | null;
  unlockedItems: string[];
  unlockedTitles: string[];
  unlockedVehicles: string[];
}

type EconomyListener = (state: SaveDataV1) => void;

class EconomySystem implements IEconomyService {
  private listeners = new Set<EconomyListener>();
  private purchaseLock = false;
  private activeSpeedBoostUntilMs = 0;

  public subscribe(listener: EconomyListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const state = saveSystem.getState();
    for (const fn of this.listeners) {
      fn(state);
    }
  }

  public getCoins(): number {
    return saveSystem.getState().coins;
  }

  public getEnergy(): number {
    return saveSystem.getState().energy;
  }

  public getSpeedBoostRemainingSec(): number {
    const diff = this.activeSpeedBoostUntilMs - Date.now();
    return diff > 0 ? Math.ceil(diff / 1000) : 0;
  }

  public getSpeedMultiplier(): number {
    return this.activeSpeedBoostUntilMs > Date.now() ? 1.24 : 1.0;
  }

  public getInventory(): InventoryEntry[] {
    return saveSystem.getState().inventory;
  }

  public getEquippedClothing(): EquippedClothing {
    return saveSystem.getState().equippedClothing;
  }

  public getHairOverride(): HairOverride {
    return saveSystem.getState().hairOverride;
  }

  public getOutfitPresets(): OutfitPreset[] {
    return saveSystem.getState().outfitPresets;
  }

  public getSelectedOutfitPresetId(): string | null {
    return saveSystem.getState().selectedOutfitPresetId;
  }

  public getTransactions(): TransactionRecord[] {
    return saveSystem.getState().transactions;
  }

  public hasClaimedReward(rewardKey: string): boolean {
    return saveSystem.getState().claimedRewards.includes(rewardKey);
  }

  public isCinemaUnlocked(): boolean {
    const st = saveSystem.getState();
    return st.cinemaTicketActive || this.ownsItem('cin_ticket');
  }

  public getHighScore(gameId: string): number {
    return saveSystem.getState().arcadeHighScores[gameId] ?? 0;
  }

  private ensureRollover(prog: ProgressionState): ProgressionState {
    const today = getDailyResetKey();
    const week = getWeeklyResetKey();
    if (prog.dailyResetKey === today && prog.weeklyResetKey === week) {
      return prog;
    }
    return {
      ...prog,
      dailyResetKey: today,
      weeklyResetKey: week,
      dailyCounts: prog.dailyResetKey === today ? prog.dailyCounts : {},
      weeklyCounts: prog.weeklyResetKey === week ? prog.weeklyCounts : {},
    };
  }

  private bumpTimedCounters(prog: ProgressionState, keys: string[]): ProgressionState {
    const rolled = this.ensureRollover(prog);
    const nextDaily = {...rolled.dailyCounts};
    const nextWeekly = {...rolled.weeklyCounts};
    for (const k of keys) {
      nextDaily[k] = (nextDaily[k] ?? 0) + 1;
      nextWeekly[k] = (nextWeekly[k] ?? 0) + 1;
    }
    return {
      ...rolled,
      dailyCounts: nextDaily,
      weeklyCounts: nextWeekly,
    };
  }

  private grantInternalRewards(
    st: SaveDataV1,
    opts: {
      coins?: number;
      xp?: number;
      label: string;
      unlockItemId?: string;
      unlockTitle?: string;
      unlockBadge?: string;
      unlockVehicleModelId?: VehicleModelId;
      rewardKey?: string;
    },
  ): {nextState: SaveDataV1; summary: ProgressionAwardSummary} {
    let nextCoins = st.coins;
    let nextTransactions = [...st.transactions];
    let nextInventory = st.inventory.map((e) => ({...e}));
    let nextVehicles = [...st.vehicles];
    let nextActiveVehicleId = st.activeVehicleId;
    let nextClaimed = [...st.claimedRewards];
    const rolled = this.ensureRollover(st.progression);
    let nextXp = rolled.xp;
    const nextTitles = new Set(rolled.unlockedTitles);
    const nextBadges = new Set(rolled.unlockedBadges);

    const unlockedItems: string[] = [];
    const unlockedTitles: string[] = [];
    const unlockedVehicles: string[] = [];

    if (opts.rewardKey && !nextClaimed.includes(opts.rewardKey)) {
      nextClaimed = [...nextClaimed, opts.rewardKey].slice(0, 200);
    }

    const addCoins = Math.max(0, Math.floor(opts.coins ?? 0));
    if (addCoins > 0) {
      nextCoins += addCoins;
      nextTransactions = [
        {
          id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          label: opts.label,
          amount: addCoins,
          balanceAfter: nextCoins,
          timestamp: Date.now(),
        },
        ...nextTransactions,
      ].slice(0, 40);
    }

    const addItem = (itemId: string) => {
      const item = getShopItemById(itemId);
      if (!item) return;
      const existing = nextInventory.find((e) => e.itemId === itemId);
      if (!existing) {
        nextInventory.push({itemId, quantity: 1, acquiredAt: Date.now()});
        unlockedItems.push(item.name);
      } else if (item.stackable) {
        existing.quantity = Math.min(999, existing.quantity + 1);
        unlockedItems.push(item.name);
      }
    };

    const addVehicle = (modelId: VehicleModelId) => {
      if (nextVehicles.length >= 16) return;
      if (nextVehicles.some((v) => v.modelId === modelId)) return;
      const spec = getVehicleModelSpec(modelId);
      const newVeh: OwnedVehicleRecord = {
        id: `veh_${spec.modelId}_${Date.now().toString(36)}`,
        modelId: spec.modelId,
        name: spec.name,
        purchasedAt: Date.now(),
        condition: 100,
        customization: {...spec.defaultCustomization},
        upgrades: {...spec.defaultUpgrades},
      };
      nextVehicles = [...nextVehicles, newVeh];
      nextActiveVehicleId = newVeh.id;
      unlockedVehicles.push(spec.name);
    };

    if (opts.unlockItemId) addItem(opts.unlockItemId);
    if (opts.unlockVehicleModelId) addVehicle(opts.unlockVehicleModelId);
    if (opts.unlockTitle && !nextTitles.has(opts.unlockTitle)) {
      nextTitles.add(opts.unlockTitle);
      unlockedTitles.push(opts.unlockTitle);
    }
    if (opts.unlockBadge) nextBadges.add(opts.unlockBadge);

    const addXp = Math.max(0, Math.floor(opts.xp ?? 0));
    const prevLevel = getLevelForXp(nextXp);
    nextXp = Math.min(100_000, nextXp + addXp);
    const newLevel = getLevelForXp(nextXp);
    let leveledUpTo: number | null = null;
    let extraMilestoneCoins = 0;

    if (newLevel > prevLevel) {
      leveledUpTo = newLevel;
      for (const milestone of LEVEL_MILESTONES) {
        if (milestone.level <= newLevel) {
          const mKey = `level_milestone_${milestone.level}`;
          if (!nextClaimed.includes(mKey)) {
            nextClaimed = [...nextClaimed, mKey].slice(0, 200);
            if (milestone.rewardCoins > 0) {
              nextCoins += milestone.rewardCoins;
              extraMilestoneCoins += milestone.rewardCoins;
              nextTransactions = [
                {
                  id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                  label: `Level ${milestone.level} Milestone Bonus`,
                  amount: milestone.rewardCoins,
                  balanceAfter: nextCoins,
                  timestamp: Date.now(),
                },
                ...nextTransactions,
              ].slice(0, 40);
            }
            if (milestone.unlockItemId) addItem(milestone.unlockItemId);
            if (milestone.unlockVehicleModelId) addVehicle(milestone.unlockVehicleModelId);
            if (milestone.unlockTitle && !nextTitles.has(milestone.unlockTitle)) {
              nextTitles.add(milestone.unlockTitle);
              unlockedTitles.push(milestone.unlockTitle);
            }
            if (milestone.unlockBadge) nextBadges.add(milestone.unlockBadge);
          }
        }
      }
    }

    const nextState: SaveDataV1 = {
      ...st,
      coins: nextCoins,
      claimedRewards: nextClaimed,
      transactions: nextTransactions,
      inventory: nextInventory,
      vehicles: nextVehicles,
      activeVehicleId: nextActiveVehicleId,
      progression: {
        ...rolled,
        xp: nextXp,
        level: newLevel,
        unlockedTitles: Array.from(nextTitles).slice(0, 20),
        unlockedBadges: Array.from(nextBadges).slice(0, 24),
      },
    };
    nextState.achievements = this.evaluateAchievementUnlocks(nextState);

    return {
      nextState,
      summary: {
        coinsAwarded: addCoins + extraMilestoneCoins,
        xpAwarded: addXp,
        leveledUpTo,
        unlockedItems,
        unlockedTitles,
        unlockedVehicles,
      },
    };
  }

  public recordHighScore(gameId: string, score: number): boolean {
    const cleanScore = Math.max(0, Math.floor(score));
    const st = saveSystem.getState();
    const prev = st.arcadeHighScores[gameId] ?? 0;
    const nextActivities = st.missions.activitiesCompleted + 1;
    const nextProg = this.bumpTimedCounters(st.progression, ['activities']);
    const unlockAce = cleanScore >= 120 && !nextProg.unlockedTitles.includes('Arcade Ace');

    const draft: SaveDataV1 = {
      ...st,
      arcadeHighScores: {
        ...st.arcadeHighScores,
        [gameId]: Math.max(prev, cleanScore),
      },
      missions: {
        ...st.missions,
        activitiesCompleted: nextActivities,
      },
      progression: unlockAce
        ? {...nextProg, unlockedTitles: [...nextProg.unlockedTitles, 'Arcade Ace'].slice(0, 20)}
        : nextProg,
    };

    const {nextState} = this.grantInternalRewards(draft, {
      xp: 25,
      label: `${gameId} XP`,
    });
    saveSystem.save(nextState, true);
    this.emit();
    return cleanScore > prev;
  }

  private evaluateAchievementUnlocks(st: SaveDataV1) {
    const unlocked = new Set(st.achievements.unlockedIds);
    const ownedClothingCount = st.inventory.filter((e) => {
      const item = getShopItemById(e.itemId);
      return Boolean(item?.clothing) && e.quantity > 0;
    }).length;

    const withComputedStats: SaveDataV1 = {
      ...st,
      achievements: {
        ...st.achievements,
        stats: {
          ...st.achievements.stats,
          districtsVisited: st.missions.visitedDistricts.length,
          buildingsVisited: st.missions.visitedBuildings.length,
          itemsPurchased: st.missions.itemsPurchased,
          ownedClothingCount,
          activitiesCompleted: st.missions.activitiesCompleted,
          fountainFlipsWon: st.miniGameRecords.fountainFlipsWon,
          fishCaught: st.miniGameRecords.fishCaught,
          deliveriesCompleted: st.miniGameRecords.deliveriesCompleted,
          racesCompleted: st.miniGameRecords.racesCompleted,
          storyChapters: st.story.completedChapters.length,
          ownedProperties: (st.ownedProperties ?? []).length,
          discoveredSecrets: (st.discoveredSecrets ?? []).length,
          collectibles: (st.collectibles ?? []).length,
          friendCount: st.friendCount ?? 0,
        },
      },
    };

    for (const def of EXPANDED_ACHIEVEMENTS) {
      if (def.getProgress(withComputedStats) >= def.goal) {
        unlocked.add(def.id);
      }
    }

    return {
      unlockedIds: Array.from(unlocked).slice(0, 50),
      stats: withComputedStats.achievements.stats,
    };
  }

  public recordDistrictVisit(districtId: string): void {
    const st = saveSystem.getState();
    if (st.missions.visitedDistricts.includes(districtId)) return;
    const nextVisited = [...st.missions.visitedDistricts, districtId].slice(0, 16);
    const draft: SaveDataV1 = {
      ...st,
      missions: {
        ...st.missions,
        visitedDistricts: nextVisited,
        completedIds:
          nextVisited.length >= 5 && !st.missions.completedIds.includes('mission_all_districts')
            ? [...st.missions.completedIds, 'mission_all_districts']
            : st.missions.completedIds,
      },
    };
    const {nextState} = this.grantInternalRewards(draft, {
      xp: 20,
      unlockTitle: nextVisited.length >= 5 ? 'City Explorer' : undefined,
      label: 'District Discovered',
    });
    saveSystem.save(nextState, true);
    this.emit();
  }

  public recordBuildingVisit(buildingId: string): void {
    const st = saveSystem.getState();
    if (st.missions.visitedBuildings.includes(buildingId)) return;
    const nextBuildings = [...st.missions.visitedBuildings, buildingId].slice(0, 80);
    const draft: SaveDataV1 = {
      ...st,
      missions: {
        ...st.missions,
        visitedBuildings: nextBuildings,
        completedIds:
          nextBuildings.length >= 5 && !st.missions.completedIds.includes('mission_5_buildings')
            ? [...st.missions.completedIds, 'mission_5_buildings']
            : st.missions.completedIds,
      },
    };
    const {nextState} = this.grantInternalRewards(draft, {
      xp: 12,
      label: 'Building Explored',
    });
    saveSystem.save(nextState, true);
    this.emit();
  }

  public recordActivityCompletion(missionId?: string): void {
    const st = saveSystem.getState();
    const nextCompleted =
      missionId && !st.missions.completedIds.includes(missionId)
        ? [...st.missions.completedIds, missionId].slice(0, 50)
        : st.missions.completedIds;
    const draft: SaveDataV1 = {
      ...st,
      missions: {
        ...st.missions,
        activitiesCompleted: st.missions.activitiesCompleted + 1,
        completedIds: nextCompleted,
      },
      progression: this.bumpTimedCounters(st.progression, ['activities']),
    };
    const {nextState} = this.grantInternalRewards(draft, {
      xp: 25,
      label: 'City Activity',
    });
    saveSystem.save(nextState, true);
    this.emit();
  }

  public ownsItem(itemId: string): boolean {
    return saveSystem.getState().inventory.some((e) => e.itemId === itemId && e.quantity > 0);
  }

  public getItemQuantity(itemId: string): number {
    return saveSystem.getState().inventory.find((e) => e.itemId === itemId)?.quantity ?? 0;
  }

  public purchaseItem(itemId: string): PurchaseResult {
    if (this.purchaseLock) {
      return {
        ok: false,
        reason: 'Purchase is already processing.',
        balance: this.getCoins(),
        itemId,
      };
    }

    this.purchaseLock = true;
    try {
      const item = getShopItemById(itemId);
      if (!item) {
        return {
          ok: false,
          reason: 'Item does not exist in store catalog.',
          balance: this.getCoins(),
          itemId,
        };
      }

      if (item.unlockOnly) {
        return {
          ok: false,
          reason: `${item.name} is unlocked through Level Milestones, Missions, or Story Quests.`,
          balance: this.getCoins(),
          itemId,
        };
      }

      if (!Number.isFinite(item.price) || item.price < 0) {
        return {
          ok: false,
          reason: 'Invalid item price.',
          balance: this.getCoins(),
          itemId,
        };
      }

      const st = saveSystem.getState();
      if (!item.stackable && this.ownsItem(item.id)) {
        return {
          ok: false,
          reason: `You already own ${item.name}.`,
          balance: st.coins,
          itemId,
        };
      }

      if (st.coins < item.price) {
        const needed = item.price - st.coins;
        return {
          ok: false,
          reason: `Not enough coins. You need ${needed} more coins.`,
          balance: st.coins,
          itemId,
        };
      }

      const nextCoins = st.coins - item.price;
      const nextInventory = st.inventory.map((e) => ({...e}));
      const existing = nextInventory.find((e) => e.itemId === item.id);
      if (existing) {
        existing.quantity = Math.min(existing.quantity + 1, 999);
      } else {
        nextInventory.push({
          itemId: item.id,
          quantity: 1,
          acquiredAt: Date.now(),
        });
      }

      const record: TransactionRecord = {
        id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        label: `Bought ${item.name}`,
        amount: -item.price,
        balanceAfter: nextCoins,
        timestamp: Date.now(),
      };

      const nextPurchasedCount = st.missions.itemsPurchased + 1;
      const nextCompleted =
        nextPurchasedCount >= 1 && !st.missions.completedIds.includes('mission_first_buy')
          ? [...st.missions.completedIds, 'mission_first_buy'].slice(0, 50)
          : st.missions.completedIds;

      const nextState: SaveDataV1 = {
        ...st,
        coins: nextCoins,
        inventory: nextInventory,
        cinemaTicketActive: st.cinemaTicketActive || item.id === 'cin_ticket',
        transactions: [record, ...st.transactions].slice(0, 40),
        missions: {
          ...st.missions,
          itemsPurchased: nextPurchasedCount,
          completedIds: nextCompleted,
        },
      };
      nextState.achievements = this.evaluateAchievementUnlocks(nextState);

      saveSystem.save(nextState, true);
      this.emit();
      return {ok: true, balance: nextCoins, itemId: item.id};
    } finally {
      this.purchaseLock = false;
    }
  }

  public spendCoins(amount: number, reason: string): boolean {
    const clean = Math.floor(amount);
    if (!Number.isFinite(clean) || clean < 0) return false;
    const st = saveSystem.getState();
    if (st.coins < clean) return false;
    if (clean === 0) return true;

    const nextCoins = st.coins - clean;
    const record: TransactionRecord = {
      id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: reason,
      amount: -clean,
      balanceAfter: nextCoins,
      timestamp: Date.now(),
    };
    saveSystem.save({
      ...st,
      coins: nextCoins,
      transactions: [record, ...st.transactions].slice(0, 40),
    });
    this.emit();
    return true;
  }

  public awardCoins(amount: number, reason: string, rewardKey?: string): number {
    const clean = Math.floor(amount);
    if (!Number.isFinite(clean) || clean <= 0) return this.getCoins();
    const st = saveSystem.getState();
    if (rewardKey && st.claimedRewards.includes(rewardKey)) {
      return st.coins;
    }

    const nextCoins = st.coins + clean;
    const record: TransactionRecord = {
      id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: reason,
      amount: clean,
      balanceAfter: nextCoins,
      timestamp: Date.now(),
    };

    saveSystem.save({
      ...st,
      coins: nextCoins,
      claimedRewards: rewardKey ? [...st.claimedRewards, rewardKey] : st.claimedRewards,
      transactions: [record, ...st.transactions].slice(0, 40),
    });
    this.emit();
    return nextCoins;
  }

  public restoreFullEnergy(): number {
    const st = saveSystem.getState();
    saveSystem.save({...st, energy: 100});
    this.emit();
    return 100;
  }

  public restoreEnergy(amount: number): number {
    const add = Math.max(0, Math.floor(amount));
    const st = saveSystem.getState();
    const next = clamp(st.energy + add, 0, 100);
    saveSystem.save({...st, energy: next});
    this.emit();
    return next;
  }

  public equipClothing(itemId: string): boolean {
    if (!this.ownsItem(itemId)) return false;
    const item = getShopItemById(itemId);
    if (!item?.clothing) return false;
    const st = saveSystem.getState();
    saveSystem.save({
      ...st,
      equippedClothing: {
        ...st.equippedClothing,
        [item.clothing.slot]: item.id,
      },
      selectedOutfitPresetId: null,
    });
    this.emit();
    return true;
  }

  public unequipSlot(slot: ClothingSlot): boolean {
    const st = saveSystem.getState();
    if (!st.equippedClothing[slot]) return false;
    saveSystem.save({
      ...st,
      equippedClothing: {
        ...st.equippedClothing,
        [slot]: null,
      },
      selectedOutfitPresetId: null,
    });
    this.emit();
    return true;
  }

  public isItemEquipped(itemId: string): boolean {
    const eq = saveSystem.getState().equippedClothing;
    return Object.values(eq).includes(itemId);
  }

  // =========================================================================
  // OUTFIT PRESETS (strictly validates ownership on every slot)
  // =========================================================================

  public filterOwnedOutfit(raw: EquippedClothing): EquippedClothing {
    const clean: EquippedClothing = {
      shirt: null,
      jacket: null,
      trousers: null,
      shoes: null,
      hat: null,
      glasses: null,
      accessory: null,
    };
    const slots: ClothingSlot[] = [
      'shirt',
      'jacket',
      'trousers',
      'shoes',
      'hat',
      'glasses',
      'accessory',
    ];
    for (const slot of slots) {
      const id = raw[slot];
      if (!id || !this.ownsItem(id)) continue;
      const item = getShopItemById(id);
      if (item?.clothing && item.clothing.slot === slot) {
        clean[slot] = id;
      }
    }
    return clean;
  }

  public createOutfitPreset(
    name: string,
    equipped?: EquippedClothing,
  ): {ok: boolean; preset?: OutfitPreset; reason?: string} {
    const cleanName = name.trim().slice(0, 24);
    if (!cleanName) {
      return {ok: false, reason: 'Enter a name for your outfit preset.'};
    }
    const st = saveSystem.getState();
    if (st.outfitPresets.length >= 12) {
      return {ok: false, reason: 'Maximum of 12 outfit presets reached.'};
    }
    const newPreset: OutfitPreset = {
      id: `preset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      name: cleanName,
      equipped: this.filterOwnedOutfit(equipped ?? st.equippedClothing),
      builtIn: false,
    };
    const nextList = [...st.outfitPresets, newPreset];
    saveSystem.saveOutfitPresets(nextList, newPreset.id);
    this.emit();
    return {ok: true, preset: newPreset};
  }

  public overwriteOutfitPreset(
    presetId: string,
    equipped?: EquippedClothing,
  ): {ok: boolean; reason?: string} {
    const st = saveSystem.getState();
    const target = st.outfitPresets.find((p) => p.id === presetId);
    if (!target) {
      return {ok: false, reason: 'Outfit preset not found.'};
    }
    const cleanEquipped = this.filterOwnedOutfit(equipped ?? st.equippedClothing);
    const nextList = st.outfitPresets.map((p) =>
      p.id === presetId ? {...p, equipped: cleanEquipped} : p,
    );
    saveSystem.saveOutfitPresets(nextList, presetId);
    this.emit();
    return {ok: true};
  }

  public renameOutfitPreset(presetId: string, newName: string): {ok: boolean; reason?: string} {
    const cleanName = newName.trim().slice(0, 24);
    if (!cleanName) {
      return {ok: false, reason: 'Preset name cannot be empty.'};
    }
    const st = saveSystem.getState();
    const exists = st.outfitPresets.some((p) => p.id === presetId);
    if (!exists) return {ok: false, reason: 'Preset not found.'};

    const nextList = st.outfitPresets.map((p) =>
      p.id === presetId ? {...p, name: cleanName} : p,
    );
    saveSystem.saveOutfitPresets(nextList, st.selectedOutfitPresetId);
    this.emit();
    return {ok: true};
  }

  public deleteOutfitPreset(presetId: string): {ok: boolean; reason?: string} {
    const st = saveSystem.getState();
    if (st.outfitPresets.length <= 1) {
      return {ok: false, reason: 'Keep at least one outfit preset saved.'};
    }
    const nextList = st.outfitPresets.filter((p) => p.id !== presetId);
    const nextSel =
      st.selectedOutfitPresetId === presetId ? nextList[0]?.id ?? null : st.selectedOutfitPresetId;
    saveSystem.saveOutfitPresets(nextList, nextSel);
    this.emit();
    return {ok: true};
  }

  public applyOutfitPreset(presetId: string): {ok: boolean; reason?: string} {
    const st = saveSystem.getState();
    const preset = st.outfitPresets.find((p) => p.id === presetId);
    if (!preset) {
      return {ok: false, reason: 'Outfit preset not found.'};
    }
    const cleanEquipped = this.filterOwnedOutfit(preset.equipped);
    saveSystem.save({
      ...st,
      equippedClothing: cleanEquipped,
      selectedOutfitPresetId: preset.id,
    });
    this.emit();
    return {ok: true};
  }

  public applyHairStyle(
    hairStyle: HairStyleId | null,
    hairColor: string | null,
    costCoins: number,
  ): {ok: boolean; reason?: string} {
    if (costCoins > 0 && !this.spendCoins(costCoins, 'Glow & Snip Salon Styling')) {
      return {
        ok: false,
        reason: `Not enough coins. Need ${costCoins} coins for this look.`,
      };
    }
    const st = saveSystem.getState();
    const basePreset =
      CHARACTER_PRESETS.find((p) => p.id === st.appearanceId) ?? CHARACTER_PRESETS[0];
    saveSystem.save({
      ...st,
      appearanceConfig: {
        ...st.appearanceConfig,
        hairStyle: hairStyle ?? basePreset.hairStyle,
        hairColor: hairColor ?? basePreset.hairColor,
      },
      hairOverride: {
        hairStyle,
        hairColor,
      },
    });
    this.emit();
    return {ok: true};
  }

  public getIdentitySnapshot(currentAnimationState: AnimationState = 'idle'): CharacterIdentitySnapshot {
    const st = saveSystem.getState();
    const ownedCosmetics = st.inventory
      .filter((entry) => entry.quantity > 0 && Boolean(getShopItemById(entry.itemId)?.clothing))
      .map((entry) => entry.itemId);
    return {
      playerId: st.playerId,
      displayName: st.playerName,
      characterType: st.appearanceConfig.gender,
      appearanceId: st.appearanceId,
      appearance: {...st.appearanceConfig},
      equippedOutfit: {...st.equippedClothing},
      ownedCosmetics,
      currentAnimationState,
    };
  }

  public consumeItem(itemId: string): ConsumeResult {
    const item = getShopItemById(itemId);
    if (!item || item.kind !== 'consumable') {
      return {
        ok: false,
        reason: 'This item cannot be consumed.',
        energyRestored: 0,
        speedBoostSec: 0,
        newEnergy: this.getEnergy(),
      };
    }

    const st = saveSystem.getState();
    const entry = st.inventory.find((e) => e.itemId === itemId);
    if (!entry || entry.quantity <= 0) {
      return {
        ok: false,
        reason: 'Item not in inventory.',
        energyRestored: 0,
        speedBoostSec: 0,
        newEnergy: st.energy,
      };
    }

    const nextInventory = st.inventory
      .map((e) => (e.itemId === itemId ? {...e, quantity: e.quantity - 1} : e))
      .filter((e) => e.quantity > 0);

    const energyAdd = item.energyRestore ?? 0;
    const nextEnergy = clamp(st.energy + energyAdd, 0, 100);
    const boostSec = item.speedBoostSec ?? 0;
    if (boostSec > 0) {
      const now = Date.now();
      const currentRem = Math.max(0, this.activeSpeedBoostUntilMs - now);
      this.activeSpeedBoostUntilMs = now + Math.min(90_000, currentRem + boostSec * 1000);
    }

    saveSystem.save({
      ...st,
      energy: nextEnergy,
      inventory: nextInventory,
    });
    this.emit();

    return {
      ok: true,
      energyRestored: energyAdd,
      speedBoostSec: boostSec,
      newEnergy: nextEnergy,
    };
  }

  public getOwnedVehicles(): OwnedVehicleRecord[] {
    return saveSystem.getState().vehicles;
  }

  public getVehicleById(vehicleId: string): OwnedVehicleRecord | null {
    return saveSystem.getState().vehicles.find((v) => v.id === vehicleId) ?? null;
  }

  public getActiveVehicleId(): string | null {
    const st = saveSystem.getState();
    if (st.activeVehicleId && st.vehicles.some((v) => v.id === st.activeVehicleId)) {
      return st.activeVehicleId;
    }
    return st.vehicles[0]?.id ?? null;
  }

  public setActiveVehicleId(vehicleId: string | null): void {
    const st = saveSystem.getState();
    if (vehicleId && !st.vehicles.some((v) => v.id === vehicleId)) return;
    if (st.activeVehicleId === vehicleId) return;
    saveSystem.save({...st, activeVehicleId: vehicleId});
    this.emit();
  }

  public purchaseVehicleModel(
    modelId: VehicleModelId,
  ): {ok: boolean; vehicle?: OwnedVehicleRecord; reason?: string} {
    if (this.purchaseLock) {
      return {ok: false, reason: 'Transaction in progress. Please wait.'};
    }
    this.purchaseLock = true;
    try {
      const spec = getVehicleModelSpec(modelId);
      if (spec.unlockOnly) {
        return {ok: false, reason: `${spec.name} is unlocked through Story Quests or Level 6.`};
      }
      const st = saveSystem.getState();
      if (st.vehicles.length >= 16) {
        return {ok: false, reason: 'Garage capacity reached (16 vehicles max).'};
      }
      if (st.vehicles.some((v) => v.modelId === spec.modelId)) {
        return {ok: false, reason: `You already own a ${spec.name} in your garage.`};
      }
      if (st.coins < spec.price) {
        return {
          ok: false,
          reason: `Need ${spec.price - st.coins} more coins to buy ${spec.name}.`,
        };
      }

      const nextCoins = st.coins - spec.price;
      const newVehicle: OwnedVehicleRecord = {
        id: `veh_${spec.modelId}_${Date.now().toString(36)}`,
        modelId: spec.modelId,
        name: spec.name,
        purchasedAt: Date.now(),
        condition: 100,
        customization: {...spec.defaultCustomization},
        upgrades: {...spec.defaultUpgrades},
      };

      const record: TransactionRecord = {
        id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        label: `Bought ${spec.name}`,
        amount: -spec.price,
        balanceAfter: nextCoins,
        timestamp: Date.now(),
      };

      saveSystem.save(
        {
          ...st,
          coins: nextCoins,
          vehicles: [...st.vehicles, newVehicle],
          activeVehicleId: newVehicle.id,
          transactions: spec.price > 0 ? [record, ...st.transactions].slice(0, 40) : st.transactions,
        },
        true,
      );
      this.emit();
      return {ok: true, vehicle: newVehicle};
    } finally {
      this.purchaseLock = false;
    }
  }

  public customizeVehicle(
    vehicleId: string,
    patch: Partial<VehicleCustomization>,
    totalCost: number,
    label: string,
  ): {ok: boolean; vehicle?: OwnedVehicleRecord; reason?: string} {
    const cleanCost = Math.max(0, Math.floor(totalCost));
    const st = saveSystem.getState();
    const target = st.vehicles.find((v) => v.id === vehicleId);
    if (!target) {
      return {ok: false, reason: 'Vehicle not found in your garage.'};
    }
    if (st.coins < cleanCost) {
      return {ok: false, reason: `Need ${cleanCost - st.coins} more coins for this customization.`};
    }

    const updatedVehicle: OwnedVehicleRecord = {
      ...target,
      customization: {
        ...target.customization,
        ...patch,
      },
    };
    const nextCoins = st.coins - cleanCost;
    const txList =
      cleanCost > 0
        ? [
            {
              id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              label,
              amount: -cleanCost,
              balanceAfter: nextCoins,
              timestamp: Date.now(),
            },
            ...st.transactions,
          ].slice(0, 40)
        : st.transactions;

    saveSystem.save(
      {
        ...st,
        coins: nextCoins,
        vehicles: st.vehicles.map((v) => (v.id === vehicleId ? updatedVehicle : v)),
        transactions: txList,
        missions: {
          ...st.missions,
          garageCustomized: true,
        },
      },
      true,
    );
    this.emit();
    return {ok: true, vehicle: updatedVehicle};
  }

  public upgradeVehicle(
    vehicleId: string,
    stat: UpgradeStatKey,
  ): {ok: boolean; vehicle?: OwnedVehicleRecord; newLevel?: number; reason?: string} {
    const st = saveSystem.getState();
    const target = st.vehicles.find((v) => v.id === vehicleId);
    if (!target) {
      return {ok: false, reason: 'Vehicle not found in your garage.'};
    }
    const currentLevel = target.upgrades[stat] ?? 1;
    if (currentLevel >= 5) {
      return {ok: false, reason: 'This component is already at max Tier 5!'};
    }
    const cost = getUpgradeCost(stat, currentLevel);
    if (st.coins < cost) {
      return {ok: false, reason: `Need ${cost - st.coins} more coins to upgrade.`};
    }

    const nextLevel = currentLevel + 1;
    const updatedVehicle: OwnedVehicleRecord = {
      ...target,
      upgrades: {
        ...target.upgrades,
        [stat]: nextLevel,
      },
    };
    const nextCoins = st.coins - cost;
    const record: TransactionRecord = {
      id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: `Garage ${stat} Tier ${nextLevel} (${target.name})`,
      amount: -cost,
      balanceAfter: nextCoins,
      timestamp: Date.now(),
    };

    saveSystem.save(
      {
        ...st,
        coins: nextCoins,
        vehicles: st.vehicles.map((v) => (v.id === vehicleId ? updatedVehicle : v)),
        transactions: [record, ...st.transactions].slice(0, 40),
        missions: {
          ...st.missions,
          garageCustomized: true,
        },
      },
      true,
    );
    this.emit();
    return {ok: true, vehicle: updatedVehicle, newLevel: nextLevel};
  }

  public recordNpcMet(npcId: string): boolean {
    const st = saveSystem.getState();
    const metList = st.missions.metNpcs ?? [];
    if (metList.includes(npcId)) return false;
    const nextMet = [...metList, npcId].slice(0, 30);
    saveSystem.save({
      ...st,
      missions: {
        ...st.missions,
        metNpcs: nextMet,
      },
    });
    this.emit();
    return true;
  }

  public markVehicleSpawned(): void {
    const st = saveSystem.getState();
    if (st.missions.vehicleSpawned) return;
    saveSystem.save({
      ...st,
      missions: {
        ...st.missions,
        vehicleSpawned: true,
      },
    });
    this.emit();
  }

  public getActiveMissionId(): string | null {
    const id = saveSystem.getState().missions.activeMissionId;
    return id === undefined ? 'm_districts_5' : id;
  }

  public getAcceptedMissionIds(): string[] {
    const m = saveSystem.getState().missions;
    if (Array.isArray(m.acceptedIds)) return m.acceptedIds;
    return m.activeMissionId ? [m.activeMissionId] : [];
  }

  public setActiveMissionId(missionId: string | null): void {
    const st = saveSystem.getState();
    const curAccepted = Array.isArray(st.missions.acceptedIds) ? st.missions.acceptedIds : [];
    const nextAccepted =
      missionId && !curAccepted.includes(missionId)
        ? [...curAccepted, missionId].slice(0, 50)
        : curAccepted;
    saveSystem.save({
      ...st,
      missions: {
        ...st.missions,
        activeMissionId: missionId,
        acceptedIds: nextAccepted,
      },
    });
    this.emit();
  }

  public acceptMission(missionId: string): boolean {
    if (!FULL_MISSIONS.some((m) => m.id === missionId)) return false;
    const st = saveSystem.getState();
    if (st.claimedRewards.includes(`mission_reward_${missionId}`)) return false;
    const curAccepted = Array.isArray(st.missions.acceptedIds) ? st.missions.acceptedIds : [];
    const nextAccepted = curAccepted.includes(missionId)
      ? curAccepted
      : [...curAccepted, missionId].slice(0, 50);
    saveSystem.save({
      ...st,
      missions: {
        ...st.missions,
        activeMissionId: missionId,
        acceptedIds: nextAccepted,
      },
    });
    this.emit();
    return true;
  }

  public pauseMission(): void {
    const st = saveSystem.getState();
    if (st.missions.activeMissionId === null) return;
    saveSystem.save({
      ...st,
      missions: {
        ...st.missions,
        activeMissionId: null,
      },
    });
    this.emit();
  }

  public abandonMission(missionId: string): void {
    const st = saveSystem.getState();
    const curAccepted = Array.isArray(st.missions.acceptedIds) ? st.missions.acceptedIds : [];
    const nextAccepted = curAccepted.filter((id) => id !== missionId);
    const nextActive = st.missions.activeMissionId === missionId ? null : st.missions.activeMissionId;
    saveSystem.save({
      ...st,
      missions: {
        ...st.missions,
        activeMissionId: nextActive,
        acceptedIds: nextAccepted,
      },
    });
    this.emit();
  }

  public setSelectedTitle(title: string): boolean {
    const st = saveSystem.getState();
    if (!st.progression.unlockedTitles.includes(title)) return false;
    saveSystem.save({
      ...st,
      progression: {
        ...st.progression,
        selectedTitle: title,
      },
    });
    this.emit();
    return true;
  }

  public awardXp(amount: number, label = 'City XP'): ProgressionAwardSummary {
    const st = saveSystem.getState();
    const {nextState, summary} = this.grantInternalRewards(st, {xp: amount, label});
    saveSystem.save(nextState, true);
    this.emit();
    return summary;
  }

  public recordFountainFlip(won: boolean): ProgressionAwardSummary {
    const st = saveSystem.getState();
    const rewardCoins = won ? 22 : 6;
    const rewardXp = won ? 32 : 16;
    const shouldMintCharm = won && !this.ownsItem('unlock_fountain_charm');

    const draft: SaveDataV1 = {
      ...st,
      energy: clamp(st.energy + 10, 0, 100),
      missions: {
        ...st.missions,
        activitiesCompleted: st.missions.activitiesCompleted + 1,
      },
      progression: this.bumpTimedCounters(st.progression, ['activities', 'coin_flips']),
      miniGameRecords: {
        ...st.miniGameRecords,
        fountainFlipsPlayed: st.miniGameRecords.fountainFlipsPlayed + 1,
        fountainFlipsWon: st.miniGameRecords.fountainFlipsWon + (won ? 1 : 0),
      },
    };
    const {nextState, summary} = this.grantInternalRewards(draft, {
      coins: rewardCoins,
      xp: rewardXp,
      label: won ? 'Fountain Coin Flip Win' : 'Fountain Wish',
      unlockItemId: shouldMintCharm ? 'unlock_fountain_charm' : undefined,
      unlockTitle: won ? 'Fountain Lucky' : undefined,
    });
    saveSystem.save(nextState, true);
    this.emit();
    return summary;
  }

  public recordFishCaught(weightKg: number, speciesCoins: number): ProgressionAwardSummary {
    const st = saveSystem.getState();
    const cleanWeight = Math.max(0.2, Math.round(weightKg * 10) / 10);
    const draft: SaveDataV1 = {
      ...st,
      missions: {
        ...st.missions,
        activitiesCompleted: st.missions.activitiesCompleted + 1,
      },
      progression: this.bumpTimedCounters(st.progression, ['activities', 'fish']),
      miniGameRecords: {
        ...st.miniGameRecords,
        fishCaught: st.miniGameRecords.fishCaught + 1,
        bestFishWeightKg: Math.max(st.miniGameRecords.bestFishWeightKg, cleanWeight),
      },
    };
    const {nextState, summary} = this.grantInternalRewards(draft, {
      coins: speciesCoins,
      xp: 35,
      label: `Lily Pond Catch (${cleanWeight}kg)`,
    });
    saveSystem.save(nextState, true);
    this.emit();
    return summary;
  }

  public recordRaceCompleted(elapsedSec: number): ProgressionAwardSummary {
    const st = saveSystem.getState();
    const cleanSec = Math.max(5, Math.round(elapsedSec * 10) / 10);
    const prevBest = st.miniGameRecords.bestRaceSec;
    const bonusCoins = cleanSec <= 38 ? 65 : 48;
    const draft: SaveDataV1 = {
      ...st,
      missions: {
        ...st.missions,
        activitiesCompleted: st.missions.activitiesCompleted + 1,
      },
      progression: this.bumpTimedCounters(st.progression, ['activities']),
      miniGameRecords: {
        ...st.miniGameRecords,
        racesCompleted: st.miniGameRecords.racesCompleted + 1,
        bestRaceSec: prevBest > 0 ? Math.min(prevBest, cleanSec) : cleanSec,
      },
    };
    const {nextState, summary} = this.grantInternalRewards(draft, {
      coins: bonusCoins,
      xp: 60,
      label: `Boulevard Time Trial (${cleanSec.toFixed(1)}s)`,
      unlockTitle: 'Circuit Driver',
    });
    saveSystem.save(nextState, true);
    this.emit();
    return summary;
  }

  public recordParkSprintCompleted(elapsedSec: number): ProgressionAwardSummary {
    const st = saveSystem.getState();
    const cleanSec = Math.max(5, Math.round(elapsedSec * 10) / 10);
    const prevBest = st.miniGameRecords.bestSprintSec;
    const bonusCoins = cleanSec <= 25 ? 45 : 32;
    const draft: SaveDataV1 = {
      ...st,
      missions: {
        ...st.missions,
        activitiesCompleted: st.missions.activitiesCompleted + 1,
      },
      progression: this.bumpTimedCounters(st.progression, ['activities']),
      miniGameRecords: {
        ...st.miniGameRecords,
        parkSprintsCompleted: st.miniGameRecords.parkSprintsCompleted + 1,
        bestSprintSec: prevBest > 0 ? Math.min(prevBest, cleanSec) : cleanSec,
      },
    };
    const {nextState, summary} = this.grantInternalRewards(draft, {
      coins: bonusCoins,
      xp: 45,
      label: `Park Agility Sprint (${cleanSec.toFixed(1)}s)`,
    });
    saveSystem.save(nextState, true);
    this.emit();
    return summary;
  }

  public recordDeliveryCompleted(timeRemainingSec: number): ProgressionAwardSummary {
    const st = saveSystem.getState();
    const coins = timeRemainingSec >= 18 ? 55 : 40;
    const draft: SaveDataV1 = {
      ...st,
      missions: {
        ...st.missions,
        activitiesCompleted: st.missions.activitiesCompleted + 1,
      },
      progression: this.bumpTimedCounters(st.progression, ['activities', 'deliveries']),
      miniGameRecords: {
        ...st.miniGameRecords,
        deliveriesCompleted: st.miniGameRecords.deliveriesCompleted + 1,
      },
    };
    const {nextState, summary} = this.grantInternalRewards(draft, {
      coins,
      xp: 55,
      label: 'Express Courier Delivery',
    });
    saveSystem.save(nextState, true);
    this.emit();
    return summary;
  }

  public recordMemoryGameResult(roundReached: number, won: boolean): ProgressionAwardSummary {
    const st = saveSystem.getState();
    const coins = won ? 45 : Math.max(8, roundReached * 6);
    const xp = won ? 45 : Math.max(15, roundReached * 8);
    const draft: SaveDataV1 = {
      ...st,
      missions: {
        ...st.missions,
        activitiesCompleted: st.missions.activitiesCompleted + 1,
      },
      progression: this.bumpTimedCounters(st.progression, ['activities']),
      miniGameRecords: {
        ...st.miniGameRecords,
        memoryGamesWon: st.miniGameRecords.memoryGamesWon + (won ? 1 : 0),
        bestMemoryRound: Math.max(st.miniGameRecords.bestMemoryRound, roundReached),
      },
    };
    const {nextState, summary} = this.grantInternalRewards(draft, {
      coins,
      xp,
      label: won ? 'Neon Memory Cleared' : `Neon Memory Round ${roundReached}`,
      unlockTitle: won || roundReached >= 5 ? 'Arcade Ace' : undefined,
    });
    saveSystem.save(nextState, true);
    this.emit();
    return summary;
  }

  public claimTimedChallengeReward(challengeId: string): {
    ok: boolean;
    summary?: ProgressionAwardSummary;
    reason?: string;
  } {
    const def = TIMED_ROTATING_CHALLENGES.find((c) => c.id === challengeId);
    if (!def) return {ok: false, reason: 'Challenge not found.'};

    const st = saveSystem.getState();
    const rolled = this.ensureRollover(st.progression);
    const periodKey = def.period === 'daily' ? rolled.dailyResetKey : rolled.weeklyResetKey;
    const rewardKey = `timed_${def.id}_${periodKey}`;
    if (st.claimedRewards.includes(rewardKey)) {
      return {ok: false, reason: 'Already claimed for this period.'};
    }

    const counts = def.period === 'daily' ? rolled.dailyCounts : rolled.weeklyCounts;
    const cur = counts[def.statKey] ?? 0;
    if (cur < def.goal) {
      return {ok: false, reason: `Progress ${cur}/${def.goal} — complete objective first.`};
    }

    const {nextState, summary} = this.grantInternalRewards(
      {...st, progression: rolled},
      {
        coins: def.rewardCoins,
        xp: def.rewardXp,
        label: `${def.period === 'daily' ? 'Daily' : 'Weekly'}: ${def.title}`,
        rewardKey,
      },
    );
    saveSystem.save(nextState, true);
    this.emit();
    return {ok: true, summary};
  }

  public startStoryMode(): void {
    const st = saveSystem.getState();
    if (st.story.started) return;
    saveSystem.save({
      ...st,
      story: {
        ...st.story,
        started: true,
      },
    });
    this.emit();
  }

  public markStoryCutsceneWatched(cutsceneId: string): void {
    const st = saveSystem.getState();
    if (st.story.watchedCutscenes.includes(cutsceneId)) return;
    saveSystem.save({
      ...st,
      story: {
        ...st.story,
        started: true,
        watchedCutscenes: [...st.story.watchedCutscenes, cutsceneId].slice(0, 30),
      },
    });
    this.emit();
  }

  public completeStoryChapter(chapterNum: number): {
    ok: boolean;
    summary?: ProgressionAwardSummary;
    reason?: string;
  } {
    const def = STORY_CHAPTERS.find((c) => c.chapter === chapterNum);
    if (!def) return {ok: false, reason: 'Story chapter not found.'};

    const st = saveSystem.getState();
    const rewardKey = `story_chapter_${def.chapter}`;
    if (st.claimedRewards.includes(rewardKey) || st.story.completedChapters.includes(def.chapter)) {
      return {ok: false, reason: 'Chapter already completed and rewarded.'};
    }
    if (!def.isObjectiveMet(st)) {
      return {ok: false, reason: `Complete objective first: ${def.objectiveText}`};
    }

    const nextCompleted = Array.from(new Set([...st.story.completedChapters, def.chapter])).sort(
      (a, b) => a - b,
    );
    const nextChapter = Math.min(6, Math.max(st.story.currentChapter, def.chapter + 1));

    const draft: SaveDataV1 = {
      ...st,
      story: {
        ...st.story,
        started: true,
        completedChapters: nextCompleted,
        currentChapter: nextChapter,
      },
    };
    const {nextState, summary} = this.grantInternalRewards(draft, {
      coins: def.rewardCoins,
      xp: def.rewardXp,
      label: def.title,
      unlockItemId: def.unlockItemId,
      unlockVehicleModelId: def.unlockVehicleModelId,
      unlockTitle: def.unlockTitle,
      rewardKey,
    });
    saveSystem.save(nextState, true);
    this.emit();
    return {ok: true, summary};
  }

  public claimMissionReward(
    missionId: string,
  ): {ok: boolean; coinsAwarded: number; summary?: ProgressionAwardSummary; reason?: string} {
    const def = FULL_MISSIONS.find((m) => m.id === missionId);
    if (!def) {
      return {ok: false, coinsAwarded: 0, reason: 'Mission not found.'};
    }
    const rewardKey = `mission_reward_${def.id}`;
    const st = saveSystem.getState();
    if (st.claimedRewards.includes(rewardKey)) {
      return {ok: false, coinsAwarded: 0, reason: 'Mission reward already claimed.'};
    }
    if (def.getProgress(st) < def.goal) {
      return {ok: false, coinsAwarded: 0, reason: 'Complete the mission objective first.'};
    }

    const nextCompleted = st.missions.completedIds.includes(def.id)
      ? st.missions.completedIds
      : [...st.missions.completedIds, def.id].slice(0, 50);

    const draft: SaveDataV1 = {
      ...st,
      missions: {
        ...st.missions,
        completedIds: nextCompleted,
      },
    };
    const {nextState, summary} = this.grantInternalRewards(draft, {
      coins: def.rewardCoins,
      xp: def.rewardXp,
      label: `Mission: ${def.title}`,
      unlockItemId: def.id === 'm_fountain_flip' ? 'unlock_fountain_charm' : undefined,
      unlockTitle:
        def.id === 'm_districts_5'
          ? 'City Explorer'
          : def.id === 'm_boulevard_trial'
            ? 'Circuit Driver'
            : undefined,
      rewardKey,
    });

    saveSystem.save(nextState, true);
    this.emit();
    return {ok: true, coinsAwarded: summary.coinsAwarded, summary};
  }

  public getLoungeTokens(): number {
    return saveSystem.getState().loungeTokens ?? 50;
  }

  public adjustLoungeTokens(delta: number): number {
    const st = saveSystem.getState();
    const cur = st.loungeTokens ?? 50;
    const next = clamp(Math.floor(cur + delta), 0, 100_000);
    saveSystem.save({...st, loungeTokens: next}, true);
    this.emit();
    return next;
  }

  public claimFreeLoungeTokens(): {ok: boolean; added: number; balance: number; reason?: string} {
    const st = saveSystem.getState();
    const cur = st.loungeTokens ?? 0;
    const todayKey = getDailyResetKey();
    const dailyKey = `lounge_free_${todayKey}`;
    const alreadyDaily = st.claimedRewards.includes(dailyKey);
    if (alreadyDaily && cur >= 25) {
      return {
        ok: false,
        added: 0,
        balance: cur,
        reason: 'Free daily bonus already claimed. Low-balance refill unlocks below 25 tokens!',
      };
    }
    const added = alreadyDaily ? 30 : 50;
    const next = clamp(cur + added, 0, 100_000);
    const claimed = alreadyDaily ? st.claimedRewards : [...st.claimedRewards, dailyKey].slice(0, 200);
    saveSystem.save({...st, loungeTokens: next, claimedRewards: claimed}, true);
    this.emit();
    return {ok: true, added, balance: next};
  }

  public redeemLoungePrize(itemId: string): PurchaseResult {
    const item = getShopItemById(itemId);
    if (!item || item.shop !== 'lounge_prizes') {
      return {
        ok: false,
        reason: 'Item is not available at the Lucky Lounge prize counter.',
        balance: this.getLoungeTokens(),
        itemId,
      };
    }
    if (!item.stackable && this.ownsItem(item.id)) {
      return {
        ok: false,
        reason: `You already own ${item.name}.`,
        balance: this.getLoungeTokens(),
        itemId,
      };
    }
    const tokens = this.getLoungeTokens();
    if (tokens < item.price) {
      return {
        ok: false,
        reason: `Need ${item.price - tokens} more Fun Tokens to redeem ${item.name}.`,
        balance: tokens,
        itemId,
      };
    }

    const st = saveSystem.getState();
    const nextTokens = tokens - item.price;
    const nextInventory = st.inventory.map((e) => ({...e}));
    const existing = nextInventory.find((e) => e.itemId === item.id);
    if (existing) {
      existing.quantity = Math.min(existing.quantity + 1, 999);
    } else {
      nextInventory.push({itemId: item.id, quantity: 1, acquiredAt: Date.now()});
    }

    saveSystem.save(
      {
        ...st,
        loungeTokens: nextTokens,
        inventory: nextInventory,
      },
      true,
    );
    this.emit();
    return {ok: true, balance: nextTokens, itemId: item.id};
  }

  public hasCollected(id: string): boolean {
    return (saveSystem.getState().collectedIds ?? []).includes(id);
  }

  public claimCollectible(id: string, coinReward = 25, xpReward = 35): {ok: boolean; total: number} {
    const st = saveSystem.getState();
    const list = st.collectedIds ?? [];
    if (list.includes(id)) return {ok: false, total: list.length};
    const nextList = [...list, id].slice(0, 60);
    const draft: SaveDataV1 = {
      ...st,
      collectedIds: nextList,
    };
    const {nextState} = this.grantInternalRewards(draft, {
      coins: coinReward,
      xp: xpReward,
      label: `Starlight Shard (${nextList.length})`,
    });
    saveSystem.save(nextState, true);
    this.emit();
    return {ok: true, total: nextList.length};
  }

  public damageVehicle(vehicleId: string, delta: number): number {
    const st = saveSystem.getState();
    const target = st.vehicles.find((v) => v.id === vehicleId);
    if (!target) return 100;
    const cur = target.condition ?? 100;
    const nextCond = clamp(Math.round(cur - Math.abs(delta)), 10, 100);
    if (nextCond === cur) return cur;
    saveSystem.save(
      {
        ...st,
        vehicles: st.vehicles.map((v) => (v.id === vehicleId ? {...v, condition: nextCond} : v)),
      },
      false,
    );
    this.emit();
    return nextCond;
  }

  public repairVehicle(vehicleId: string, cost: number): {ok: boolean; reason?: string} {
    const st = saveSystem.getState();
    const target = st.vehicles.find((v) => v.id === vehicleId);
    if (!target) return {ok: false, reason: 'Vehicle not found.'};
    const cur = target.condition ?? 100;
    if (cur >= 100) return {ok: false, reason: `${target.name} is already at 100% condition.`};
    if (cost > 0 && st.coins < cost) {
      return {ok: false, reason: `Need ${cost - st.coins} more coins for full repair.`};
    }
    const nextCoins = st.coins - cost;
    const record: TransactionRecord | null =
      cost > 0
        ? {
            id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            label: `Full Repair (${target.name})`,
            amount: -cost,
            balanceAfter: nextCoins,
            timestamp: Date.now(),
          }
        : null;
    saveSystem.save(
      {
        ...st,
        coins: nextCoins,
        vehicles: st.vehicles.map((v) => (v.id === vehicleId ? {...v, condition: 100} : v)),
        transactions: record ? [record, ...st.transactions].slice(0, 40) : st.transactions,
      },
      true,
    );
    this.emit();
    return {ok: true};
  }

  // =========================================================================
  // PROMPT 11 — PROPERTIES, COLLECTIBLE RELICS, SECRETS & SHARED LOBBIES
  // =========================================================================

  public ownsProperty(propertyId: string): boolean {
    return (saveSystem.getState().ownedProperties ?? []).includes(propertyId);
  }

  public purchaseProperty(
    propertyId: string,
  ): {ok: boolean; reason?: string; balance: number; summary?: ProgressionAwardSummary} {
    if (this.purchaseLock) {
      return {ok: false, reason: 'Transaction in progress.', balance: this.getCoins()};
    }
    this.purchaseLock = true;
    try {
      const def = getPropertyById(propertyId);
      if (!def) {
        return {ok: false, reason: 'Property not found in registry.', balance: this.getCoins()};
      }
      const st = saveSystem.getState();
      const owned = st.ownedProperties ?? [];
      if (owned.includes(def.id)) {
        return {ok: false, reason: `You already own ${def.name}.`, balance: st.coins};
      }
      if (st.coins < def.price) {
        return {
          ok: false,
          reason: `Need ${def.price - st.coins} more coins to buy ${def.name}.`,
          balance: st.coins,
        };
      }

      const nextCoins = st.coins - def.price;
      const record: TransactionRecord = {
        id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        label: `Bought Property: ${def.name}`,
        amount: -def.price,
        balanceAfter: nextCoins,
        timestamp: Date.now(),
      };

      const draft: SaveDataV1 = {
        ...st,
        coins: nextCoins,
        ownedProperties: [...owned, def.id].slice(0, 16),
        transactions: [record, ...st.transactions].slice(0, 40),
      };

      const {nextState, summary} = this.grantInternalRewards(draft, {
        xp: 120,
        unlockTitle: def.tier === 'premium_villa' ? 'Villa Mogul' : 'Property Owner',
        label: `Property Deed: ${def.name}`,
      });
      saveSystem.save(nextState, true);
      this.emit();
      return {ok: true, balance: nextState.coins, summary};
    } finally {
      this.purchaseLock = false;
    }
  }

  public hasCollectibleRelic(relicId: string): boolean {
    return (saveSystem.getState().collectibles ?? []).includes(relicId);
  }

  public claimCollectibleRelic(
    relicId: string,
  ): {ok: boolean; alreadyFound?: boolean; total: number; summary?: ProgressionAwardSummary} {
    const def = getCollectibleById(relicId);
    if (!def) {
      return {ok: false, total: (saveSystem.getState().collectibles ?? []).length};
    }
    const st = saveSystem.getState();
    const list = st.collectibles ?? [];
    if (list.includes(relicId)) {
      return {ok: false, alreadyFound: true, total: list.length};
    }
    const nextList = [...list, relicId].slice(0, 80);
    const draft: SaveDataV1 = {
      ...st,
      collectibles: nextList,
    };
    const {nextState, summary} = this.grantInternalRewards(draft, {
      coins: def.rewardCoins,
      xp: def.rewardXp,
      unlockTitle: nextList.length >= 6 ? 'Relic Collector' : undefined,
      label: `Relic Found: ${def.name}`,
      rewardKey: `relic_${def.id}`,
    });
    saveSystem.save(nextState, true);
    this.emit();
    return {ok: true, total: nextList.length, summary};
  }

  public hasDiscoveredSecret(secretId: string): boolean {
    return (saveSystem.getState().discoveredSecrets ?? []).includes(secretId);
  }

  public claimSecretDiscovery(
    secretId: string,
  ): {ok: boolean; firstDiscovery: boolean; summary?: ProgressionAwardSummary} {
    const def = getSecretLocationById(secretId);
    if (!def) {
      return {ok: false, firstDiscovery: false};
    }
    const st = saveSystem.getState();
    const list = st.discoveredSecrets ?? [];
    if (list.includes(secretId)) {
      return {ok: true, firstDiscovery: false};
    }
    const nextList = [...list, secretId].slice(0, 40);
    const draft: SaveDataV1 = {
      ...st,
      discoveredSecrets: nextList,
    };
    const {nextState, summary} = this.grantInternalRewards(draft, {
      coins: def.rewardCoins,
      xp: def.rewardXp,
      unlockTitle: def.rewardTitle ?? (nextList.length >= 3 ? 'Secret Seeker' : undefined),
      label: `Secret Location: ${def.name}`,
      rewardKey: `secret_${def.id}`,
    });
    saveSystem.save(nextState, true);
    this.emit();
    return {ok: true, firstDiscovery: true, summary};
  }

  public recordSharedActivityBonus(lobbyId: string, coins: number, xp: number): ProgressionAwardSummary | null {
    const key = `shared_lobby_${lobbyId}`;
    const st = saveSystem.getState();
    if (st.claimedRewards.includes(key)) return null;
    const {nextState, summary} = this.grantInternalRewards(st, {
      coins: clamp(Math.floor(coins), 0, 200),
      xp: clamp(Math.floor(xp), 0, 300),
      label: 'Multiplayer Activity Reward',
      rewardKey: key,
    });
    saveSystem.save(nextState, true);
    this.emit();
    return summary;
  }

  public getStoryCampaignSnapshot() {
    return getStoryMissionProgressSnapshot(saveSystem.getState());
  }

  public acceptStoryCampaignMission(): {ok: boolean; missionTitle?: string; reason?: string} {
    const st = saveSystem.getState();
    if (st.story.campaignCompleted) {
      return {ok: false, reason: 'Story Campaign already completed!'};
    }
    const mission = getActiveStoryCampaignMission(st);
    if (!mission) {
      return {ok: false, reason: 'No pending Story Campaign mission.'};
    }
    if (
      st.story.currentMissionId === mission.id &&
      (st.story.missionPhase === 'objective_active' || st.story.missionPhase === 'return_to_mission_man')
    ) {
      return {ok: true, missionTitle: mission.title};
    }

    const baseline = captureStoryMissionBaseline(st);
    const nextState: SaveDataV1 = {
      ...st,
      story: {
        ...st.story,
        started: true,
        currentMissionId: mission.id,
        missionPhase: 'objective_active',
        missionBaseline: baseline,
      },
    };
    saveSystem.save(nextState, true);
    this.emit();
    return {ok: true, missionTitle: mission.title};
  }

  public setStoryAllianceChoice(choiceId: 'civic_alliance' | 'street_syndicate'): {
    ok: boolean;
    label: string;
  } {
    const opt = STORY_ALLIANCE_CHOICES.find((c) => c.id === choiceId);
    if (!opt) return {ok: false, label: ''};
    const st = saveSystem.getState();
    saveSystem.save(
      {
        ...st,
        story: {
          ...st.story,
          choices: {
            ...(st.story.choices ?? {}),
            factions_alliance: opt.id,
          },
        },
      },
      true,
    );
    this.emit();
    return {ok: true, label: `${opt.title} — ${opt.subtitle}`};
  }

  public completeCurrentStoryCampaignMission(): {
    ok: boolean;
    reason?: string;
    completedMissionTitle?: string;
    isFinale?: boolean;
    nextMissionTitle?: string;
    summary?: ProgressionAwardSummary;
  } {
    const st = saveSystem.getState();
    if (st.story.campaignCompleted) {
      return {ok: false, reason: 'Story Campaign already completed.'};
    }
    const snap = getStoryMissionProgressSnapshot(st);
    if (!snap.mission) {
      return {ok: false, reason: 'No active Story Campaign mission.'};
    }
    if (!snap.accepted) {
      return {ok: false, reason: 'Accept the briefing from The Mission Man first.'};
    }
    if (!snap.complete) {
      return {ok: false, reason: `Objective in progress: ${snap.detail}`};
    }

    const mission = snap.mission;
    const rewardKey = `story_campaign_${mission.id}`;
    const nextCompleted = Array.from(
      new Set([...(st.story.completedMissionIds ?? []), mission.id]),
    ).slice(0, 20);
    const nextMission = STORY_CAMPAIGN_MISSIONS.find((m) => !nextCompleted.includes(m.id)) ?? null;
    const isFinale = Boolean(mission.isFinale || !nextMission);

    const draft: SaveDataV1 = {
      ...st,
      story: {
        ...st.story,
        started: true,
        completedMissionIds: nextCompleted,
        currentMissionId: isFinale || !nextMission ? null : nextMission.id,
        missionPhase: isFinale ? 'campaign_complete' : 'talk_to_mission_man',
        campaignCompleted: isFinale,
        endingUnlocked: st.story.endingUnlocked || isFinale,
        missionBaseline: null,
      },
    };

    const {nextState, summary} = this.grantInternalRewards(draft, {
      coins: st.claimedRewards.includes(rewardKey) ? 0 : mission.rewardCoins,
      xp: st.claimedRewards.includes(rewardKey) ? 0 : mission.rewardXp,
      label: mission.title,
      unlockTitle: isFinale ? 'Lead Gang Leader' : undefined,
      unlockBadge: isFinale ? 'badge_lead_gang_leader' : undefined,
      rewardKey,
    });

    if (isFinale && !nextState.achievements.unlockedIds.includes('ach_lead_gang_leader')) {
      nextState.achievements = {
        ...nextState.achievements,
        unlockedIds: [...nextState.achievements.unlockedIds, 'ach_lead_gang_leader'].slice(0, 64),
      };
    }

    saveSystem.save(nextState, true);
    this.emit();
    return {
      ok: true,
      completedMissionTitle: mission.title,
      isFinale,
      nextMissionTitle: nextMission?.title,
      summary,
    };
  }

  public markStoryTeaserViewed(): void {
    const st = saveSystem.getState();
    if (st.story.teaserViewed) return;
    saveSystem.save(
      {
        ...st,
        story: {
          ...st.story,
          teaserViewed: true,
        },
      },
      true,
    );
    this.emit();
  }

  public notifyExternalReset(): void {
    this.activeSpeedBoostUntilMs = 0;
    this.emit();
  }
}

export const economySystem = new EconomySystem();

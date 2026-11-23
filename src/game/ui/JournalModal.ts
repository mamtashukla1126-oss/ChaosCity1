import {
  COLLECTIBLE_RELICS,
  computeExplorationBreakdown,
  SECRET_LOCATIONS,
} from '@/src/game/data/explorationData';
import {
  CITIZEN_TITLES,
  EXPANDED_ACHIEVEMENTS,
  FULL_MISSIONS,
  getStoryMissionProgressSnapshot,
  getXpLevelProgress,
  LEVEL_MILESTONES,
  MISSION_HOUSE_COORDS,
  STORY_ALLIANCE_CHOICES,
  STORY_CAMPAIGN_MISSIONS,
  STORY_CHAPTERS,
  StoryChapterDef,
  TIMED_ROTATING_CHALLENGES,
} from '@/src/game/data/progressionData';
import {audioSystem} from '@/src/game/systems/AudioSystem';
import {economySystem, ProgressionAwardSummary} from '@/src/game/systems/EconomySystem';
import {saveSystem} from '@/src/game/systems/SaveSystem';
import {MissionCategory} from '@/src/game/types/gameTypes';

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type JournalTab = 'missions' | 'story' | 'exploration' | 'progression' | 'achievements';

export interface JournalModalCallbacks {
  onTrackLocation?: (x: number, y: number, label: string, missionId?: string) => void;
  onPlayStoryCutscene?: (
    chapter: StoryChapterDef,
    mode: 'intro' | 'outro',
    rewardBanner?: string,
  ) => void;
  onAwarded?: (summary: ProgressionAwardSummary) => void;
  onMissionStateChanged?: () => void;
  onClose?: () => void;
}

export class JournalModal {
  private readonly backdrop: HTMLDivElement;
  private openState = false;
  private activeTab: JournalTab = 'missions';
  private activeMissionCat: 'all' | MissionCategory = 'all';
  private feedback: {text: string; error: boolean} | null = null;

  constructor(
    parent: HTMLElement,
    private readonly callbacks: JournalModalCallbacks = {},
  ) {
    this.backdrop = document.createElement('div');
    this.backdrop.className =
      'ui-interactive fixed inset-0 z-40 hidden items-center justify-center bg-[#040812]/85 p-3 sm:p-4';
    parent.appendChild(this.backdrop);

    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) {
        this.close();
      }
    });
  }

  public isOpen(): boolean {
    return this.openState;
  }

  public open(initialTab: JournalTab = 'missions'): void {
    this.openState = true;
    this.activeTab = initialTab;
    this.feedback = null;
    this.render();
    this.backdrop.style.display = 'flex';
  }

  public close(): void {
    if (!this.openState) return;
    this.openState = false;
    this.backdrop.style.display = 'none';
    this.backdrop.innerHTML = '';
    this.callbacks.onClose?.();
  }

  private render(): void {
    const save = saveSystem.getState();
    const xpProg = getXpLevelProgress(save.progression.xp);
    const activeMissionId = economySystem.getActiveMissionId();

    this.backdrop.innerHTML = `
      <div class="cc-panel rounded-2xl w-full max-w-4xl max-h-[92dvh] flex flex-col overflow-hidden text-slate-100">
        <!-- Header -->
        <div class="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-[#22355c] shrink-0">
          <div class="min-w-0">
            <div class="font-mono-tabular text-[11px] font-bold text-amber-300 truncate">
              CITIZEN LV.${xpProg.level} · "${esc(save.progression.selectedTitle)}" · ${save.coins} Coins
            </div>
            <h2 class="font-display text-lg sm:text-xl font-bold text-white">Chaos City Journal & Story</h2>
          </div>
          <button id="cc-jn-close" type="button" class="cc-btn-secondary px-3.5 py-2 rounded-lg text-xs font-semibold min-h-[42px] cursor-pointer shrink-0">
            Close
          </button>
        </div>

        <!-- Tabs -->
        <div class="flex flex-wrap gap-1.5 px-4 sm:px-5 py-2.5 bg-[#091020] border-b border-[#22355c] shrink-0">
          ${(
            [
              {id: 'missions', label: 'Missions & Daily'},
              {id: 'story', label: 'Story Quests'},
              {id: 'exploration', label: 'Exploration & Secrets'},
              {id: 'progression', label: `Level & Unlocks (Lv.${xpProg.level})`},
              {id: 'achievements', label: `Achievements (${save.achievements.unlockedIds.length}/${EXPANDED_ACHIEVEMENTS.length})`},
            ] as {id: JournalTab; label: string}[]
          )
            .map(
              (tab) => `
                <button type="button" data-jn-tab="${tab.id}" class="cc-jn-tab px-3.5 py-2 rounded-lg text-xs font-bold min-h-[38px] cursor-pointer ${
                  tab.id === this.activeTab
                    ? 'bg-sky-500 text-[#06101f]'
                    : 'bg-[#131f38] text-slate-300 border border-[#22355c] hover:text-white'
                }">${tab.label}</button>
              `,
            )
            .join('')}
        </div>

        ${
          this.feedback
            ? `<div class="mx-4 sm:mx-5 mt-3 px-3.5 py-2 rounded-xl text-xs font-semibold border shrink-0 ${
                this.feedback.error
                  ? 'bg-rose-500/15 border-rose-400/50 text-rose-200'
                  : 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200'
              }">${esc(this.feedback.text)}</div>`
            : ''
        }

        <div class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          ${
            this.activeTab === 'missions'
              ? this.renderMissionsTab(save, activeMissionId)
              : this.activeTab === 'story'
                ? this.renderStoryTab(save)
                : this.activeTab === 'exploration'
                  ? this.renderExplorationTab(save)
                  : this.activeTab === 'progression'
                    ? this.renderProgressionTab(save, xpProg)
                    : this.renderAchievementsTab(save)
          }
        </div>
      </div>
    `;

    this.backdrop.querySelector('#cc-jn-close')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.close();
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-jn-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        audioSystem.playButtonClick();
        this.activeTab = (btn.dataset.jnTab as JournalTab) ?? 'missions';
        this.feedback = null;
        this.render();
      });
    });

    this.bindTabEvents();
  }

  private renderMissionsTab(
    save: ReturnType<typeof saveSystem.getState>,
    activeMissionId: string | null,
  ): string {
    const cats: {id: 'all' | MissionCategory; label: string}[] = [
      {id: 'all', label: 'All'},
      {id: 'exploration', label: 'Exploration'},
      {id: 'minigame', label: 'Mini-Games'},
      {id: 'driving', label: 'Driving'},
      {id: 'delivery', label: 'Delivery'},
      {id: 'npc', label: 'Residents'},
      {id: 'side', label: 'City Life'},
      {id: 'story', label: 'Story Quests'},
    ];

    const dailyChallenges = TIMED_ROTATING_CHALLENGES.map((c) => {
      const periodKey =
        c.period === 'daily' ? save.progression.dailyResetKey : save.progression.weeklyResetKey;
      const rewardKey = `timed_${c.id}_${periodKey}`;
      const claimed = save.claimedRewards.includes(rewardKey);
      const counts =
        c.period === 'daily' ? save.progression.dailyCounts : save.progression.weeklyCounts;
      const cur = Math.min(c.goal, counts[c.statKey] ?? 0);
      const ready = cur >= c.goal && !claimed;
      return `
        <div class="rounded-xl bg-[#091020] border ${claimed ? 'border-emerald-400/35' : 'border-[#22355c]'} p-3 flex flex-col justify-between gap-2">
          <div>
            <div class="flex items-center justify-between gap-2">
              <span class="font-mono-tabular text-[10px] font-bold uppercase ${c.period === 'daily' ? 'text-sky-300' : 'text-fuchsia-300'}">${c.period} (${periodKey})</span>
              <span class="font-mono-tabular text-[11px] font-bold text-amber-300">+${c.rewardCoins}c · +${c.rewardXp} XP</span>
            </div>
            <div class="font-display font-bold text-xs text-white mt-0.5">${c.title}</div>
            <div class="text-[11px] text-slate-300 mt-0.5">${c.description}</div>
          </div>
          <div class="flex items-center justify-between gap-2 pt-1.5 border-t border-[#1b2c4e]">
            <span class="font-mono-tabular text-[11px] text-slate-300">${cur}/${c.goal}</span>
            ${
              claimed
                ? `<span class="text-[11px] font-bold text-emerald-300">Claimed</span>`
                : ready
                  ? `<button type="button" data-claim-timed="${c.id}" class="cc-jn-timed cc-btn-primary px-3 py-1.5 rounded-lg text-[11px] font-bold min-h-[34px] cursor-pointer">Claim</button>`
                  : `<span class="text-[11px] text-slate-400">In Progress</span>`
            }
          </div>
        </div>
      `;
    }).join('');

    const missions =
      this.activeMissionCat === 'all'
        ? FULL_MISSIONS
        : FULL_MISSIONS.filter((m) => m.category === this.activeMissionCat);

    return `
      <!-- Daily & Weekly Bonuses -->
      <div class="space-y-2">
        <div class="font-mono-tabular text-[11px] font-bold uppercase tracking-wider text-sky-300">
          Daily & Weekly Challenges (Auto-Resetting)
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          ${dailyChallenges}
        </div>
      </div>

      <!-- Mission Category Filter -->
      <div class="space-y-2.5 pt-2 border-t border-[#1e2f52]">
        <div class="flex flex-wrap items-center gap-1.5">
          ${cats
            .map(
              (c) => `
                <button type="button" data-m-cat="${c.id}" class="cc-jn-mcat px-2.5 py-1.5 rounded-lg text-[11px] font-semibold min-h-[32px] cursor-pointer ${
                  c.id === this.activeMissionCat
                    ? 'bg-sky-500 text-[#06101f]'
                    : 'bg-[#131f38] text-slate-300 border border-[#22355c]'
                }">${c.label}</button>
              `,
            )
            .join('')}
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          ${(() => {
            const acceptedIds = new Set(economySystem.getAcceptedMissionIds());
            return missions
              .map((m) => {
                const cur = m.getProgress(save);
                const pct = Math.min(100, Math.round((cur / m.goal) * 100));
                const claimed = save.claimedRewards.includes(`mission_reward_${m.id}`);
                const done = cur >= m.goal;
                const isAccepted = acceptedIds.has(m.id);
                const isTracked = activeMissionId === m.id;
                const statusBadge = claimed
                  ? '<span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-bold">CLAIMED</span>'
                  : isTracked
                    ? '<span class="px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 text-[9px] font-bold">TRACKING</span>'
                    : isAccepted
                      ? '<span class="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[9px] font-bold">ACCEPTED</span>'
                      : '<span class="px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300 text-[9px] font-bold">AVAILABLE</span>';

                return `
                  <div class="rounded-xl bg-[#091020] border ${
                    isTracked ? 'border-amber-400/75' : done ? 'border-emerald-400/50' : 'border-[#22355c]'
                  } p-3.5 flex flex-col justify-between gap-2.5">
                    <div>
                      <div class="flex items-center justify-between gap-2 mb-1">
                        <div class="flex items-center gap-1.5 min-w-0">
                          ${statusBadge}
                          <span class="font-mono-tabular text-[10px] font-bold uppercase text-sky-300 truncate">${m.category} · ${m.npcOrLocation}</span>
                        </div>
                        <span class="font-mono-tabular text-[11px] font-bold text-amber-300 shrink-0">+${m.rewardCoins}c · +${m.rewardXp} XP</span>
                      </div>
                      <h3 class="font-display font-bold text-sm text-white">${m.title}</h3>
                      <p class="text-xs text-slate-300 mt-1">${m.description}</p>
                      ${m.unlockLabel ? `<div class="text-[11px] text-emerald-300 mt-1 font-semibold">Unlock: ${m.unlockLabel}</div>` : ''}
                    </div>

                    <div>
                      <div class="flex items-center justify-between text-[11px] font-mono-tabular text-slate-300 mb-1">
                        <span>Progress: ${cur}/${m.goal}</span>
                        <span>${pct}%</span>
                      </div>
                      <div class="w-full h-2 rounded-full bg-[#060b16] overflow-hidden mb-2.5">
                        <div class="h-full ${done ? 'bg-emerald-400' : 'bg-sky-400'}" style="width:${pct}%"></div>
                      </div>

                      <div class="flex flex-wrap items-center justify-end gap-1.5">
                        ${
                          !claimed && !isAccepted
                            ? `<button type="button" data-accept-mission="${m.id}" class="cc-jn-accept cc-btn-primary px-3 py-1.5 rounded-lg text-[11px] font-bold min-h-[34px] cursor-pointer">Accept Mission</button>`
                            : ''
                        }
                        ${
                          !claimed && isAccepted && !isTracked
                            ? `<button type="button" data-track-mission="${m.id}" class="cc-jn-track cc-btn-secondary px-3 py-1.5 rounded-lg text-[11px] font-bold min-h-[34px] cursor-pointer">Track Objective</button>`
                            : ''
                        }
                        ${
                          !claimed && isTracked
                            ? `<button type="button" data-pause-mission="${m.id}" class="cc-jn-pause px-3 py-1.5 rounded-lg text-[11px] font-bold min-h-[34px] bg-amber-400/20 border border-amber-400 text-amber-200 cursor-pointer">Pause Tracking</button>`
                            : ''
                        }
                        ${
                          !claimed && isAccepted
                            ? `<button type="button" data-abandon-mission="${m.id}" class="cc-jn-abandon px-2.5 py-1.5 rounded-lg text-[11px] font-semibold min-h-[34px] bg-rose-500/15 border border-rose-400/40 text-rose-200 cursor-pointer">Abandon</button>`
                            : ''
                        }
                        ${
                          claimed
                            ? `<span class="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-[11px] font-bold">Reward Claimed</span>`
                            : done
                              ? `<button type="button" data-claim-mission="${m.id}" class="cc-jn-claim cc-btn-primary px-3.5 py-1.5 rounded-lg text-[11px] font-bold min-h-[34px] cursor-pointer">Claim Reward</button>`
                              : ''
                        }
                      </div>
                    </div>
                  </div>
                `;
              })
              .join('');
          })()}
        </div>
      </div>
    `;
  }

  private renderStoryTab(save: ReturnType<typeof saveSystem.getState>): string {
    const completedCount = save.story.completedChapters.length;
    const snap = getStoryMissionProgressSnapshot(save);
    const campaignDoneCount = save.story.completedMissionIds?.length ?? 0;
    const allianceOpt = STORY_ALLIANCE_CHOICES.find((c) => c.id === save.story.choices?.factions_alliance);
    const pct = snap.goal > 0 ? Math.min(100, Math.round((snap.cur / snap.goal) * 100)) : 100;

    return `
      <div class="rounded-xl bg-gradient-to-r from-[#24140a] via-[#131936] to-[#0b162e] border ${
        save.story.campaignCompleted ? 'border-emerald-400/60' : 'border-amber-400/70'
      } p-4 space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div class="font-mono-tabular text-[11px] font-bold text-amber-300">
              MAIN STORY CAMPAIGN · ${campaignDoneCount}/${STORY_CAMPAIGN_MISSIONS.length} OPERATIONS CLEARED
            </div>
            <h3 class="font-display text-lg font-bold text-white">
              ${save.story.campaignCompleted ? 'Kai — The Lead Gang Leader ♛' : 'The Mission House Campaign'}
            </h3>
            <p class="text-xs text-slate-300 mt-1 leading-relaxed">
              ${
                save.story.campaignCompleted
                  ? 'You conquered every Mission House operation and earned the title Lead Gang Leader. The city awaits Chaos City 2!'
                  : snap.mission
                    ? `<b>${snap.mission.title}</b> — ${snap.mission.objectiveText}`
                    : 'Visit The Mission House in Downtown and speak with The Mission Man.'
              }
            </p>
            ${
              allianceOpt
                ? `<div class="mt-1.5 text-[11px] text-sky-300 font-semibold">Allegiance: ${allianceOpt.title} (${allianceOpt.subtitle})</div>`
                : ''
            }
          </div>
          ${
            !save.story.campaignCompleted
              ? `<button id="cc-story-locate-hq" type="button" class="cc-btn-primary px-4 py-2.5 rounded-xl text-xs font-bold min-h-[44px] cursor-pointer shrink-0">Locate Mission House</button>`
              : `<span class="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 font-mono-tabular text-xs font-bold shrink-0">CAMPAIGN COMPLETE</span>`
          }
        </div>
        ${
          !save.story.campaignCompleted && snap.mission
            ? `<div class="space-y-1.5">
                <div class="flex items-center justify-between text-[11px] font-mono-tabular">
                  <span class="${snap.complete ? 'text-emerald-300 font-bold' : 'text-amber-200'}">
                    ${snap.accepted ? (snap.complete ? 'Ready! Return to The Mission Man inside The Mission House' : snap.detail) : 'Speak with The Mission Man inside The Mission House to accept this briefing'}
                  </span>
                  <span class="text-slate-300 font-bold">${snap.cur}/${snap.goal}</span>
                </div>
                <div class="w-full h-2 rounded-full bg-[#060b16] overflow-hidden border border-[#25375c]">
                  <div class="h-full bg-gradient-to-r from-amber-400 to-emerald-400" style="width: ${pct}%;"></div>
                </div>
              </div>`
            : ''
        }
      </div>

      <div class="rounded-xl bg-gradient-to-r from-[#0d1d3a] to-[#1a1640] border border-sky-400/35 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div class="font-mono-tabular text-[11px] font-bold text-amber-300">SIDE CAMPAIGN · ${completedCount}/5 CHAPTERS CLEARED</div>
          <h3 class="font-display text-lg font-bold text-white">The Starlight Beacon</h3>
          <p class="text-xs text-slate-300 mt-1 leading-relaxed">
            Unite Chaos City's neighborhoods—Central Park, Chaos Customs, Pixel Palace, and Skyline Tower—to reignite the city beacon and unlock the Starlight Interceptor hypercar! Free-roam stays unlocked at all times.
          </p>
        </div>
        ${
          !save.story.started
            ? `<button id="cc-story-begin" type="button" class="cc-btn-primary px-4 py-2.5 rounded-xl text-xs font-bold min-h-[44px] cursor-pointer shrink-0">Begin Chapter 1</button>`
            : ''
        }
      </div>

      <div class="space-y-3">
        ${STORY_CHAPTERS.map((ch) => {
          const isCompleted = save.story.completedChapters.includes(ch.chapter);
          const isUnlocked = ch.chapter === 1 || save.story.completedChapters.includes(ch.chapter - 1);
          const ready = isUnlocked && !isCompleted && ch.isObjectiveMet(save);

          return `
            <div class="rounded-xl bg-[#091020] border ${
              isCompleted
                ? 'border-emerald-400/60'
                : ready
                  ? 'border-amber-400'
                  : isUnlocked
                    ? 'border-sky-400/50'
                    : 'border-[#1d2d4e] opacity-75'
            } p-4 flex flex-col gap-3">
              <div class="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div class="font-mono-tabular text-[10px] font-bold uppercase ${
                    isCompleted ? 'text-emerald-300' : isUnlocked ? 'text-sky-300' : 'text-slate-400'
                  }">
                    ${isCompleted ? 'COMPLETED' : isUnlocked ? 'ACTIVE CHAPTER' : `LOCKED (CLEAR CHAPTER ${ch.chapter - 1})`} · ${ch.subtitle}
                  </div>
                  <h4 class="font-display font-bold text-base text-white mt-0.5">${ch.title}</h4>
                </div>
                <span class="font-mono-tabular text-xs font-bold text-amber-300">${ch.rewardSummary}</span>
              </div>

              <p class="text-xs text-slate-300 leading-relaxed">${ch.synopsis}</p>
              <div class="text-xs font-semibold ${ready || isCompleted ? 'text-emerald-300' : 'text-sky-200'}">
                Objective: ${ch.objectiveText}
              </div>

              <div class="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[#1b2c4e]">
                ${
                  isUnlocked
                    ? `<button type="button" data-story-intro="${ch.chapter}" class="cc-jn-sintro cc-btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[38px] cursor-pointer">${
                        isCompleted ? 'Replay Scene' : 'Watch Scene'
                      }</button>`
                    : ''
                }
                ${
                  isUnlocked && !isCompleted
                    ? `<button type="button" data-story-locate="${ch.chapter}" class="cc-jn-slocate cc-btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[38px] cursor-pointer">Locate Objective</button>`
                    : ''
                }
                ${
                  ready
                    ? `<button type="button" data-story-claim="${ch.chapter}" class="cc-jn-sclaim cc-btn-primary px-4 py-1.5 rounded-lg text-xs font-bold min-h-[38px] cursor-pointer">Complete Chapter & Claim</button>`
                    : ''
                }
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  private renderExplorationTab(save: ReturnType<typeof saveSystem.getState>): string {
    const exp = computeExplorationBreakdown(save);
    const colSet = new Set(save.collectibles ?? []);
    const secSet = new Set(save.discoveredSecrets ?? []);

    return `
      <div class="rounded-xl bg-[#091020] border border-[#22355c] p-4 space-y-2.5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div class="font-mono-tabular text-[11px] font-bold text-emerald-300">WORLD DISCOVERY PROGRESS</div>
            <div class="font-display text-xl font-bold text-white">${exp.overallPercent}% Explored</div>
          </div>
          <div class="font-mono-tabular text-xs text-slate-300">
            Relics: <b class="text-amber-300">${exp.totalDiscoveredCollectibles}/${exp.totalCollectibles}</b> ·
            Secrets: <b class="text-fuchsia-300">${exp.totalDiscoveredSecrets}/${exp.totalSecrets}</b>
          </div>
        </div>
        <div class="w-full h-2.5 rounded-full bg-[#060b16] overflow-hidden">
          <div class="h-full bg-gradient-to-r from-emerald-400 to-sky-400" style="width:${exp.overallPercent}%"></div>
        </div>
      </div>

      <div class="space-y-2">
        <div class="font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-sky-300">District Breakdown</div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          ${exp.districts
            .map(
              (d) => `
              <div class="rounded-xl bg-[#091020] border ${d.visited ? 'border-[#284273]' : 'border-[#192642] opacity-75'} p-3 space-y-1.5">
                <div class="flex items-center justify-between text-xs">
                  <span class="font-display font-bold text-white truncate">${d.districtName}</span>
                  <span class="font-mono-tabular font-bold ${d.percent === 100 ? 'text-emerald-300' : 'text-sky-300'}">${d.percent}%</span>
                </div>
                <div class="w-full h-1.5 rounded-full bg-[#060b16] overflow-hidden">
                  <div class="h-full bg-emerald-400" style="width:${d.percent}%"></div>
                </div>
                <div class="text-[10px] text-slate-400">
                  ${d.visited ? 'Visited' : 'Unvisited'} · Relics ${d.collectiblesFound}/${d.collectiblesTotal} · Secrets ${d.secretsFound}/${d.secretsTotal}
                </div>
              </div>`,
            )
            .join('')}
        </div>
      </div>

      <div class="space-y-2">
        <div class="font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-amber-300">
          Collectible Relics (${exp.totalDiscoveredCollectibles}/${COLLECTIBLE_RELICS.length} Found)
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          ${COLLECTIBLE_RELICS.map((r) => {
            const found = colSet.has(r.id);
            return `
              <div class="rounded-xl bg-[#091020] border ${found ? 'border-amber-400/50' : 'border-[#1d2d4e] opacity-80'} p-3">
                <div class="flex items-center justify-between gap-2">
                  <span class="font-display font-bold text-xs ${found ? 'text-white' : 'text-slate-400'}">
                    ${found ? r.name : '??? Undiscovered Relic'}
                  </span>
                  <span class="font-mono-tabular text-[10px] uppercase font-bold ${
                    r.rarity === 'mythic'
                      ? 'text-fuchsia-300'
                      : r.rarity === 'epic'
                        ? 'text-violet-300'
                        : r.rarity === 'rare'
                          ? 'text-sky-300'
                          : 'text-slate-300'
                  }">${r.rarity}</span>
                </div>
                <div class="text-[11px] text-slate-400 mt-1">
                  ${found ? `Discovered in ${r.districtId} (+${r.rewardCoins}c)` : `Rumor: ${r.hint}`}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="space-y-2">
        <div class="font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-fuchsia-300">
          Secret Locations (${exp.totalDiscoveredSecrets}/${SECRET_LOCATIONS.length} Discovered)
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          ${SECRET_LOCATIONS.map((sec) => {
            const found = secSet.has(sec.id);
            return `
              <div class="rounded-xl bg-[#091020] border ${found ? 'border-fuchsia-400/50' : 'border-[#1d2d4e] opacity-75'} p-3">
                <div class="flex items-center justify-between gap-2">
                  <span class="font-display font-bold text-xs ${found ? 'text-white' : 'text-slate-400'}">
                    ${found ? sec.name : '??? Uncharted Secret Area'}
                  </span>
                  <span class="font-mono-tabular text-[10px] uppercase text-fuchsia-300">${sec.category.replace('_', ' ')}</span>
                </div>
                <div class="text-[11px] text-slate-400 mt-1">
                  ${found ? sec.description : `Explore ${sec.districtId.replace('_', ' ')} closely to uncover this secret location.`}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  private renderProgressionTab(
    save: ReturnType<typeof saveSystem.getState>,
    xpProg: ReturnType<typeof getXpLevelProgress>,
  ): string {
    return `
      <div class="rounded-xl bg-[#091020] border border-[#22355c] p-4 space-y-3">
        <div class="flex items-center justify-between gap-2">
          <div>
            <div class="font-mono-tabular text-[11px] font-bold text-sky-300">CITIZEN LEVEL</div>
            <div class="font-display text-2xl font-bold text-white">Level ${xpProg.level} · ${save.progression.xp} Total XP</div>
          </div>
          <div class="text-right font-mono-tabular text-xs text-slate-300">
            ${
              xpProg.nextLevelXp !== null
                ? `${xpProg.progressInLevel}/${xpProg.neededInLevel} XP to Lv.${xpProg.level + 1}`
                : 'MAX LEVEL REACHED'
            }
          </div>
        </div>
        <div class="w-full h-3 rounded-full bg-[#060b16] border border-[#22355c] overflow-hidden">
          <div class="h-full bg-gradient-to-r from-sky-400 to-amber-400" style="width:${xpProg.percent}%"></div>
        </div>
      </div>

      <!-- Titles Selector -->
      <div class="space-y-2">
        <div class="font-mono-tabular text-[11px] font-bold uppercase tracking-wider text-amber-300">Citizen Titles</div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          ${CITIZEN_TITLES.map((t) => {
            const unlocked = save.progression.unlockedTitles.includes(t.label);
            const selected = save.progression.selectedTitle === t.label;
            return `
              <div class="rounded-xl bg-[#091020] border ${selected ? 'border-amber-400' : unlocked ? 'border-[#284273]' : 'border-[#192642] opacity-65'} p-3 flex items-center justify-between gap-2">
                <div>
                  <div class="font-display font-bold text-sm text-white">${t.label}</div>
                  <div class="text-[11px] text-slate-400">${t.requirement}</div>
                </div>
                ${
                  selected
                    ? `<span class="px-2.5 py-1 rounded bg-amber-400/20 text-amber-200 text-[11px] font-bold">Active</span>`
                    : unlocked
                      ? `<button type="button" data-select-title="${t.label}" class="cc-jn-title cc-btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[34px] cursor-pointer">Equip</button>`
                      : `<span class="text-[11px] text-slate-500 font-semibold">Locked</span>`
                }
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Level Milestones Roadmap -->
      <div class="space-y-2">
        <div class="font-mono-tabular text-[11px] font-bold uppercase tracking-wider text-emerald-300">Level Unlock Milestones</div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          ${LEVEL_MILESTONES.map((m) => {
            const unlocked = xpProg.level >= m.level;
            return `
              <div class="rounded-xl bg-[#091020] border ${unlocked ? 'border-emerald-400/60' : 'border-[#22355c]'} p-3 flex items-center justify-between gap-3">
                <div>
                  <div class="font-mono-tabular text-xs font-bold ${unlocked ? 'text-emerald-300' : 'text-sky-300'}">Level ${m.level} Milestone</div>
                  <div class="text-xs text-slate-200 mt-0.5">${m.summary}</div>
                </div>
                <span class="font-mono-tabular text-[11px] font-bold ${unlocked ? 'text-emerald-300' : 'text-slate-400'}">${unlocked ? 'UNLOCKED' : 'LOCKED'}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  private renderAchievementsTab(save: ReturnType<typeof saveSystem.getState>): string {
    return `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        ${EXPANDED_ACHIEVEMENTS.map((a) => {
          const unlocked = save.achievements.unlockedIds.includes(a.id);
          const cur = Math.min(a.goal, a.getProgress(save));
          return `
            <div class="rounded-xl bg-[#091020] border ${unlocked ? 'border-emerald-400/60' : 'border-[#22355c]'} p-3.5 flex items-start justify-between gap-3">
              <div>
                <h4 class="font-display font-bold text-sm ${unlocked ? 'text-emerald-300' : 'text-white'}">${a.title}</h4>
                <p class="text-xs text-slate-300 mt-1">${a.description}</p>
              </div>
              <span class="font-mono-tabular text-xs font-bold shrink-0 ${unlocked ? 'text-emerald-300' : 'text-slate-400'}">
                ${unlocked ? 'DONE' : `${cur}/${a.goal}`}
              </span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  private bindTabEvents(): void {
    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-jn-mcat').forEach((btn) => {
      btn.addEventListener('click', () => {
        audioSystem.playButtonClick();
        this.activeMissionCat = (btn.dataset.mCat as 'all' | MissionCategory) ?? 'all';
        this.render();
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-jn-accept').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.acceptMission;
        const m = FULL_MISSIONS.find((x) => x.id === id);
        if (!m) return;
        audioSystem.playInteract();
        economySystem.acceptMission(m.id);
        this.callbacks.onTrackLocation?.(m.targetMarker.x, m.targetMarker.y, m.targetMarker.label, m.id);
        this.callbacks.onMissionStateChanged?.();
        this.feedback = {
          text: `Accepted "${m.title}" and pinned ${m.targetMarker.label} on GPS!`,
          error: false,
        };
        this.render();
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-jn-track').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.trackMission;
        const m = FULL_MISSIONS.find((x) => x.id === id);
        if (!m) return;
        audioSystem.playInteract();
        economySystem.setActiveMissionId(m.id);
        this.callbacks.onTrackLocation?.(m.targetMarker.x, m.targetMarker.y, m.targetMarker.label, m.id);
        this.callbacks.onMissionStateChanged?.();
        this.feedback = {
          text: `Now tracking "${m.title}" (${m.targetMarker.label}) on MiniMap & HUD!`,
          error: false,
        };
        this.render();
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-jn-pause').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.pauseMission;
        const m = FULL_MISSIONS.find((x) => x.id === id);
        if (!m) return;
        audioSystem.playButtonClick();
        economySystem.pauseMission();
        this.callbacks.onMissionStateChanged?.();
        this.feedback = {
          text: `Paused tracking for "${m.title}". Resume anytime from Journal.`,
          error: false,
        };
        this.render();
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-jn-abandon').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.abandonMission;
        const m = FULL_MISSIONS.find((x) => x.id === id);
        if (!m) return;
        audioSystem.playButtonClick();
        economySystem.abandonMission(m.id);
        this.callbacks.onMissionStateChanged?.();
        this.feedback = {
          text: `Abandoned "${m.title}". Re-accept anytime from ${m.npcOrLocation} or Journal.`,
          error: false,
        };
        this.render();
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-jn-claim').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.claimMission;
        if (!id) return;
        const res = economySystem.claimMissionReward(id);
        if (!res.ok) {
          audioSystem.playError();
          this.feedback = {text: res.reason ?? 'Could not claim mission.', error: true};
          this.render();
          return;
        }
        audioSystem.playCoin();
        if (res.summary) this.callbacks.onAwarded?.(res.summary);
        this.callbacks.onMissionStateChanged?.();
        this.feedback = {
          text: `Mission complete! Claimed +${res.coinsAwarded} Coins & +${res.summary?.xpAwarded ?? 0} XP!`,
          error: false,
        };
        this.render();
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-jn-timed').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.claimTimed;
        if (!id) return;
        const res = economySystem.claimTimedChallengeReward(id);
        if (!res.ok || !res.summary) {
          audioSystem.playError();
          this.feedback = {text: res.reason ?? 'Cannot claim yet.', error: true};
          this.render();
          return;
        }
        audioSystem.playCoin();
        this.callbacks.onAwarded?.(res.summary);
        this.feedback = {
          text: `Bonus claimed! +${res.summary.coinsAwarded} Coins · +${res.summary.xpAwarded} XP!`,
          error: false,
        };
        this.render();
      });
    });

    this.backdrop.querySelector('#cc-story-locate-hq')?.addEventListener('click', () => {
      audioSystem.playInteract();
      const snap = getStoryMissionProgressSnapshot(saveSystem.getState());
      const target =
        !snap.accepted || snap.complete || !snap.mission
          ? MISSION_HOUSE_COORDS
          : snap.mission.targetMarker;
      this.close();
      this.callbacks.onTrackLocation?.(target.x, target.y, target.label);
    });

    this.backdrop.querySelector('#cc-story-begin')?.addEventListener('click', () => {
      audioSystem.playInteract();
      economySystem.startStoryMode();
      const ch1 = STORY_CHAPTERS[0];
      economySystem.setActiveMissionId('m_story_finale');
      this.callbacks.onTrackLocation?.(ch1.targetMarker.x, ch1.targetMarker.y, ch1.targetMarker.label);
      if (this.callbacks.onPlayStoryCutscene) {
        this.close();
        this.callbacks.onPlayStoryCutscene(ch1, 'intro');
      } else {
        this.render();
      }
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-jn-sintro').forEach((btn) => {
      btn.addEventListener('click', () => {
        const ch = STORY_CHAPTERS.find((c) => c.chapter === Number(btn.dataset.storyIntro));
        if (!ch || !this.callbacks.onPlayStoryCutscene) return;
        audioSystem.playInteract();
        economySystem.startStoryMode();
        this.close();
        this.callbacks.onPlayStoryCutscene(ch, 'intro');
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-jn-slocate').forEach((btn) => {
      btn.addEventListener('click', () => {
        const ch = STORY_CHAPTERS.find((c) => c.chapter === Number(btn.dataset.storyLocate));
        if (!ch) return;
        audioSystem.playInteract();
        economySystem.startStoryMode();
        this.close();
        this.callbacks.onTrackLocation?.(ch.targetMarker.x, ch.targetMarker.y, ch.targetMarker.label);
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-jn-sclaim').forEach((btn) => {
      btn.addEventListener('click', () => {
        const ch = STORY_CHAPTERS.find((c) => c.chapter === Number(btn.dataset.storyClaim));
        if (!ch) return;
        const res = economySystem.completeStoryChapter(ch.chapter);
        if (!res.ok || !res.summary) {
          audioSystem.playError();
          this.feedback = {text: res.reason ?? 'Complete objective first.', error: true};
          this.render();
          return;
        }
        audioSystem.playCoin();
        this.callbacks.onAwarded?.(res.summary);
        const banner = `${ch.rewardSummary}${res.summary.leveledUpTo ? ` · LEVEL ${res.summary.leveledUpTo}!` : ''}`;
        if (this.callbacks.onPlayStoryCutscene) {
          this.close();
          this.callbacks.onPlayStoryCutscene(ch, 'outro', banner);
        } else {
          this.feedback = {text: `Cleared ${ch.title}! ${banner}`, error: false};
          this.render();
        }
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-jn-title').forEach((btn) => {
      btn.addEventListener('click', () => {
        const title = btn.dataset.selectTitle;
        if (!title) return;
        audioSystem.playInteract();
        economySystem.setSelectedTitle(title);
        this.feedback = {text: `Equipped citizen title "${title}"!`, error: false};
        this.render();
      });
    });
  }

  public destroy(): void {
    this.openState = false;
    this.backdrop.remove();
  }
}

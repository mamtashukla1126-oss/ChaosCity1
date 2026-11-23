import {
  STORY_ALLIANCE_CHOICES,
  STORY_CAMPAIGN_MISSIONS,
} from '@/src/game/data/progressionData';
import {audioSystem} from '@/src/game/systems/AudioSystem';
import {cloudSaveManager} from '@/src/game/systems/CloudSaveManager';
import {economySystem} from '@/src/game/systems/EconomySystem';
import {saveSystem} from '@/src/game/systems/SaveSystem';

function esc(val: unknown): string {
  return String(val ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export class MissionManModal {
  private readonly backdrop: HTMLDivElement;
  private openState = false;
  private destroyed = false;

  constructor(parent: HTMLElement) {
    this.backdrop = document.createElement('div');
    this.backdrop.className =
      'ui-interactive fixed inset-0 z-40 hidden items-center justify-center bg-[#040812]/84 p-3 sm:p-4';
    parent.appendChild(this.backdrop);

    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) {
        audioSystem.playButtonClick();
        this.close();
      }
    });
  }

  public isOpen(): boolean {
    return this.openState;
  }

  public close(): void {
    if (!this.openState) return;
    this.openState = false;
    this.backdrop.style.display = 'none';
    this.backdrop.innerHTML = '';
  }

  public openMissionMan(
    playerName: string,
    onCampaignUpdated: () => void,
    onTriggerKaiEnding: (choiceLabel: string) => void,
  ): void {
    this.openState = true;
    let feedback: {text: string; error: boolean} | null = null;

    const getChoiceLabel = (): string => {
      const choiceId = saveSystem.getState().story?.choices?.factions_alliance ?? 'civic_alliance';
      const opt = STORY_ALLIANCE_CHOICES.find((c) => c.id === choiceId);
      return opt ? `${opt.title} (${opt.subtitle})` : 'Civic Coalition (Shield the Districts)';
    };

    const render = () => {
      if (this.destroyed || !this.openState) return;
      const snap = economySystem.getStoryCampaignSnapshot();
      const save = saveSystem.getState();

      if (save.story?.campaignCompleted || !snap.mission) {
        const choiceLabel = getChoiceLabel();
        this.backdrop.innerHTML = `
          <div class="cc-panel rounded-2xl w-full max-w-lg max-h-[92dvh] flex flex-col overflow-hidden text-slate-100 border-amber-400/60">
            <div class="flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-amber-400/25 bg-gradient-to-r from-[#1a1308] to-[#0b1326] shrink-0">
              <div>
                <div class="font-mono-tabular text-[11px] font-bold text-amber-300 uppercase tracking-widest">
                  THE MISSION HOUSE · CAMPAIGN COMPLETE
                </div>
                <h2 class="font-display text-xl font-extrabold text-white">The Mission Man</h2>
              </div>
              <button id="cc-mm-close" type="button" class="cc-btn-secondary px-3.5 py-2 rounded-lg text-xs font-semibold min-h-[40px] cursor-pointer">
                Close
              </button>
            </div>

            <div class="p-4 sm:p-5 space-y-4 overflow-y-auto">
              <div class="rounded-xl bg-gradient-to-br from-amber-500/15 to-[#0b1326] border border-amber-400/50 p-4 space-y-2">
                <div class="flex items-center gap-2 text-amber-300 font-display font-bold text-sm">
                  <span>♛</span>
                  <span>KAI — THE LEAD GANG LEADER</span>
                </div>
                <p class="text-sm text-slate-100 italic leading-relaxed">
                  "Kai... you've come a long way. You've earned your place. From today onward, you are the LEAD GANG LEADER."
                </p>
                <div class="text-xs text-slate-300 pt-1">
                  Citizen: <b class="text-white">${esc(playerName)}</b> · Allegiance: <b class="text-amber-200">${esc(choiceLabel)}</b>
                </div>
              </div>

              <div class="rounded-xl bg-[#0a1223] border border-[#22355c] p-3.5 text-xs text-slate-300 leading-relaxed">
                All 7 Story Campaign chapters are cleared. Chaos City honors your command while the city braces for what comes next in <b class="text-rose-300">CHAOS CITY 2</b>.
              </div>

              <div class="flex flex-wrap justify-end gap-2">
                <button id="cc-mm-replay" type="button" class="cc-btn-primary px-4 py-2.5 rounded-xl text-xs font-bold min-h-[44px] cursor-pointer">
                  Replay Ending Cutscene
                </button>
                <button id="cc-mm-done" type="button" class="cc-btn-secondary px-4 py-2.5 rounded-xl text-xs font-semibold min-h-[44px] cursor-pointer">
                  Continue Exploring
                </button>
              </div>
            </div>
          </div>
        `;

        this.backdrop.style.display = 'flex';
        this.backdrop.querySelector('#cc-mm-close')?.addEventListener('click', () => this.close());
        this.backdrop.querySelector('#cc-mm-done')?.addEventListener('click', () => this.close());
        this.backdrop.querySelector('#cc-mm-replay')?.addEventListener('click', () => {
          audioSystem.playCoin();
          this.close();
          onTriggerKaiEnding(choiceLabel);
        });
        return;
      }

      const mission = snap.mission;
      const pct = Math.min(100, Math.round((snap.cur / Math.max(1, snap.goal)) * 100));
      const selectedChoice = save.story?.choices?.factions_alliance ?? '';
      const isFinalMission = Boolean(mission.isFinale);

      this.backdrop.innerHTML = `
        <div class="cc-panel rounded-2xl w-full max-w-xl max-h-[92dvh] flex flex-col overflow-hidden text-slate-100 border-amber-400/50">
          <div class="flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-amber-400/25 bg-gradient-to-r from-[#1a1308] via-[#0e172c] to-[#0b1326] shrink-0">
            <div>
              <div class="font-mono-tabular text-[11px] font-bold text-amber-300 uppercase tracking-widest">
                STORY CAMPAIGN · STAGE ${mission.stage} OF ${STORY_CAMPAIGN_MISSIONS.length}
              </div>
              <h2 class="font-display text-lg sm:text-xl font-extrabold text-white mt-0.5">
                The Mission Man — ${esc(mission.title)}
              </h2>
            </div>
            <button id="cc-mm-close" type="button" class="cc-btn-secondary px-3.5 py-2 rounded-lg text-xs font-semibold min-h-[40px] cursor-pointer shrink-0">
              Close
            </button>
          </div>

          <div class="p-4 sm:p-5 space-y-4 overflow-y-auto">
            ${
              feedback
                ? `<div class="rounded-xl px-3.5 py-2.5 text-xs font-medium border ${
                    feedback.error
                      ? 'bg-rose-500/15 border-rose-400/50 text-rose-200'
                      : 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200'
                  }">${esc(feedback.text)}</div>`
                : ''
            }

            <div class="rounded-xl bg-[#10182e] border border-amber-400/35 p-4 flex items-start gap-3.5">
              <div class="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-400/60 flex items-center justify-center text-2xl shrink-0">
                🎩
              </div>
              <div class="min-w-0">
                <div class="text-xs font-display font-bold text-amber-300">The Mission Man · ${esc(mission.subtitle)}</div>
                <p class="text-sm text-slate-100 italic leading-relaxed mt-1">
                  "${esc(mission.briefingQuote)}"
                </p>
              </div>
            </div>

            <div class="rounded-xl bg-[#091020] border border-[#22355c] p-4 space-y-2.5">
              <div class="flex items-center justify-between gap-2">
                <span class="font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-sky-300">
                  CURRENT OBJECTIVE
                </span>
                <span class="font-mono-tabular text-[11px] font-bold text-amber-300">
                  Reward: +${mission.rewardCoins}c · +${mission.rewardXp} XP
                </span>
              </div>
              <p class="text-xs sm:text-sm text-slate-200 leading-relaxed">
                ${esc(mission.objectiveText)}
              </p>

              ${
                snap.accepted
                  ? `<div class="pt-1 space-y-1.5">
                      <div class="flex items-center justify-between text-xs font-mono-tabular">
                        <span class="${snap.complete ? 'text-emerald-300 font-bold' : 'text-sky-300'}">${esc(snap.detail)}</span>
                        <span class="${snap.complete ? 'text-emerald-300 font-bold' : 'text-slate-300'}">${snap.cur} / ${snap.goal}</span>
                      </div>
                      <div class="h-2 rounded-full bg-[#060b16] border border-[#1d2d4e] overflow-hidden">
                        <div class="h-full ${snap.complete ? 'bg-emerald-400' : 'bg-amber-400'} transition-all" style="width:${pct}%"></div>
                      </div>
                    </div>`
                  : `<div class="text-[11px] text-amber-200/90 font-medium pt-1">
                      Status: Briefing Ready — Accept this stage to begin tracking progress.
                    </div>`
              }
            </div>

            ${
              mission.requiresChoice && snap.accepted
                ? `<div class="rounded-xl bg-[#0c1428] border border-sky-400/40 p-3.5 space-y-2.5">
                    <div class="font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-sky-300">
                      CHOOSE YOUR ALLEGIANCE PATH
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      ${STORY_ALLIANCE_CHOICES.map((ch) => {
                        const active = selectedChoice === ch.id;
                        return `
                          <button
                            type="button"
                            data-mm-choice="${ch.id}"
                            class="cc-mm-choice text-left rounded-xl p-3 border transition cursor-pointer ${
                              active
                                ? 'bg-amber-500/20 border-amber-400 text-white'
                                : 'bg-[#070d1b] border-[#22355c] hover:border-sky-400/60 text-slate-300'
                            }"
                          >
                            <div class="font-display text-xs font-bold ${active ? 'text-amber-200' : 'text-white'}">${esc(ch.title)} · ${esc(ch.subtitle)}</div>
                            <div class="text-[11px] text-slate-400 mt-1 leading-snug">${esc(ch.description)}</div>
                          </button>
                        `;
                      }).join('')}
                    </div>
                  </div>`
                : ''
            }

            <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span class="text-[11px] text-slate-400">
                ${
                  !snap.accepted
                    ? 'Step 1: Accept the briefing from The Mission Man.'
                    : snap.complete
                      ? 'Objective Complete! Turn in to advance the Story Campaign.'
                      : 'Finish the objective in Chaos City, then return here.'
                }
              </span>
              <div class="flex gap-2 ml-auto">
                ${
                  !snap.accepted
                    ? `<button id="cc-mm-accept" type="button" class="cc-btn-primary px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold min-h-[44px] cursor-pointer">
                        Accept Briefing
                      </button>`
                    : snap.complete
                      ? `<button id="cc-mm-turnin" type="button" class="cc-btn-primary px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold min-h-[44px] cursor-pointer">
                          ${isFinalMission ? 'Claim Final Promotion' : 'Turn In Mission'}
                        </button>`
                      : `<button id="cc-mm-go" type="button" class="cc-btn-secondary px-4 py-2.5 rounded-xl text-xs font-semibold min-h-[44px] border-sky-400/50 text-sky-200 cursor-pointer">
                          Go Complete Objective
                        </button>`
                }
              </div>
            </div>
          </div>
        </div>
      `;

      this.backdrop.style.display = 'flex';
      this.backdrop.querySelector('#cc-mm-close')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        this.close();
      });
      this.backdrop.querySelector('#cc-mm-go')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        this.close();
      });

      this.backdrop.querySelector('#cc-mm-accept')?.addEventListener('click', () => {
        const res = economySystem.acceptStoryCampaignMission();
        if (!res.ok) {
          audioSystem.playError();
          feedback = {text: res.reason ?? 'Unable to start mission.', error: true};
        } else {
          audioSystem.playInteract();
          feedback = {
            text: `Briefing accepted: ${res.missionTitle ?? mission.title}!`,
            error: false,
          };
          void cloudSaveManager.flushNow(true);
          onCampaignUpdated();
        }
        render();
      });

      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-mm-choice').forEach((btn) => {
        btn.addEventListener('click', () => {
          const cid = btn.dataset.mmChoice as 'civic_alliance' | 'street_syndicate' | undefined;
          if (!cid) return;
          const res = economySystem.setStoryAllianceChoice(cid);
          if (res.ok) {
            audioSystem.playInteract();
            feedback = {text: `Allegiance locked in: ${res.label}`, error: false};
            void cloudSaveManager.flushNow(true);
            onCampaignUpdated();
          } else {
            audioSystem.playError();
            feedback = {text: 'Could not select allegiance.', error: true};
          }
          render();
        });
      });

      this.backdrop.querySelector('#cc-mm-turnin')?.addEventListener('click', () => {
        const res = economySystem.completeCurrentStoryCampaignMission();
        if (!res.ok) {
          audioSystem.playError();
          feedback = {text: res.reason ?? 'Objective incomplete.', error: true};
          render();
          return;
        }
        audioSystem.playCoin();
        void cloudSaveManager.flushNow(true);
        onCampaignUpdated();
        if (res.isFinale) {
          const choiceLabel = getChoiceLabel();
          this.close();
          onTriggerKaiEnding(choiceLabel);
          return;
        }
        const awardedCoins = res.summary?.coinsAwarded ?? mission.rewardCoins;
        const awardedXp = res.summary?.xpAwarded ?? mission.rewardXp;
        feedback = {
          text: `Completed "${mission.title}" (+${awardedCoins} Coins · +${awardedXp} XP)! Next stage ready!`,
          error: false,
        };
        render();
      });
    };

    render();
  }

  public openMissionBoard(): void {
    this.openState = true;
    const snap = economySystem.getStoryCampaignSnapshot();
    const save = saveSystem.getState();
    const completedSet = new Set(save.story?.completedMissionIds ?? []);
    const choiceId = save.story?.choices?.factions_alliance;
    const choiceOpt = choiceId ? STORY_ALLIANCE_CHOICES.find((c) => c.id === choiceId) : null;
    const choiceLabel = choiceOpt ? `${choiceOpt.title} (${choiceOpt.subtitle})` : null;

    this.backdrop.innerHTML = `
      <div class="cc-panel rounded-2xl w-full max-w-xl max-h-[92dvh] flex flex-col overflow-hidden text-slate-100 border-amber-400/50">
        <div class="flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-[#22355c] shrink-0">
          <div>
            <div class="font-mono-tabular text-[11px] font-bold text-amber-300 uppercase tracking-widest">
              THE MISSION HOUSE · OPERATIONS BOARD
            </div>
            <h2 class="font-display text-xl font-bold text-white mt-0.5">Story Campaign Progression</h2>
          </div>
          <button id="cc-mb-close" type="button" class="cc-btn-secondary px-3.5 py-2 rounded-lg text-xs font-semibold min-h-[40px] cursor-pointer">
            Close
          </button>
        </div>

        <div class="p-4 sm:p-5 space-y-2.5 overflow-y-auto">
          ${
            choiceLabel
              ? `<div class="rounded-xl bg-sky-500/10 border border-sky-400/40 px-3 py-2 text-xs text-sky-200">
                  Declared Allegiance: <b>${esc(choiceLabel)}</b>
                </div>`
              : ''
          }
          ${STORY_CAMPAIGN_MISSIONS.map((m) => {
            const cleared = completedSet.has(m.id);
            const active = !save.story?.campaignCompleted && snap.mission?.id === m.id;
            return `
              <div class="rounded-xl p-3 border ${
                cleared
                  ? 'bg-emerald-500/10 border-emerald-400/40'
                  : active
                    ? 'bg-amber-500/10 border-amber-400/60'
                    : 'bg-[#091020] border-[#22355c] opacity-75'
              }">
                <div class="flex items-center justify-between gap-2">
                  <div class="font-display text-xs sm:text-sm font-bold text-white">
                    ${esc(m.title)}
                  </div>
                  <span class="font-mono-tabular text-[10px] font-bold px-2 py-0.5 rounded ${
                    cleared
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : active
                        ? 'bg-amber-500/20 text-amber-200'
                        : 'bg-slate-800 text-slate-400'
                  }">
                    ${cleared ? 'CLEARED' : active ? 'ACTIVE' : 'LOCKED'}
                  </span>
                </div>
                <p class="text-[11px] text-slate-300 mt-1">${esc(m.objectiveText)}</p>
                <div class="text-[10px] font-mono-tabular text-amber-300 mt-1">
                  Reward: +${m.rewardCoins} Coins · +${m.rewardXp} XP
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    this.backdrop.style.display = 'flex';
    this.backdrop.querySelector('#cc-mb-close')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.close();
    });
  }

  public destroy(): void {
    this.destroyed = true;
    this.openState = false;
    this.backdrop.remove();
  }
}

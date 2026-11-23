import {audioSystem} from '@/src/game/systems/AudioSystem';
import {
  AuthActionResult,
  authSystem,
  validatePasswordInput,
  validateUsernameInput,
} from '@/src/game/systems/AuthSystem';
import {saveSystem} from '@/src/game/systems/SaveSystem';

export interface AccountModalCallbacks {
  onAuthenticatedAndEnterCity: () => void;
  onAuthChanged: () => void;
  onClose?: () => void;
}

type AccountScreen = 'login' | 'signup' | 'loading' | 'success';

export interface AccountOpenContext {
  ctaLabel?: string;
  onContinue?: () => void;
}

const EYE_OPEN_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_OFF_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

function escapeAttr(val: string): string {
  return val
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export class AccountModal {
  private readonly backdrop: HTMLDivElement;
  private openState = false;
  private screen: AccountScreen = 'login';

  private usernameDraft = '';
  private passwordDraft = '';
  private confirmDraft = '';
  private showPassword = false;
  private showConfirmPassword = false;

  private loadingMessage = 'Authenticating...';
  private errorBanner: string | null = null;
  private retryCloudLoadMode = false;
  private availabilityNotice: {text: string; ok: boolean} | null = null;
  private successSummary: {username: string; coins: number; isNew: boolean} | null = null;
  private openContext: AccountOpenContext | null = null;
  private destroyed = false;

  constructor(
    parent: HTMLElement,
    private readonly callbacks: AccountModalCallbacks,
  ) {
    this.backdrop = document.createElement('div');
    this.backdrop.className =
      'ui-interactive fixed inset-0 z-50 hidden items-center justify-center bg-[#040812]/86 p-3 sm:p-4';
    parent.appendChild(this.backdrop);
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop && this.openState && this.screen !== 'loading') {
        audioSystem.playButtonClick();
        this.close();
      }
    });
  }

  public isOpen(): boolean {
    return this.openState;
  }

  public open(
    initialMode: 'login' | 'signup' = 'login',
    context?: AccountOpenContext,
  ): void {
    this.openState = true;
    this.screen = initialMode;
    this.openContext = context ?? null;
    this.errorBanner = null;
    this.retryCloudLoadMode = false;
    this.availabilityNotice = null;
    this.successSummary = null;
    this.passwordDraft = '';
    this.confirmDraft = '';
    this.showPassword = false;
    this.showConfirmPassword = false;
    this.render();
    this.backdrop.style.display = 'flex';
  }

  public close(): void {
    if (!this.openState) return;
    this.openState = false;
    this.openContext = null;
    this.backdrop.style.display = 'none';
    this.backdrop.innerHTML = '';
    this.callbacks.onClose?.();
  }

  private render(): void {
    if (!this.openState || this.destroyed) return;

    if (this.screen === 'loading') {
      this.backdrop.innerHTML = `
        <div class="cc-panel rounded-2xl w-full max-w-md max-h-[92dvh] overflow-y-auto p-7 text-center text-slate-100">
          <div class="w-11 h-11 mx-auto mb-4 rounded-full border-2 border-sky-400 border-t-transparent animate-spin"></div>
          <h2 class="font-display text-lg font-bold text-white">CHAOS CITY Account</h2>
          <p class="text-xs text-sky-300 mt-1.5">${escapeAttr(this.loadingMessage)}</p>
        </div>
      `;
      return;
    }

    if (this.screen === 'success' && this.successSummary) {
      const {username, coins, isNew} = this.successSummary;
      this.backdrop.innerHTML = `
        <div class="cc-panel rounded-2xl w-full max-w-md max-h-[92dvh] overflow-y-auto p-6 text-slate-100">
          <div class="text-center border-b border-[#22355c] pb-4 mb-5">
            <div class="w-12 h-12 mx-auto mb-3 rounded-xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-300">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div class="text-xs font-semibold text-emerald-300 uppercase tracking-wider">
              ${isNew ? 'Account Created & Cloud Ready' : 'Cloud Save Loaded'}
            </div>
            <h2 class="font-display text-2xl font-bold text-white mt-1">Welcome, ${escapeAttr(username)}</h2>
            <p class="text-xs text-slate-300 mt-1">
              ${
                isNew
                  ? 'Your unique username is reserved and your cloud save is initialized.'
                  : 'Your character, inventory, outfits, and progress were restored from the cloud.'
              }
            </p>
          </div>

          <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3.5 mb-5 flex items-center justify-between text-xs">
            <span class="text-slate-400">Active Resident Balance</span>
            <span class="font-mono-tabular text-sm font-bold text-amber-300">${coins} Coins</span>
          </div>

          <div class="flex flex-col sm:flex-row gap-2.5">
            <button id="cc-acc-enter" type="button" class="cc-btn-primary flex-1 py-3 rounded-xl font-display font-bold text-sm min-h-[46px] cursor-pointer">
              ${escapeAttr(this.openContext?.ctaLabel ?? 'CONTINUE TO MENU')}
            </button>
            <button id="cc-acc-stay" type="button" class="cc-btn-secondary px-4 py-3 rounded-xl font-display font-semibold text-xs min-h-[46px] cursor-pointer">
              Main Menu
            </button>
          </div>
        </div>
      `;

      const continueFn = this.openContext?.onContinue;
      this.backdrop.querySelector('#cc-acc-enter')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        this.close();
        if (continueFn) {
          continueFn();
        } else {
          this.callbacks.onAuthenticatedAndEnterCity();
        }
      });
      this.backdrop.querySelector('#cc-acc-stay')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        this.close();
      });
      return;
    }

    const isSignup = this.screen === 'signup';

    this.backdrop.innerHTML = `
      <div class="cc-panel rounded-2xl w-full max-w-md max-h-[92dvh] overflow-y-auto p-5 sm:p-6 text-slate-100">
        <div class="flex items-start justify-between gap-3 border-b border-[#22355c] pb-3.5 mb-4">
          <div>
            <div class="text-[11px] font-semibold tracking-[0.18em] text-sky-300 uppercase">
              CHAOS CITY Cloud Account
            </div>
            <h2 class="font-display text-xl font-bold text-white mt-0.5">
              ${isSignup ? 'Create Resident Account' : 'Sign In to CHAOS CITY'}
            </h2>
          </div>
          <button id="cc-acc-close" type="button" class="cc-btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[40px] cursor-pointer">
            Close
          </button>
        </div>

        <div class="grid grid-cols-2 gap-1.5 bg-[#060b16] p-1 rounded-xl border border-[#22355c] mb-4">
          <button id="cc-tab-login" type="button" class="py-2 rounded-lg text-xs font-bold min-h-[38px] cursor-pointer ${
            !isSignup ? 'bg-sky-500 text-[#06101f]' : 'text-slate-300 hover:text-white'
          }">
            LOGIN
          </button>
          <button id="cc-tab-signup" type="button" class="py-2 rounded-lg text-xs font-bold min-h-[38px] cursor-pointer ${
            isSignup ? 'bg-sky-500 text-[#06101f]' : 'text-slate-300 hover:text-white'
          }">
            CREATE ACCOUNT
          </button>
        </div>

        ${
          this.errorBanner
            ? `<div class="mb-4 rounded-xl bg-rose-500/15 border border-rose-400/60 px-3.5 py-2.5 text-xs text-rose-100 space-y-2">
                <div>${escapeAttr(this.errorBanner)}</div>
                ${
                  this.retryCloudLoadMode
                    ? `<div class="flex flex-wrap gap-2 pt-1">
                        <button id="cc-acc-retry-load" type="button" class="cc-btn-primary px-3 py-1.5 rounded-lg text-[11px] font-bold min-h-[34px] cursor-pointer">
                          Retry Cloud Load
                        </button>
                        <button id="cc-acc-signout-err" type="button" class="cc-btn-secondary px-3 py-1.5 rounded-lg text-[11px] font-semibold min-h-[34px] cursor-pointer">
                          Log Out
                        </button>
                      </div>`
                    : ''
                }
              </div>`
            : ''
        }

        <form id="cc-acc-form" class="space-y-3.5" novalidate>
          <div>
            <div class="flex items-center justify-between mb-1">
              <label for="cc-acc-username" class="text-xs font-semibold text-slate-200">
                Username
              </label>
              ${
                isSignup
                  ? `<button id="cc-acc-check-btn" type="button" class="text-[11px] font-semibold text-sky-300 hover:text-sky-200 cursor-pointer">
                      Check Availability
                    </button>`
                  : ''
              }
            </div>
            <input
              id="cc-acc-username"
              type="text"
              autocomplete="username"
              maxlength="20"
              value="${escapeAttr(this.usernameDraft)}"
              placeholder="3–20 chars (letters, numbers, _)"
              class="w-full rounded-xl bg-[#060b16] border border-[#22355c] focus:border-sky-400 focus:outline-none px-3.5 py-2.5 text-sm text-white min-h-[44px]"
            />
            ${
              isSignup && this.availabilityNotice
                ? `<div class="text-[11px] mt-1 font-medium ${
                    this.availabilityNotice.ok ? 'text-emerald-300' : 'text-rose-300'
                  }">${escapeAttr(this.availabilityNotice.text)}</div>`
                : isSignup
                  ? `<div class="text-[11px] mt-1 text-slate-400">Usernames are unique (case-insensitive).</div>`
                  : ''
            }
          </div>

          <div>
            <label for="cc-acc-password" class="block text-xs font-semibold text-slate-200 mb-1">
              Password
            </label>
            <div class="relative flex items-center">
              <input
                id="cc-acc-password"
                type="${this.showPassword ? 'text' : 'password'}"
                autocomplete="${isSignup ? 'new-password' : 'current-password'}"
                maxlength="64"
                value="${escapeAttr(this.passwordDraft)}"
                placeholder="Minimum 6 characters"
                class="w-full rounded-xl bg-[#060b16] border border-[#22355c] focus:border-sky-400 focus:outline-none pl-3.5 pr-11 py-2.5 text-sm text-white min-h-[44px]"
              />
              <button
                id="cc-acc-toggle-pw"
                type="button"
                aria-label="${this.showPassword ? 'Hide password' : 'Show password'}"
                class="absolute right-1.5 px-2.5 py-2 text-slate-300 hover:text-white cursor-pointer"
              >
                ${this.showPassword ? EYE_OFF_SVG : EYE_OPEN_SVG}
              </button>
            </div>
          </div>

          ${
            isSignup
              ? `<div>
                  <label for="cc-acc-confirm" class="block text-xs font-semibold text-slate-200 mb-1">
                    Confirm Password
                  </label>
                  <div class="relative flex items-center">
                    <input
                      id="cc-acc-confirm"
                      type="${this.showConfirmPassword ? 'text' : 'password'}"
                      autocomplete="new-password"
                      maxlength="64"
                      value="${escapeAttr(this.confirmDraft)}"
                      placeholder="Re-enter your password"
                      class="w-full rounded-xl bg-[#060b16] border border-[#22355c] focus:border-sky-400 focus:outline-none pl-3.5 pr-11 py-2.5 text-sm text-white min-h-[44px]"
                    />
                    <button
                      id="cc-acc-toggle-cpw"
                      type="button"
                      aria-label="${this.showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}"
                      class="absolute right-1.5 px-2.5 py-2 text-slate-300 hover:text-white cursor-pointer"
                    >
                      ${this.showConfirmPassword ? EYE_OFF_SVG : EYE_OPEN_SVG}
                    </button>
                  </div>
                </div>`
              : ''
          }

          <button
            id="cc-acc-submit"
            type="submit"
            class="cc-btn-primary w-full py-3 rounded-xl font-display font-bold text-sm tracking-wide min-h-[48px] cursor-pointer mt-2"
          >
            ${isSignup ? 'CREATE ACCOUNT' : 'LOGIN'}
          </button>
        </form>

        <div class="mt-4 pt-3 border-t border-[#22355c] text-center text-xs text-slate-400">
          ${
            isSignup
              ? `Already have a resident account? <button id="cc-acc-switch" type="button" class="text-sky-300 font-semibold hover:underline cursor-pointer">Log In</button>`
              : `New to CHAOS CITY? <button id="cc-acc-switch" type="button" class="text-sky-300 font-semibold hover:underline cursor-pointer">Create Account</button>`
          }
        </div>
      </div>
    `;

    this.bindEvents(isSignup);
  }

  private bindEvents(isSignup: boolean): void {
    const usernameInput = this.backdrop.querySelector<HTMLInputElement>('#cc-acc-username');
    const passwordInput = this.backdrop.querySelector<HTMLInputElement>('#cc-acc-password');
    const confirmInput = this.backdrop.querySelector<HTMLInputElement>('#cc-acc-confirm');

    usernameInput?.addEventListener('input', () => {
      this.usernameDraft = usernameInput.value;
      this.availabilityNotice = null;
    });
    passwordInput?.addEventListener('input', () => {
      this.passwordDraft = passwordInput.value;
    });
    confirmInput?.addEventListener('input', () => {
      this.confirmDraft = confirmInput.value;
    });

    this.backdrop.querySelector('#cc-acc-close')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.close();
    });

    this.backdrop.querySelector('#cc-tab-login')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.screen = 'login';
      this.errorBanner = null;
      this.retryCloudLoadMode = false;
      this.availabilityNotice = null;
      this.render();
    });

    this.backdrop.querySelector('#cc-tab-signup')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.screen = 'signup';
      this.errorBanner = null;
      this.retryCloudLoadMode = false;
      this.availabilityNotice = null;
      this.render();
    });

    this.backdrop.querySelector('#cc-acc-switch')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.screen = isSignup ? 'login' : 'signup';
      this.errorBanner = null;
      this.retryCloudLoadMode = false;
      this.availabilityNotice = null;
      this.render();
    });

    this.backdrop.querySelector('#cc-acc-toggle-pw')?.addEventListener('click', () => {
      this.showPassword = !this.showPassword;
      this.render();
    });

    this.backdrop.querySelector('#cc-acc-toggle-cpw')?.addEventListener('click', () => {
      this.showConfirmPassword = !this.showConfirmPassword;
      this.render();
    });

    this.backdrop.querySelector('#cc-acc-check-btn')?.addEventListener('click', async () => {
      audioSystem.playButtonClick();
      try {
        const res = await authSystem.checkUsernameAvailability(this.usernameDraft);
        if (this.destroyed || !this.openState) return;
        if (res.available) {
          this.availabilityNotice = {
            text: `"${this.usernameDraft.trim()}" is available!`,
            ok: true,
          };
        } else {
          this.availabilityNotice = {
            text: res.error ?? 'Username is unavailable.',
            ok: false,
          };
        }
      } catch (err) {
        if (this.destroyed || !this.openState) return;
        this.availabilityNotice = {
          text: err instanceof Error ? err.message : 'Unable to check username.',
          ok: false,
        };
      }
      this.render();
    });

    this.backdrop.querySelector('#cc-acc-retry-load')?.addEventListener('click', async () => {
      if (this.screen === 'loading') return;
      audioSystem.playButtonClick();
      this.screen = 'loading';
      this.loadingMessage = 'Retrying cloud save download...';
      this.render();
      try {
        const res = await authSystem.retryCloudLoadForCurrentUser();
        if (this.destroyed || !this.openState) return;
        this.handleAuthResult(res, false);
      } catch (err) {
        if (this.destroyed || !this.openState) return;
        this.handleAuthResult(
          {
            ok: false,
            message: err instanceof Error ? err.message : 'Retry failed.',
            authSucceededButLoadFailed: true,
          },
          false,
        );
      }
    });

    this.backdrop.querySelector('#cc-acc-signout-err')?.addEventListener('click', async () => {
      audioSystem.playButtonClick();
      try {
        await authSystem.logout();
      } catch (err) {
        console.error('[CHAOS CITY Account] Sign-out error:', err);
      }
      if (this.destroyed || !this.openState) return;
      this.errorBanner = null;
      this.retryCloudLoadMode = false;
      this.callbacks.onAuthChanged();
      this.render();
    });

    this.backdrop.querySelector('#cc-acc-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (this.screen === 'loading') return;
      audioSystem.playButtonClick();

      const uVal = validateUsernameInput(this.usernameDraft);
      if (!uVal.valid) {
        audioSystem.playError();
        this.errorBanner = uVal.error ?? 'Invalid username.';
        this.render();
        return;
      }

      const pVal = validatePasswordInput(
        this.passwordDraft,
        isSignup ? this.confirmDraft : undefined,
      );
      if (!pVal.valid) {
        audioSystem.playError();
        this.errorBanner = pVal.error ?? 'Invalid password.';
        this.render();
        return;
      }

      this.errorBanner = null;
      this.retryCloudLoadMode = false;
      this.screen = 'loading';
      this.loadingMessage = isSignup
        ? 'Reserving unique username & creating cloud save...'
        : 'Authenticating & restoring your cloud save...';
      this.render();

      try {
        const result = isSignup
          ? await authSystem.registerWithUsername(
              this.usernameDraft,
              this.passwordDraft,
              this.confirmDraft,
            )
          : await authSystem.loginWithUsername(this.usernameDraft, this.passwordDraft);

        if (this.destroyed || !this.openState) return;
        this.handleAuthResult(result, isSignup);
      } catch (err) {
        if (this.destroyed || !this.openState) return;
        this.handleAuthResult(
          {
            ok: false,
            message: err instanceof Error ? err.message : 'Authentication request failed.',
          },
          isSignup,
        );
      }
    });
  }

  private handleAuthResult(result: AuthActionResult, isSignup: boolean): void {
    if (this.destroyed || !this.openState) return;
    if (!result.ok || !result.user) {
      audioSystem.playError();
      this.screen = isSignup ? 'signup' : 'login';
      this.errorBanner = result.message ?? 'Authentication failed.';
      this.retryCloudLoadMode = Boolean(result.authSucceededButLoadFailed);
      this.callbacks.onAuthChanged();
      this.render();
      return;
    }

    audioSystem.playInteract();
    this.callbacks.onAuthChanged();
    this.successSummary = {
      username: result.user.username,
      coins: saveSystem.getState().coins,
      isNew: isSignup,
    };
    this.screen = 'success';
    this.render();
  }

  public destroy(): void {
    this.destroyed = true;
    this.openState = false;
    this.backdrop.remove();
  }
}

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Focus } from './electric';
import { log } from '../lib/logger';

/**
 * Focus mode — a calmer student UI for anyone who loses the thread on the
 * default one.
 *
 * The default screens are deliberately loud: a moving field backdrop, a mascot
 * that reacts, confetti, XP flying to a counter, streak meters, a shop, a
 * league. That works for a student who needs pulling in. For a student who is
 * already struggling to stay on task it is competing noise, so this mode
 * strips the screen back to the question and the one next action.
 *
 * Two halves, and both are needed:
 *   - `data-focus="on"` on <html>, which lets index.css kill every decorative
 *     CSS animation and glow at once (the safety net for anything not gated
 *     below).
 *   - `useFocusMode()` in the pages, which stops the expensive/animated pieces
 *     from *mounting* at all. CSS cannot stop a canvas RAF loop, a GSAP tween
 *     or a confetti burst — those are JS, and on a school phone they are the
 *     part that actually costs battery.
 *
 * The preference is a device setting (localStorage, same shape as the theme
 * and the sfx mute), not a student field: there is no auth yet, and a student
 * who needs it needs it on the phone in front of them.
 */

const STORAGE_KEY = 'faraday_focus_mode';

interface FocusModeContextType {
  focus: boolean;
  toggleFocus: () => void;
}

const FocusModeContext = createContext<FocusModeContextType>({ focus: false, toggleFocus: () => {} });

export const useFocusMode = () => useContext(FocusModeContext);

export const FocusModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [focus, setFocus] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'on';
    } catch {
      return false; // storage disabled (private mode) — default to the full UI
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, focus ? 'on' : 'off');
    } catch { /* storage disabled — the mode still applies for this session */ }
    // Attribute, not a class: index.css keys off [data-focus="on"] the same way
    // it keys off [data-theme], and the two have to be able to coexist.
    if (focus) document.documentElement.setAttribute('data-focus', 'on');
    else document.documentElement.removeAttribute('data-focus');
  }, [focus]);

  const toggleFocus = () => {
    setFocus(prev => {
      log.theme('focus mode toggled', { from: prev, to: !prev });
      return !prev;
    });
  };

  return (
    <FocusModeContext.Provider value={{ focus, toggleFocus }}>
      {children}
    </FocusModeContext.Provider>
  );
};

/**
 * FocusToggle — drop-in header button, same shape as ThemeToggle. Lives next
 * to it on every screen the mode changes, so a student who turned it on can
 * find their way out of it without hunting through a settings page.
 */
export const FocusToggle: React.FC<{ className?: string; size?: number }> = ({ className, size = 17 }) => {
  const { focus, toggleFocus } = useFocusMode();
  const label = focus ? 'כיבוי מצב מיקוד' : 'מצב מיקוד — מסך שקט בלי הסחות';
  return (
    <button
      type="button"
      onClick={toggleFocus}
      aria-pressed={focus}
      className={className ?? `btn-icon ${focus ? 'text-primary border-primary' : ''}`}
      title={label}
      aria-label={label}
    >
      <Focus size={size} glow={focus ? 0.5 : 0} />
    </button>
  );
};

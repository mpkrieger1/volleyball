// Sprint 31 Task 31.1: pre-set rotation editor.
//
// Opens before set 1 starts and again before each subsequent set. User
// configures the on-court 6 (P1..P6 dropdowns), system, libero, and
// tactical hint. Save is disabled until validation passes.

import { useEffect, useMemo, useRef, useState } from 'react';
import { sim, type liveMatchIpc } from '@vcd/shared';

type Slot = 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6';
type System = '5-1' | '6-2';
type Hint = 'aggressive' | 'balanced' | 'defensive';

const SLOTS: readonly Slot[] = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];

type RosterEntry = {
  playerId: string;
  firstName: string;
  lastName: string;
  position: string;
  jersey: number;
  isLibero: boolean;
};

export type RotationEditorModalProps = {
  open: boolean;
  /** Roster (on-court + bench) for the user team. */
  roster: RosterEntry[];
  /** Suggested default starters by slot label (from pickStartersForTeam). */
  suggestedSlots?: Record<Slot, string>;
  /** Default system + hint to seed the form. */
  defaults?: { system?: System; hint?: Hint; setterSlot?: Slot };
  setIndex: number;
  onConfirm: (req: liveMatchIpc.LiveSetRotationRequest) => void;
  onCancel: () => void;
};

export function RotationEditorModal({
  open,
  roster,
  suggestedSlots,
  defaults,
  setIndex,
  onConfirm,
  onCancel,
}: RotationEditorModalProps) {
  const [slots, setSlots] = useState<Record<Slot, string>>(() => suggestedSlots ?? {
    P1: '', P2: '', P3: '', P4: '', P5: '', P6: '',
  });
  const [system, setSystem] = useState<System>(defaults?.system ?? '5-1');
  const [hint, setHint] = useState<Hint>(defaults?.hint ?? 'balanced');
  const [setterSlot, setSetterSlot] = useState<Slot>(defaults?.setterSlot ?? 'P1');
  const [setterA, setSetterA] = useState<Slot>('P1');
  const [setterB, setSetterB] = useState<Slot>('P4');
  const [liberoId, setLiberoId] = useState<string>('');
  const dialogRef = useRef<HTMLDivElement>(null);

  // Reset when re-opened with new defaults.
  useEffect(() => {
    if (!open) return;
    if (suggestedSlots) setSlots(suggestedSlots);
    if (defaults?.system) setSystem(defaults.system);
    if (defaults?.hint) setHint(defaults.hint);
    if (defaults?.setterSlot) setSetterSlot(defaults.setterSlot);
    // Default libero to first roster player marked isLibero, if any
    const liberoRoster = roster.find((r) => r.isLibero);
    if (liberoRoster) setLiberoId(liberoRoster.playerId);
  }, [open, suggestedSlots, defaults, roster]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    }
    window.addEventListener('keydown', onKey);
    dialogRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  // Validation runs against the shared validator.
  const validation = useMemo<sim.ValidateResult>(() => {
    if (!open) return { ok: true };
    // Lazy import to keep this file lean — we only need the helper at submit.
    return validateLocal({ slots, system, libero: liberoId, setterSlot, setterA, setterB });
  }, [open, slots, system, liberoId, setterSlot, setterA, setterB]);

  if (!open) return null;

  const onSlotChange = (slot: Slot, playerId: string) => {
    setSlots((prev) => ({ ...prev, [slot]: playerId }));
  };

  const placedIds = new Set(SLOTS.map((s) => slots[s]).filter((id) => id !== ''));

  const liberoOptions = roster.filter((r) => r.isLibero || placedIds.has(r.playerId));

  const onSuggested = () => {
    if (suggestedSlots) setSlots(suggestedSlots);
  };

  const onSave = () => {
    if (!validation.ok) return;
    const req: liveMatchIpc.LiveSetRotationRequest = {
      slotId: '', // filled by caller
      matchId: '', // filled by caller
      slots,
      system,
      libero: liberoId,
      hint,
      ...(system === '5-1' ? { setterSlot } : { setterSlotsTwo: { a: setterA, b: setterB } }),
    };
    onConfirm(req);
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onCancel}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rotation-editor-heading"
        className="modal-card rotation-editor"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <h2 id="rotation-editor-heading">Rotation — Set {setIndex + 1}</h2>
        <p>Choose your starting 6, system, libero, and tactical hint.</p>

        {/* Court grid: P4-P3-P2 / P5-P6-P1
            Retro fix #7: highlight the opposite-setter slot so the user knows
            where the OPP needs to go. In 5-1: setterSlot's OPPOSITE_SLOT is
            the OPP cell. In 6-2: both setterSlotsTwo cells are setters; their
            opposite is "the OPP setter" — the OTHER one. We highlight the
            opposite of the FIRST setter slot picked. */}
        <div className="rotation-editor__grid" role="group" aria-label="Court positions">
          {(['P4','P3','P2','P5','P6','P1'] as const).map((slot) => {
            const isSetter = system === '5-1'
              ? slot === setterSlot
              : slot === setterA || slot === setterB;
            const oppositeOfSetter = system === '5-1'
              ? sim.OPPOSITE_SLOT[setterSlot] === slot
              : sim.OPPOSITE_SLOT[setterA] === slot;
            const cellClass = `rotation-editor__cell ${
              isSetter ? 'rotation-editor__cell--setter' : ''
            } ${oppositeOfSetter ? 'rotation-editor__cell--opposite' : ''}`.trim();
            return (
              <label key={slot} className={cellClass}>
                <span>
                  {slot}
                  {isSetter && <em className="rotation-editor__role"> setter</em>}
                  {oppositeOfSetter && <em className="rotation-editor__role"> ↔ OPP</em>}
                </span>
                <select
                  value={slots[slot]}
                  onChange={(e) => onSlotChange(slot, e.target.value)}
                  aria-label={`Player at ${slot}${isSetter ? ' (setter)' : ''}${oppositeOfSetter ? ' (opposite of setter)' : ''}`}
                >
                  <option value="">(empty)</option>
                  {roster.map((r) => (
                    <option
                      key={r.playerId}
                      value={r.playerId}
                      disabled={placedIds.has(r.playerId) && slots[slot] !== r.playerId}
                    >
                      #{r.jersey} {r.firstName} {r.lastName} ({r.position})
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>

        <fieldset>
          <legend>System</legend>
          <label>
            <input
              type="radio"
              name="system"
              value="5-1"
              checked={system === '5-1'}
              onChange={() => setSystem('5-1')}
            />
            5-1 (one setter)
          </label>
          <label>
            <input
              type="radio"
              name="system"
              value="6-2"
              checked={system === '6-2'}
              onChange={() => setSystem('6-2')}
            />
            6-2 (two setters)
          </label>
        </fieldset>

        {system === '5-1' && (
          <label className="rotation-editor__row">
            <span>Setter slot:</span>
            <select value={setterSlot} onChange={(e) => setSetterSlot(e.target.value as Slot)} aria-label="Setter slot">
              {SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        )}
        {system === '6-2' && (
          <div className="rotation-editor__row">
            <label>Setter A: <select value={setterA} onChange={(e) => setSetterA(e.target.value as Slot)} aria-label="Setter A slot">
              {SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select></label>
            <label>Setter B: <select value={setterB} onChange={(e) => setSetterB(e.target.value as Slot)} aria-label="Setter B slot">
              {SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select></label>
          </div>
        )}

        <label className="rotation-editor__row">
          <span>Libero:</span>
          <select value={liberoId} onChange={(e) => setLiberoId(e.target.value)} aria-label="Libero">
            <option value="">(select)</option>
            {liberoOptions.map((r) => (
              <option key={r.playerId} value={r.playerId}>
                #{r.jersey} {r.firstName} {r.lastName}{r.isLibero ? ' (L)' : ''}
              </option>
            ))}
          </select>
        </label>

        <fieldset>
          <legend>Tactical hint</legend>
          {(['aggressive','balanced','defensive'] as const).map((h) => (
            <label key={h}>
              <input
                type="radio"
                name="hint"
                value={h}
                checked={hint === h}
                onChange={() => setHint(h)}
              />
              <span style={{ textTransform: 'capitalize' }}>{h}</span>
            </label>
          ))}
        </fieldset>

        {!validation.ok && (
          <ul role="alert" className="rotation-editor__errors">
            {validation.errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        )}

        <div className="rotation-editor__actions">
          {suggestedSlots && (
            <button type="button" onClick={onSuggested}>Use suggested</button>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={!validation.ok}
            title={validation.ok ? 'Save rotation' : 'Fix validation errors first'}
          >
            Save rotation
          </button>
          <button type="button" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// Lightweight local validator wrapper around the shared sim helper.
function validateLocal(input: {
  slots: Record<Slot, string>;
  system: System;
  libero: string;
  setterSlot: Slot;
  setterA: Slot;
  setterB: Slot;
}): sim.ValidateResult {
  return sim.validateRotation({
    slots: input.slots,
    system: input.system,
    libero: input.libero,
    ...(input.system === '5-1'
      ? { setterSlot: input.setterSlot }
      : { setterSlotsTwo: { a: input.setterA, b: input.setterB } }),
  });
}

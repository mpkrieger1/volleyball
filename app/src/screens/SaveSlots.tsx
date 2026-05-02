import { useEffect, useState } from 'react';
import { useSaveSlotsStore } from '../store/useSaveSlotsStore';
import { useUserTeamStore } from '../store/useUserTeamStore';
import { TeamPickerModal } from './components/TeamPickerModal';

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

export function SaveSlots() {
  const { slots, status, error, load, create, remove, open } = useSaveSlotsStore();
  const setUserTeamAction = useUserTeamStore((s) => s.set);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  // Sprint 21: when set, renders the team picker for the just-created slot.
  const [pickingForSlotId, setPickingForSlotId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const newSlotId = await create(newName.trim());
    setNewName('');
    setCreating(false);
    if (newSlotId) setPickingForSlotId(newSlotId);
  };

  const onTeamPicked = async (teamId: string): Promise<void> => {
    if (!pickingForSlotId) return;
    await setUserTeamAction(pickingForSlotId, teamId);
    await open(pickingForSlotId);
    setPickingForSlotId(null);
  };

  return (
    <section aria-labelledby="save-slots-heading" className="save-slots">
      <header className="save-slots__header">
        <h1 id="save-slots-heading">Save slots</h1>
        <button type="button" onClick={() => setCreating((v) => !v)} aria-expanded={creating}>
          {creating ? 'Cancel' : 'New save'}
        </button>
      </header>

      {creating && (
        <form onSubmit={onCreate} className="save-slots__form" aria-label="Create new save slot">
          <label htmlFor="slot-name">Dynasty name</label>
          <input
            id="slot-name"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
            maxLength={40}
            required
          />
          <button type="submit">Create</button>
        </form>
      )}

      {error && (
        <p role="alert" className="save-slots__error">
          {error}
        </p>
      )}

      {status === 'loading' && <p>Loading saves…</p>}

      {status === 'ready' && slots.length === 0 && (
        <p className="save-slots__empty">No saves yet — create one to start your dynasty.</p>
      )}

      {slots.length > 0 && (
        <table className="save-slots__table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Dynasty year</th>
              <th scope="col">Created</th>
              <th scope="col">Last opened</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((slot) => (
              <tr key={slot.id}>
                <td>
                  <button
                    type="button"
                    className="save-slots__name-btn"
                    onClick={() => void open(slot.id)}
                  >
                    {slot.name}
                  </button>
                </td>
                <td>{slot.dynastyYear}</td>
                <td>{fmtDate(slot.createdAt)}</td>
                <td>{fmtDate(slot.lastOpenedAt)}</td>
                <td>
                  <button
                    type="button"
                    aria-label={`Delete save ${slot.name}`}
                    onClick={() => {
                      if (confirm(`Delete save "${slot.name}"? This cannot be undone.`)) {
                        void remove(slot.id);
                      }
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {pickingForSlotId && (
        <TeamPickerModal
          slotId={pickingForSlotId}
          onConfirm={onTeamPicked}
          onError={(msg) => console.error('Team picker error:', msg)}
        />
      )}
    </section>
  );
}

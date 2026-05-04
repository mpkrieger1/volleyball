// Sprint 28: Season parent screen.
//
// Hosts the four "look at the league" screens behind a sub-tab strip:
//   - Poll (AVCA Top 25)
//   - Bracket (postseason bracket)
//   - Standings (per-conference + RPI + stat leaders)
//   - Awards (AVCA All-Americans)
//
// Sub-tab is local component state; doesn't push to useNavStore so the
// outer "Season" highlight in the primary nav stays selected as the user
// flips between sub-tabs.

import { useState } from 'react';
import { PollView } from './PollView';
import { BracketView } from './BracketView';
import { StandingsView } from './StandingsView';
import { AwardsView } from './AwardsView';

type SeasonSubTab = 'poll' | 'bracket' | 'standings' | 'awards';

const SUB_TABS: Array<{ id: SeasonSubTab; label: string }> = [
  { id: 'standings', label: 'Standings' },
  { id: 'poll', label: 'Poll' },
  { id: 'bracket', label: 'Bracket' },
  { id: 'awards', label: 'Awards' },
];

export function SeasonView() {
  const [subTab, setSubTab] = useState<SeasonSubTab>('standings');

  return (
    <section aria-labelledby="season-heading" className="season-view">
      <header className="match-hub__header">
        <h1 id="season-heading">Season</h1>
        <p className="match-hub__sub">
          Standings, polls, the postseason bracket, and All-American awards.
        </p>
      </header>

      <nav
        className="recruiting-board__tabs"
        role="tablist"
        aria-label="Season sub-tabs"
      >
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={subTab === t.id}
            onClick={() => setSubTab(t.id)}
            className={
              subTab === t.id
                ? 'recruiting-board__tab recruiting-board__tab--active'
                : 'recruiting-board__tab'
            }
            data-testid={`season-sub-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div role="tabpanel" data-testid={`season-panel-${subTab}`}>
        {subTab === 'standings' && <StandingsView />}
        {subTab === 'poll' && <PollView />}
        {subTab === 'bracket' && <BracketView />}
        {subTab === 'awards' && <AwardsView />}
      </div>
    </section>
  );
}

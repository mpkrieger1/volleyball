export * from './playerGenerator';

/**
 * Sprint 28: NCAA Division-I women's volleyball roster cap. Teams may
 * carry at most this many active players at any time. Enforced at:
 *   - Recruit promotion (closeRecruitingCycle): commits beyond the cap
 *     are rolled to UNCOMMITTED rather than promoted.
 *   - Transfer-portal accept: rejects accept when the team is at cap.
 *   - Roster screen: shows count vs. cap.
 * The seed populates exactly this many players per team so fresh saves
 * land at the cap. Subsequent recruiting + portal activity must respect
 * graduation/cuts to make room.
 */
export const MAX_ROSTER_SIZE = 17;

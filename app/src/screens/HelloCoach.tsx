import { useAppStore } from '../store/useAppStore';

export function HelloCoach() {
  const userName = useAppStore((s) => s.userName);
  return (
    <section aria-labelledby="hello-coach-heading" className="hello-coach">
      <h1 id="hello-coach-heading">Hello, {userName}</h1>
      <p>NCAA Volleyball Coach Dynasty — Sprint 1 scaffold.</p>
    </section>
  );
}

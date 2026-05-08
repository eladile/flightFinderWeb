import { useEffect, useState } from 'react';

export default function App() {
  const [health, setHealth] = useState<string>('loading...');

  useEffect(() => {
    fetch('/api/health')
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`status ${r.status}`))))
      .then(setHealth)
      .catch(() => setHealth('backend unreachable'));
  }, []);

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold">Lazy Hopper</h1>
      <p className="mt-4 text-sm text-gray-600">backend says: {health}</p>
    </main>
  );
}

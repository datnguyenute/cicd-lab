'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { apiFetch } from '@/lib/api';
import { authDisabled, firebaseAuth, signInWithGoogle, signOutUser } from '@/lib/firebase';

type Todo = { id: string; title: string; done: boolean };
type Health = { status: string; env: string; version: string };

const FE_ENV = process.env.NEXT_PUBLIC_APP_ENV ?? 'local';
const FE_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [title, setTitle] = useState('');
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState('');

  const signedIn = authDisabled || user !== null;
  const getToken = useCallback(async () => (user ? user.getIdToken() : undefined), [user]);

  const load = useCallback(async () => {
    try {
      setTodos(await apiFetch<Todo[]>('/todos', await getToken()));
    } catch (e) {
      setError(String(e));
    }
  }, [getToken]);

  useEffect(() => {
    apiFetch<Health>('/health').then(setHealth).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (authDisabled) return;
    return onAuthStateChanged(firebaseAuth(), setUser);
  }, []);

  useEffect(() => {
    if (signedIn) load();
  }, [signedIn, load]);

  async function addTodo(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await apiFetch('/todos', await getToken(), { method: 'POST', body: JSON.stringify({ title }) });
    setTitle('');
    load();
  }

  async function toggle(id: string) {
    await apiFetch(`/todos/${id}/toggle`, await getToken(), { method: 'PATCH' });
    load();
  }

  return (
    <main>
      <h1>CICD Todo</h1>
      <p style={{ fontSize: 12, color: '#666' }}>
        FE: {FE_ENV}@{FE_VERSION.slice(0, 7)} · BE: {health ? `${health.env}@${health.version.slice(0, 7)}` : '…'}
      </p>

      {!signedIn ? (
        <button onClick={() => signInWithGoogle().catch((e) => setError(String(e)))}>
          Đăng nhập bằng Google (Firebase)
        </button>
      ) : (
        <>
          <p>
            Xin chào {authDisabled ? 'dev@local (auth tắt)' : user?.email}{' '}
            {!authDisabled && <button onClick={() => signOutUser()}>Đăng xuất</button>}
          </p>
          <form onSubmit={addTodo} style={{ display: 'flex', gap: 8 }}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Việc cần làm…" style={{ flex: 1 }} />
            <button type="submit">Thêm</button>
          </form>
          <ul>
            {todos.map((t) => (
              <li key={t.id}>
                <label>
                  <input type="checkbox" checked={t.done} onChange={() => toggle(t.id)} />{' '}
                  <span style={{ textDecoration: t.done ? 'line-through' : 'none' }}>{t.title}</span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}

      {error && <p style={{ color: 'crimson' }}>{error}</p>}
    </main>
  );
}

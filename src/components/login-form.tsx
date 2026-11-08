"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { api } from "@/client/api-client";
import { loginRequestSchema } from "@/shared/api";

function logIn(form: FormData) {
  const parsed = loginRequestSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
  return api.login(parsed.data);
}

export function LoginForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: logIn,
    onSuccess: () => {
      queryClient.clear();
      router.replace("/");
      router.refresh();
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate(new FormData(event.currentTarget));
  }

  return (
    <main>
      <div className="card auth-card">
        <h1>ログイン</h1>
        {mutation.error && (
          <p role="alert" className="error">
            {mutation.error.message}
          </p>
        )}
        <form method="post" onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="loginId">ログインID</label>
            <input id="loginId" name="loginId" autoComplete="username" required />
          </div>
          <div className="field">
            <label htmlFor="password">パスワード</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <button type="submit" className="primary wide" disabled={mutation.isPending}>
            {mutation.isPending ? "ログイン中…" : "ログイン"}
          </button>
        </form>
        <p className="hint">アカウントは管理者が発行します。</p>
      </div>
    </main>
  );
}

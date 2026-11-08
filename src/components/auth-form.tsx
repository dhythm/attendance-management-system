"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { api } from "@/client/api-client";
import { loginRequestSchema, signupRequestSchema } from "@/shared/api";

const copy = {
  login: {
    title: "ログイン",
    submit: "ログイン",
    pending: "ログイン中…",
    switchText: "アカウントをお持ちでない方は",
    switchLink: { href: "/signup", label: "新規登録" },
  },
  signup: {
    title: "新規登録",
    submit: "登録する",
    pending: "登録中…",
    switchText: "既にアカウントをお持ちの方は",
    switchLink: { href: "/login", label: "ログイン" },
  },
} as const;

type Mode = keyof typeof copy;

function submitFor(mode: Mode, form: FormData) {
  const values = Object.fromEntries(form);
  if (mode === "login") {
    const parsed = loginRequestSchema.safeParse(values);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
    return api.login(parsed.data);
  }
  const parsed = signupRequestSchema.safeParse(values);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
  return api.signup(parsed.data);
}

export function AuthForm({ mode }: { mode: Mode }) {
  const text = copy[mode];
  const router = useRouter();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (data: FormData) => submitFor(mode, data),
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
        <h1>{text.title}</h1>
        {mutation.error && (
          <p role="alert" className="error">
            {mutation.error.message}
          </p>
        )}
        <form method="post" onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="loginId">ログインID</label>
            <input id="loginId" name="loginId" autoComplete="username" required />
            {mode === "signup" && <span className="hint">半角英数字と _ . - で3〜32文字</span>}
          </div>
          {mode === "signup" && (
            <div className="field">
              <label htmlFor="displayName">表示名</label>
              <input id="displayName" name="displayName" autoComplete="name" required />
            </div>
          )}
          <div className="field">
            <label htmlFor="password">パスワード</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />
            {mode === "signup" && <span className="hint">8文字以上</span>}
          </div>
          <button type="submit" className="primary wide" disabled={mutation.isPending}>
            {mutation.isPending ? text.pending : text.submit}
          </button>
        </form>
        <p className="hint">
          {text.switchText} <Link href={text.switchLink.href}>{text.switchLink.label}</Link>
        </p>
      </div>
    </main>
  );
}

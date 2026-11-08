"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CircleAlert, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { api } from "@/client/api-client";
import { loginRequestSchema } from "@/shared/api";
import { formatLongDate } from "@/shared/format";
import { BrandMark } from "./app-shell";
import { LiveClock } from "./dashboard";
import { useNow } from "./use-now";

function logIn(form: FormData) {
  const parsed = loginRequestSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
  return api.login(parsed.data);
}

export function LoginForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const now = useNow();
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
    <div className="auth">
      <section className="auth-showcase" aria-hidden="true">
        <span className="brand">
          <BrandMark />
          <span className="brand-name">
            <strong>Kintai</strong>
            <span>勤怠管理</span>
          </span>
        </span>
        <div>
          <p className="showcase-date">{now ? formatLongDate(now) : " "}</p>
          <p className="showcase-clock num">
            <LiveClock now={now} />
          </p>
        </div>
        <p className="showcase-copy">
          <strong>はたらいた時間を、まっすぐ記録する。</strong>
          ワンタップの打刻と、ひと目でわかる月次の勤怠。チームの「いま」もすぐに見渡せます。
        </p>
      </section>
      <main className="auth-panel">
        <form method="post" onSubmit={onSubmit} noValidate className="auth-form">
          <div>
            <h1>ログイン</h1>
          </div>
          <p className="page-sub">ログインIDとパスワードを入力してください。</p>
          {mutation.error && (
            <p role="alert" className="alert">
              <CircleAlert size={16} />
              {mutation.error.message}
            </p>
          )}
          <div className="field">
            <label htmlFor="loginId">ログインID</label>
            <input id="loginId" name="loginId" className="input" autoComplete="username" required />
          </div>
          <div className="field">
            <label htmlFor="password">パスワード</label>
            <input
              id="password"
              name="password"
              type="password"
              className="input"
              autoComplete="current-password"
              required
            />
          </div>
          <button type="submit" className="button primary block" disabled={mutation.isPending}>
            {mutation.isPending ? "ログイン中…" : "ログイン"}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
          <p className="auth-footnote">
            <ShieldCheck size={14} />
            アカウントは管理者が発行します。
          </p>
        </form>
      </main>
    </div>
  );
}

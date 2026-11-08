"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock3, LayoutDashboard, LogOut, type LucideIcon, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { api } from "@/client/api-client";
import { type Capability, can, type Role } from "@/domain/role";
import { Avatar, RoleBadge } from "./identity";

const navigation: readonly {
  href: string;
  label: string;
  capability: Capability;
  icon: LucideIcon;
}[] = [
  { href: "/", label: "打刻", capability: "clock", icon: Clock3 },
  { href: "/manager", label: "勤怠一覧", capability: "viewAllAttendance", icon: LayoutDashboard },
  { href: "/admin/users", label: "ユーザー管理", capability: "manageUsers", icon: Users },
];

function isCurrent(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function BrandMark() {
  return (
    <span className="brand-mark">
      <Clock3 size={18} strokeWidth={2.5} />
    </span>
  );
}

export function AppShell({
  user,
  children,
}: {
  user: { id: string; displayName: string; loginId: string; role: Role };
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      queryClient.clear();
      router.replace("/login");
      router.refresh();
    },
  });

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <BrandMark />
          <span className="brand-name">
            <strong>Kintai</strong>
            <span>勤怠管理</span>
          </span>
        </Link>
        <nav className="nav" aria-label="メニュー">
          <span className="nav-label">MENU</span>
          {navigation
            .filter((item) => can(user.role, item.capability))
            .map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={isCurrent(pathname, href) ? "page" : undefined}
              >
                <Icon size={17} />
                {label}
              </Link>
            ))}
        </nav>
        <div className="sidebar-footer">
          <div className="me">
            <Avatar name={user.displayName} seed={user.id} />
            <div className="me-text">
              <span className="me-name">{user.displayName}</span>
              <RoleBadge role={user.role} />
            </div>
          </div>
          <button
            type="button"
            className="button ghost small"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            <LogOut size={15} />
            ログアウト
          </button>
        </div>
      </aside>
      <main className="content">
        <div className="content-inner">
          {logout.error && (
            <p role="alert" className="alert">
              {logout.error.message}
            </p>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}

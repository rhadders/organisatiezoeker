import { requireUser } from "@/lib/auth";

import { AppHeader } from "@/components/shared/app-header";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { user } = await requireUser();

  return (
    <>
      <AppHeader email={user.email ?? ""} />
      <main className="mx-auto w-full max-w-[1320px] flex-1 px-6 py-7">{children}</main>
    </>
  );
}

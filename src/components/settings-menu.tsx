import { useState } from "react";
import { Settings } from "lucide-react";
import { authEnabled, signOut } from "@/lib/auth/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SettingsMenu() {
  const user = useCurrentUser();
  const [signingOut, setSigningOut] = useState(false);
  if (!user || !authEnabled) return null;
  const label = user.displayName ?? user.primaryEmail ?? "Account";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Settings">
          <Settings className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <div className="flex items-center gap-2.5 px-3 py-2">
          {user.profileImageUrl ? (
            <img
              src={user.profileImageUrl}
              alt=""
              className="size-8 rounded-full object-cover"
            />
          ) : (
            <span className="grid size-8 place-items-center rounded-full bg-fg/8 text-sm font-medium">
              {label.charAt(0).toUpperCase()}
            </span>
          )}
          <p className="min-w-0 truncate text-sm">{label}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          danger
          disabled={signingOut}
          onSelect={() => {
            setSigningOut(true);
            void signOut().catch(() => setSigningOut(false));
          }}
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

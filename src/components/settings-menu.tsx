import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import { authClient, authEnabled, signOut } from "@/lib/auth/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { updateMyName } from "@/lib/server/household";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SettingsMenu() {
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const [name, setName] = useState("");
  if (!user || !authEnabled) return null;
  const label = user.displayName ?? user.primaryEmail ?? "Account";

  const saveName = useMutation({
    mutationFn: () => updateMyName({ data: { name: name.trim() } }),
    onSuccess: async (result) => {
      await authClient.getSession();
      await queryClient.invalidateQueries({ queryKey: ["overview"] });
      toast.success("Name updated");
      setNameOpen(false);
      setName(result.name);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Settings">
            <Settings className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuItem
            className="h-auto items-center gap-2.5 py-2"
            onSelect={() => {
              setName(user.displayName ?? "");
              setNameOpen(true);
            }}
          >
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
            <span className="min-w-0 flex-1">
              <span className="block truncate">{label}</span>
              <span className="block text-xs text-muted">Edit name</span>
            </span>
          </DropdownMenuItem>
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

      <NameDialog
        open={nameOpen}
        name={name}
        onNameChange={setName}
        onOpenChange={setNameOpen}
        busy={saveName.isPending}
        onSave={() => saveName.mutate()}
      />
    </>
  );
}

function NameDialog({
  open,
  name,
  onNameChange,
  onOpenChange,
  busy,
  onSave,
}: {
  open: boolean;
  name: string;
  onNameChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your name</DialogTitle>
          <DialogDescription>This is how you show up in the household.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) onSave();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="display-name">Name</Label>
            <Input
              id="display-name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              autoComplete="name"
              autoCapitalize="words"
              maxLength={80}
              placeholder="First and last name"
            />
          </div>
          <Button type="submit" disabled={busy || name.trim().length === 0}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

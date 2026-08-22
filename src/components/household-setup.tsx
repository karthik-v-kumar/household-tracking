import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createHousehold, joinHousehold } from "@/lib/server/household";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_NAME } from "@/lib/constants";

export function HouseholdSetup() {
  const queryClient = useQueryClient();
  const [createName, setCreateName] = useState("");
  const [code, setCode] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: (name: string) => createHousehold({ data: { name } }),
    onSuccess: async () => {
      toast.success("Household ready");
      await queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: (err: Error) => setCreateError(err.message),
  });

  const join = useMutation({
    mutationFn: (value: string) => joinHousehold({ data: { code: value } }),
    onSuccess: async () => {
      toast.success("You're in");
      await queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: (err: Error) => setJoinError(err.message),
  });

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-6 py-12">
      <p className="wordmark w-fit">{APP_NAME}</p>
      <h1 className="mt-10 font-display text-5xl leading-[0.95] tracking-tight">
        Set up your household
      </h1>
      <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
        Lists, usuals, and pantry levels are shared. Create a household, then send the invite code
        to your other half.
      </p>

      <form
        className="panel mt-8 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          setCreateError(null);
          create.mutate(createName.trim() || "Our kitchen");
        }}
      >
        <h2 className="font-display text-2xl">Create one</h2>
        <p className="mt-1 text-sm text-muted">You'll get a short code to share.</p>
        <div className="mt-4 grid gap-1.5">
          <Label htmlFor="household-name">Household name</Label>
          <Input
            id="household-name"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="Our kitchen"
          />
        </div>
        {createError ? <p className="mt-2 text-sm text-danger">{createError}</p> : null}
        <Button type="submit" className="mt-4 w-full" disabled={create.isPending}>
          {create.isPending ? "Creating…" : "Create household"}
        </Button>
      </form>

      <form
        className="panel mt-4 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          setJoinError(null);
          join.mutate(code);
        }}
      >
        <h2 className="font-display text-2xl">Join one</h2>
        <p className="mt-1 text-sm text-muted">Paste the code from someone already signed in.</p>
        <div className="mt-4 grid gap-1.5">
          <Label htmlFor="invite-code">Invite code</Label>
          <Input
            id="invite-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="K7M2-Q9XP"
            autoCapitalize="characters"
            className="tracking-[0.18em]"
          />
        </div>
        {joinError ? <p className="mt-2 text-sm text-danger">{joinError}</p> : null}
        <Button
          type="submit"
          variant="secondary"
          className="mt-4 w-full"
          disabled={join.isPending || code.trim().length < 4}
        >
          {join.isPending ? "Joining…" : "Join household"}
        </Button>
      </form>
    </div>
  );
}

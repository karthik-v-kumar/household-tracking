import { createFileRoute } from "@tanstack/react-router";
import { handleAgentRequest } from "@/lib/server/agent-handler";

async function handle({ request }: { request: Request }) {
  return handleAgentRequest(request);
}

export const Route = createFileRoute("/api/agent/$")({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
      PATCH: handle,
      DELETE: handle,
      OPTIONS: handle,
    },
  },
});

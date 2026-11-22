import { addIntegration, replayIntegration } from "@sentry/react";

export function addReplay() {
  addIntegration(replayIntegration());
}

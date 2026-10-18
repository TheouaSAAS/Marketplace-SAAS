"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RetryButton() {
  return (
    <Button onClick={() => window.location.reload()} icon={<RefreshCw aria-hidden className="h-4 w-4" />}>
      Réessayer
    </Button>
  );
}

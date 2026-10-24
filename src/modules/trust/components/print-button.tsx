"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button type="button" onClick={() => window.print()} icon={<Printer aria-hidden className="h-4 w-4" />} className="print:hidden">
      Imprimer ou enregistrer en PDF
    </Button>
  );
}

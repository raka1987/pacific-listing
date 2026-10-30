"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-secondary px-4 py-2 text-xs print:hidden">
      <Printer className="h-4 w-4" /> Print receipt
    </button>
  );
}

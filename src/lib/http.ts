import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export function handleRouteError(e: unknown) {
  if (e instanceof ZodError) return jsonError(400, "Invalid input", e.issues);
  console.error(e);
  const message = e instanceof Error ? e.message : "Unexpected error";
  return jsonError(502, message);
}

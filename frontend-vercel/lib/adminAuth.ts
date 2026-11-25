import { NextRequest } from "next/server";

export function isAdminAuthorized(request: NextRequest): boolean {
  const expectedPin = process.env.ADMIN_PIN;
  const sentPin = request.headers.get("x-admin-pin");
  return Boolean(expectedPin && sentPin && sentPin === expectedPin);
}
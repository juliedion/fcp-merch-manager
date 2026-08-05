import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, expectedSessionToken, isValidPassword } from "@/lib/mavely-auth";

export async function POST(req: Request) {
  const expected = await expectedSessionToken();
  if (!expected) {
    return NextResponse.json({ error: "APP_PASSWORD is not configured on the server." }, { status: 503 });
  }

  let password = "";
  try {
    const body = await req.json();
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!(await isValidPassword(password))) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, expected, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
  return response;
}

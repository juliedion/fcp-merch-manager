import { NextResponse } from "next/server";
import { z } from "zod";
import { generateProduct } from "@/lib/generator";

const schema = z.object({
  url: z.string().default(""), name: z.string().min(2), cost: z.coerce.number().min(0), price: z.coerce.number().positive(),
  category: z.string().default("Home & Lifestyle"), audience: z.string().default("busy families"), problem: z.string().default(""),
  features: z.string().default(""), shippingDays: z.coerce.number().min(0).default(7),
  competition: z.enum(["low", "medium", "high"]).default("medium"), demoFactor: z.coerce.number().min(1).max(10).default(7)
});

export async function POST(req: Request) {
  try {
    const input = schema.parse(await req.json());
    return NextResponse.json(generateProduct(input));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid product data" }, { status: 400 });
  }
}

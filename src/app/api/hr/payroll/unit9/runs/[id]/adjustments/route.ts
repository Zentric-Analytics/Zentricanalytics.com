import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedHrUser } from "@/lib/hr/auth/session";
import { createUnit9ManualAdjustment } from "@/lib/hr/payroll/unit9-service";

const input=z.object({employeeId:z.string().cuid(),category:z.string().trim().min(2).max(80),amount:z.string().regex(/^-?\d+(\.\d{1,4})?$/),reason:z.string().trim().min(3).max(500),evidence:z.record(z.string(),z.unknown())});
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){const auth=await getAuthenticatedHrUser();if(!auth)return NextResponse.json({error:"Unauthorized"},{status:401});if(!auth.permissions.has("payroll.calculate"))return NextResponse.json({error:"Forbidden"},{status:403});const parsed=input.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"Invalid governed adjustment."},{status:400});try{const {id}=await params;return NextResponse.json(await createUnit9ManualAdjustment(prisma,{organizationId:auth.user.organizationId,userId:auth.user.id,role:auth.roles.join(",")},id,{...parsed.data,evidence:parsed.data.evidence as Prisma.InputJsonValue}));}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Adjustment creation failed."},{status:422});}}

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedHrUser } from "@/lib/hr/auth/session";
import { createUnit9RemittanceBatch } from "@/lib/hr/payroll/unit9-financial-service";

const input=z.object({jurisdictionVersionId:z.string().cuid(),periodKey:z.string().trim().min(3).max(40),category:z.string().trim().min(2).max(80)});
export async function POST(request:Request){const auth=await getAuthenticatedHrUser();if(!auth)return NextResponse.json({error:"Unauthorized"},{status:401});if(!auth.permissions.has("payroll.statutory.prepare"))return NextResponse.json({error:"Forbidden"},{status:403});const parsed=input.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"Invalid remittance scope."},{status:400});try{return NextResponse.json(await createUnit9RemittanceBatch(prisma,{organizationId:auth.user.organizationId,userId:auth.user.id,role:auth.roles.join(",")},parsed.data));}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Remittance preparation failed."},{status:422});}}

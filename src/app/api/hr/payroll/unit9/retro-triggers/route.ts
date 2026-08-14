import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedHrUser } from "@/lib/hr/auth/session";
import { createUnit9RetroTrigger } from "@/lib/hr/payroll/unit9-service";

const input=z.object({sourceType:z.enum(["UNIT4","UNIT5","UNIT6","UNIT8","PAYROLL"]),sourceId:z.string().trim().min(1).max(200),sourceVersion:z.string().trim().min(1).max(200),previousVersion:z.string().trim().min(1).max(200).optional(),affectedFrom:z.coerce.date(),affectedTo:z.coerce.date().optional()});
export async function POST(request:Request){const auth=await getAuthenticatedHrUser();if(!auth)return NextResponse.json({error:"Unauthorized"},{status:401});if(!auth.permissions.has("payroll.calculate"))return NextResponse.json({error:"Forbidden"},{status:403});const parsed=input.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"Invalid retro trigger."},{status:400});try{return NextResponse.json(await createUnit9RetroTrigger(prisma,{organizationId:auth.user.organizationId,userId:auth.user.id,role:auth.roles.join(",")},parsed.data));}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Retro trigger failed."},{status:422});}}

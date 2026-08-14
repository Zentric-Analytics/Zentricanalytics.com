import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedHrUser } from "@/lib/hr/auth/session";
import { approveUnit9ManualAdjustment } from "@/lib/hr/payroll/unit9-service";

const input=z.object({reason:z.string().trim().min(3).max(500)});
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){const auth=await getAuthenticatedHrUser();if(!auth)return NextResponse.json({error:"Unauthorized"},{status:401});if(!auth.permissions.has("payroll.approve"))return NextResponse.json({error:"Forbidden"},{status:403});const parsed=input.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"Invalid adjustment decision."},{status:400});try{const {id}=await params;return NextResponse.json(await approveUnit9ManualAdjustment(prisma,{organizationId:auth.user.organizationId,userId:auth.user.id,role:auth.roles.join(",")},id,parsed.data.reason));}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Adjustment approval failed."},{status:422});}}

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { listPublicFixtures } from "@/modules/phase3/service";
export async function GET(request:NextRequest){const slug=request.nextUrl.searchParams.get("organization");if(!slug)return NextResponse.json({error:"organization wajib diisi."},{status:400});const organization=await db.organization.findFirst({where:{slug,status:"ACTIVE",deletedAt:null},select:{id:true}});if(!organization)return NextResponse.json({error:"Organisasi tidak ditemukan."},{status:404});return NextResponse.json({data:await listPublicFixtures(organization.id)});}

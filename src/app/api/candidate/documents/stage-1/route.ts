import { NextResponse } from 'next/server';

export async function GET() {
  return new NextResponse('Document download is currently unavailable.', {
    status: 404,
    headers: { 'Cache-Control': 'no-store' },
  });
}

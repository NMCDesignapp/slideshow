import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  // The API key is read from env or from the request header
  const key = req.headers.get('x-cloudconvert-key') || process.env.CLOUDCONVERT_API_KEY || ''
  return NextResponse.json({ hasKey: !!key })
}

import { NextRequest, NextResponse } from "next/server";

// === IN-MEMORY STATE STORE ===
// Shared state for cross-device sync between control and output pages
let latestState: any = null
const clients: Set<ReadableStreamDefaultController> = new Set()

// GET: Server-Sent Events stream (output page subscribes here)
export async function GET(req: NextRequest) {
  // Check if this is an SSE request
  const accept = req.headers.get('accept') || ''
  if (accept.includes('text/event-stream') || req.nextUrl.searchParams.get('stream') === 'true') {
    const stream = new ReadableStream({
      start(controller) {
        // Send initial state if available
        if (latestState) {
          const data = `data: ${JSON.stringify(latestState)}\n\n`
          controller.enqueue(new TextEncoder().encode(data))
        }

        // Register this client
        clients.add(controller)

        // Send heartbeat every 15 seconds to keep connection alive
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(new TextEncoder().encode(': heartbeat\n\n'))
          } catch {
            clearInterval(heartbeat)
            clients.delete(controller)
          }
        }, 15000)

        // Clean up on close
        req.signal.addEventListener('abort', () => {
          clearInterval(heartbeat)
          clients.delete(controller)
        })
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Accel-Buffering': 'no',
      },
    })
  }

  // Regular GET: just return current state
  return NextResponse.json(latestState || { type: 'empty' })
}

// POST: Control page pushes state updates here
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    latestState = {
      ...body,
      timestamp: Date.now(),
    }

    // Broadcast to all connected SSE clients
    const data = `data: ${JSON.stringify(latestState)}\n\n`
    const encoded = new TextEncoder().encode(data)

    const deadClients: ReadableStreamDefaultController[] = []

    clients.forEach((client) => {
      try {
        client.enqueue(encoded)
      } catch {
        deadClients.push(client)
      }
    })

    // Clean up dead clients
    deadClients.forEach((client) => clients.delete(client))

    return NextResponse.json({ ok: true, clients: clients.size })
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}

// OPTIONS: CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

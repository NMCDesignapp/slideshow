/**
 * BroadcastChannel-based sync for ShowFlow
 * More reliable than postMessage for dual-screen projection.
 * Works even when the output window is opened manually (not via popup).
 */

const CHANNEL_NAME = 'showflow-sync'

// Singleton BroadcastChannel instance for the control window
let controlChannel: BroadcastChannel | null = null

export function getControlChannel(): BroadcastChannel {
  if (!controlChannel) {
    controlChannel = new BroadcastChannel(CHANNEL_NAME)
  }
  return controlChannel
}

export function closeControlChannel() {
  if (controlChannel) {
    controlChannel.close()
    controlChannel = null
  }
}

// Send presentation update to output window(s) via BroadcastChannel
export function broadcastUpdate(payload: any) {
  try {
    const channel = getControlChannel()
    channel.postMessage({
      type: 'PRESENTATION_UPDATE',
      payload,
    })
  } catch (err) {
    console.warn('BroadcastChannel send failed:', err)
  }
}

// Send video control to output window(s)
export function broadcastVideoControl(action: 'VIDEO_PAUSE' | 'VIDEO_PLAY') {
  try {
    const channel = getControlChannel()
    channel.postMessage({ type: action })
  } catch (err) {
    console.warn('BroadcastChannel send failed:', err)
  }
}

// Request fullscreen on output window
export function broadcastRequestFullscreen() {
  try {
    const channel = getControlChannel()
    channel.postMessage({ type: 'REQUEST_FULLSCREEN' })
  } catch (err) {
    console.warn('BroadcastChannel send failed:', err)
  }
}

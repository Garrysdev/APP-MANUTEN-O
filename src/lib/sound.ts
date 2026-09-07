/**
 * Sintetizador Web Audio API para reproduzir som de notificação sonoro e nítido
 * em dispositivos móveis e desktop, sem depender de ficheiros externos ou codecs.
 */
export function playNotificationSound() {
  if (typeof window === 'undefined') return
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return

    const ctx = new AudioContextClass()

    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime)

      gain.gain.setValueAtTime(0.25, ctx.currentTime + startTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(ctx.currentTime + startTime)
      osc.stop(ctx.currentTime + startTime + duration)
    }

    // Melodia de 2 tons clássica de notificação industrial
    playTone(784, 0, 0.15)
    playTone(1046.5, 0.12, 0.28)

    // Vibração háptica no smartphone
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([300, 100, 300])
    }
  } catch (err) {
    console.warn('[Sound] Notification sound error/blocked:', err)
  }
}

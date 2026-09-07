declare let self: ServiceWorkerGlobalScope

// Escuta pelo evento 'push' que o nosso servidor envia
self.addEventListener('push', function (event) {
  if (event.data) {
    let data: any = {}
    try {
      data = event.data.json()
    } catch {
      data = { message: event.data.text() }
    }
    const title = data.title || 'RG Maintenance'
    const options: any = {
      body: data.message || data.body || 'Nova notificação de manutenção.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [300, 100, 300, 100, 300],
      tag: data.tag || 'rg-notif-' + Date.now(),
      renotify: true,
      requireInteraction: true,
      silent: false,
      data: data.url || data.link || '/dashboard',
    }
    event.waitUntil(self.registration.showNotification(title, options))
  }
})

// Escuta pelo clique na notificação
self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const urlToOpen = event.notification.data || '/'
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((windowClients) => {
      // Se a app já estiver aberta, foca nela e navega
      for (const client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus()
        }
      }
      // Se estiver fechada, abre uma nova janela
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen)
      }
    })
  )
})

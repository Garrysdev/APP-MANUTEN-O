declare let self: ServiceWorkerGlobalScope

// Escuta pelo evento 'push' que o nosso servidor envia
self.addEventListener('push', function (event) {
  if (event.data) {
    const data = event.data.json()
    const title = data.title || 'RG Maintenance'
    const options = {
      body: data.message,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      vibrate: [200, 100, 200],
      data: data.url || '/',
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

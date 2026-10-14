// Service worker: بيستقبل إشعارات الحلقات الجديدة
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = {body: e.data ? e.data.text() : ''}; }
  e.waitUntil(self.registration.showNotification(d.title || 'Elkomy VIP', {
    body: d.body || '',
    tag: d.tag || undefined,
    data: {url: d.url || ''},
    dir: 'rtl',
    lang: 'ar'
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = self.registration.scope + ((e.notification.data && e.notification.data.url) || '');
  e.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(list => {
    for (const c of list) {
      if ('focus' in c) {
        return (c.navigate ? c.navigate(url) : Promise.resolve()).then(w => (w || c).focus());
      }
    }
    return self.clients.openWindow(url);
  }));
});

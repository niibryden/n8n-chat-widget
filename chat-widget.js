// BusyAccess Chat Widget (clean JS — no inline CSS)
(function () {
  // 0) Hardening
  var ALLOWED_ORIGINS = [
    'https://busyaccess.com',
    'https://www.busyaccess.com',
    'http://localhost:8080', 'http://127.0.0.1:8080' // dev; remove later if you want
  ];
  if (ALLOWED_ORIGINS.indexOf(location.origin) === -1) {
    console.warn('[BusyAccess widget] blocked on origin:', location.origin);
    return;
  }
  if (window.N8NChatWidgetInitialized) return;
  window.N8NChatWidgetInitialized = true;

  // 1) Ensure CSS + font via <link>
  (function ensureAssets() {
    if (!document.querySelector('link[rel="stylesheet"][href*="chat-widget.css"]')) {
      var cssLink = document.createElement('link');
      cssLink.rel = 'stylesheet';
      cssLink.href = (window.ChatWidgetCssHref || './assets/chat-widget.css');
      document.head.appendChild(cssLink);
    }
    if (!document.querySelector('link[rel="stylesheet"][href*="geist-sans"]')) {
      var fontLink = document.createElement('link');
      fontLink.rel = 'stylesheet';
      fontLink.href = 'https://cdn.jsdelivr.net/npm/geist@1.0.0/dist/fonts/geist-sans/style.css';
      document.head.appendChild(fontLink);
    }
  })();

  // 2) Defaults
  var defaultConfig = {
    webhook: { url: 'https://n8n.srv964829.hstgr.cloud/webhook/f406671e-c954-4691-b39a-66c90aa2f103/chat', route: 'general' },
    branding: {
      logo: '/assets/logo-busyaccess.svg',
      name: 'BusyAccess',
      welcomeText: 'Hi — BusyAccess here. How can we help with access control?',
      responseTimeText: 'We typically respond right away',
      poweredBy: { text: 'BusyAccess', link: 'https://busyaccess.com' }
    },
    style: { primaryColor: '#0a5a9f', secondaryColor: '#083d68', position: 'right', backgroundColor: '#ffffff', fontColor: '#1b1b1b' }
  };
  var config = window.ChatWidgetConfig ? {
    webhook: Object.assign({}, defaultConfig.webhook, window.ChatWidgetConfig.webhook || {}),
    branding: Object.assign({}, defaultConfig.branding, window.ChatWidgetConfig.branding || {}),
    style: Object.assign({}, defaultConfig.style, window.ChatWidgetConfig.style || {})
  } : defaultConfig;

  // 3) DOM build
  var currentSessionId = '';
  var widgetContainer = document.createElement('div');
  widgetContainer.className = 'n8n-chat-widget';
  widgetContainer.style.setProperty('--n8n-chat-primary-color', config.style.primaryColor);
  widgetContainer.style.setProperty('--n8n-chat-secondary-color', config.style.secondaryColor);
  widgetContainer.style.setProperty('--n8n-chat-background-color', config.style.backgroundColor);
  widgetContainer.style.setProperty('--n8n-chat-font-color', config.style.fontColor);

  var chatContainer = document.createElement('div');
  chatContainer.className = 'chat-container' + (config.style.position === 'left' ? ' position-left' : '');

  var newConversationHTML =
    '<div class="brand-header">' +
      '<img src="' + config.branding.logo + '" alt="' + config.branding.name + '">' +
      '<span>' + config.branding.name + '</span>' +
      '<button class="close-button" aria-label="Close">×</button>' +
    '</div>' +
    '<div class="new-conversation">' +
      '<h2 class="welcome-text">' + config.branding.welcomeText + '</h2>' +
      '<button class="new-chat-btn">' +
        '<svg class="message-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
          '<path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z"/>' +
        '</svg>' +
        'Send us a message' +
      '</button>' +
      '<p class="response-text">' + config.branding.responseTimeText + '</p>' +
    '</div>';

  var chatInterfaceHTML =
    '<div class="chat-interface" role="region" aria-label="BusyAccess chat">' +
      '<div class="brand-header">' +
        '<img src="' + config.branding.logo + '" alt="' + config.branding.name + '">' +
        '<span>' + config.branding.name + '</span>' +
        '<button class="close-button" aria-label="Close">×</button>' +
      '</div>' +
      '<div class="chat-messages"></div>' +
      '<div class="chat-input">' +
        '<textarea placeholder="Type your message here..." rows="1"></textarea>' +
        '<button type="submit">Send</button>' +
      '</div>' +
      '<div class="chat-footer">' +
        '<a href="' + config.branding.poweredBy.link + '" target="_blank" rel="noopener noreferrer">' + config.branding.poweredBy.text + '</a>' +
      '</div>' +
    '</div>';

  chatContainer.innerHTML = newConversationHTML + chatInterfaceHTML;

  var toggleButton = document.createElement('button');
  toggleButton.className = 'chat-toggle' + (config.style.position === 'left' ? ' position-left' : '');
  toggleButton.setAttribute('aria-expanded', 'false');
  toggleButton.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
      '<path d="M12 2C6.477 2 2 6.477 2 12c0 1.821.487 3.53 1.338 5L2.5 21.5l4.5-.838A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18c-1.476 0-2.886-.313-4.156-.878l-3.156.586.586-3.156A7.962 7.962 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z"/>' +
    '</svg>';

  var newChatBtn, chatInterface, messagesContainer, textarea, sendButton;

  // 4) Helpers
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){var r=Math.random()*16|0,v=c==='x'?r:(r&0x3|0x8);return v.toString(16);});
  }
  function postJSON(payload) {
    return fetch(config.webhook.url, {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
    }).then(function(res){ return res.text().then(function(t){ if(!res.ok) throw new Error('HTTP '+res.status+' '+res.statusText+' – '+t.slice(0,200)); try{return JSON.parse(t);}catch(_){return {output:t};} }); });
  }
  function out(resp){
    if (resp==null) return ''; if (Array.isArray(resp)) resp = resp[0]||{};
    if (typeof resp==='string') return resp;
    var k=['output','answer','message','text']; for (var i=0;i<k.length;i++){ if (resp&&resp[k[i]]) return String(resp[k[i]]); }
    return typeof resp==='object'? JSON.stringify(resp): String(resp);
  }
  function appendBot(text){ var d=document.createElement('div'); d.className='chat-message bot'; d.textContent=text; messages.appendChild(d); messages.scrollTop=messages.scrollHeight; }

  // 5) Actions
  function startNewConversation(){
    currentSessionId = uuid();
    var payload = { action:'loadPreviousSession', sessionId: currentSessionId, route: config.webhook.route, metadata:{userId:''} };
    postJSON(payload).then(function(resp){
      chatContainer.querySelector('.brand-header').style.display='none';
      chatContainer.querySelector('.new-conversation').style.display='none';
      chatInterface.classList.add('active');
      appendBot(out(resp));
    }).catch(function(e){
      console.error('Error starting conversation:', e);
      chatInterface.classList.add('active');
      appendBot('Sorry—couldn’t start the conversation. Try again in a moment.');
    });
  }
  function sendMessage(msg){
    if (!currentSessionId) currentSessionId = uuid();
    var payload = { action:'sendMessage', sessionId: currentSessionId, route: config.webhook.route, chatInput: msg, metadata:{userId:''} };
    var u=document.createElement('div'); u.className='chat-message user'; u.textContent=msg; messages.appendChild(u); messages.scrollTop=messages.scrollHeight;
    postJSON(payload).then(function(r){ appendBot(out(r)); }).catch(function(e){ console.error('Error sending message:', e); appendBot('Hmm, that didn’t go through. Check your connection and try again.'); });
  }

  // 6) Wiring + mount
  var messages;
  function mount(){
    widgetContainer.appendChild(chatContainer);
    widgetContainer.appendChild(toggleButton);
    document.body.appendChild(widgetContainer);

    newChatBtn = chatContainer.querySelector('.new-chat-btn');
    chatInterface = chatContainer.querySelector('.chat-interface');
    messages = chatContainer.querySelector('.chat-messages');
    textarea = chatContainer.querySelector('textarea');
    sendButton = chatContainer.querySelector('button[type="submit"]');

    newChatBtn.addEventListener('click', startNewConversation);
    sendButton.addEventListener('click', function(){ var m=(textarea.value||'').trim(); if(m){ sendMessage(m); textarea.value=''; }});
    textarea.addEventListener('keydown', function(e){ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); var m=(textarea.value||'').trim(); if(m){ sendMessage(m); textarea.value=''; } } });
    toggleButton.addEventListener('click', function(){ var open=chatContainer.classList.toggle('open'); toggleButton.setAttribute('aria-expanded', String(open)); });
    Array.prototype.forEach.call(chatContainer.querySelectorAll('.close-button'), function(btn){
      btn.addEventListener('click', function(){ chatContainer.classList.remove('open'); toggleButton.setAttribute('aria-expanded','false'); });
    });

    console.info('BusyAccess Chat Widget v1.0.0 (CSS externalized)');
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();

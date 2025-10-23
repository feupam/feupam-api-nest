# 🔧 CORREÇÃO DO LOOP INFINITO NO FRONT-END

## 🔴 Problema
Loop infinito de re-renderização no React causado por `useEffect` que atualiza estado continuamente no `CurrentEventContext.tsx`.

---

## ✅ SOLUÇÃO 1: CurrentEventContext.tsx

### ❌ CÓDIGO ERRADO (Causa loop infinito)

```typescript
// NÃO FAÇA ISSO!
useEffect(() => {
  setCurrentEvent(eventData); // Isso causa re-render
}, [eventData]); // Se eventData é um objeto novo toda vez, loop infinito!

useEffect(() => {
  console.log('[CurrentEventContext] currentEvent mudou:', currentEvent?.name);
}, [currentEvent]); // Dispara quando currentEvent muda -> Loop infinito!
```

### ✅ CÓDIGO CORRETO (Versão 1 - Com verificação)

```typescript
import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

export const CurrentEventContext = createContext(null);

export function CurrentEventProvider({ children }) {
  const [currentEvent, setCurrentEvent] = useState(null);

  // ✅ CORREÇÃO 1: Usar useCallback para setCurrentEvent com verificação
  const setEvent = useCallback((eventData) => {
    setCurrentEvent(prev => {
      // Só atualizar se realmente mudou
      if (!eventData) return null;
      if (prev?.uuid === eventData?.uuid && prev?.name === eventData?.name) {
        return prev; // Não atualizar se for o mesmo evento
      }
      console.log('[CurrentEventContext] Evento atualizado:', eventData.name);
      return eventData;
    });
  }, []);

  // ✅ CORREÇÃO 2: useEffect com verificação de mudança real
  useEffect(() => {
    // Carregar evento do localStorage apenas UMA VEZ
    const savedEvent = localStorage.getItem('selectedEvent');
    if (savedEvent && !currentEvent) {
      try {
        const event = JSON.parse(savedEvent);
        setEvent(event);
      } catch (error) {
        console.error('Erro ao carregar evento do localStorage:', error);
      }
    }
  }, []); // ⚠️ Array vazio = executa apenas na montagem

  // ✅ CORREÇÃO 3: Salvar no localStorage sem causar re-render
  useEffect(() => {
    if (currentEvent) {
      localStorage.setItem('selectedEvent', JSON.stringify(currentEvent));
    }
  }, [currentEvent?.uuid]); // ⚠️ Depender apenas do uuid, não do objeto inteiro

  // ✅ CORREÇÃO 4: Usar useMemo para o valor do contexto
  const value = useMemo(() => ({
    currentEvent,
    setCurrentEvent: setEvent,
  }), [currentEvent, setEvent]);

  return (
    <CurrentEventContext.Provider value={value}>
      {children}
    </CurrentEventContext.Provider>
  );
}

export function useCurrentEvent() {
  const context = useContext(CurrentEventContext);
  if (!context) {
    throw new Error('useCurrentEvent deve ser usado dentro de CurrentEventProvider');
  }
  return context;
}
```

---

## ✅ SOLUÇÃO 2: page.tsx (Reservation Page)

### ❌ CÓDIGO ERRADO

```typescript
// NÃO FAÇA ISSO!
useEffect(() => {
  const savedEvent = localStorage.getItem('selectedEvent');
  if (savedEvent) {
    const event = JSON.parse(savedEvent);
    setCurrentEvent(event); // Isso dispara re-render
  }
}, [currentEvent]); // ⚠️ Dependência causa loop!
```

### ✅ CÓDIGO CORRETO

```typescript
'use client';

import { useEffect, useMemo } from 'react';
import { useCurrentEvent } from '@/contexts/CurrentEventContext';
import { useParams } from 'next/navigation';

export default function ReservationPage() {
  const params = useParams();
  const { currentEvent, setCurrentEvent } = useCurrentEvent();

  // ✅ Decodificar parâmetros apenas uma vez
  const eventId = useMemo(() => {
    return decodeURIComponent(params.eventId as string);
  }, [params.eventId]);

  const ticketKind = useMemo(() => {
    return decodeURIComponent(params.ticketKind as string);
  }, [params.ticketKind]);

  // ✅ Carregar evento do localStorage apenas UMA VEZ
  useEffect(() => {
    console.log('[ReservationPage] Verificando localStorage...');
    
    // Só carregar se não tem evento no contexto
    if (!currentEvent) {
      const savedEvent = localStorage.getItem('selectedEvent');
      if (savedEvent) {
        try {
          const event = JSON.parse(savedEvent);
          console.log('[ReservationPage] Carregando evento do localStorage:', event.name);
          setCurrentEvent(event);
        } catch (error) {
          console.error('[ReservationPage] Erro ao parsear evento:', error);
        }
      }
    }
  }, []); // ⚠️ Array vazio = executa apenas na montagem

  // ✅ Log separado para debug (não causa re-render)
  useEffect(() => {
    if (currentEvent) {
      console.log('[ReservationPage] Evento atual:', currentEvent.name);
    }
  }, [currentEvent?.uuid]); // Depender apenas do uuid

  return (
    <div>
      {/* Seu componente de reserva */}
      {currentEvent && (
        <h1>Reserva para {currentEvent.name}</h1>
      )}
    </div>
  );
}
```

---

## ✅ SOLUÇÃO 3: Componente que Define o Evento

Se você tem um componente que define o evento (ex: ao clicar em "Reservar"), faça assim:

### ✅ CÓDIGO CORRETO

```typescript
'use client';

import { useCurrentEvent } from '@/contexts/CurrentEventContext';
import { useCallback } from 'react';

export default function EventCard({ event }) {
  const { setCurrentEvent } = useCurrentEvent();

  // ✅ Usar useCallback para evitar re-criação da função
  const handleReserve = useCallback(() => {
    // Criar objeto com apenas os dados necessários
    const eventData = {
      uuid: event.uuid || event.id,
      name: event.name,
      location: event.location,
      description: event.description,
      date: event.date,
      price: Number(event.price), // Garantir que é número
      eventStatus: event.eventStatus,
      savedAt: new Date().toISOString(),
    };

    // Salvar no contexto (que salvará no localStorage)
    setCurrentEvent(eventData);

    // Navegar para a página de reserva
    router.push(`/reservation/${encodeURIComponent(event.name)}/full`);
  }, [event.uuid, event.name, event.price, setCurrentEvent]);

  return (
    <button onClick={handleReserve}>
      Reservar Vaga
    </button>
  );
}
```

---

## 🎯 CHECKLIST DE CORREÇÕES

Aplique TODAS as correções abaixo no seu front-end:

### ✅ 1. CurrentEventContext.tsx
- [ ] Adicionar `useCallback` no `setCurrentEvent` com verificação de `prev`
- [ ] Remover `useEffect` que escuta `eventData` diretamente
- [ ] Usar `useEffect` com array vazio `[]` para carregar localStorage
- [ ] Adicionar `useMemo` para o valor do contexto
- [ ] Usar `currentEvent?.uuid` nas dependências, não `currentEvent`

### ✅ 2. page.tsx (Reservation)
- [ ] Usar `useEffect` com array vazio `[]` para carregar localStorage
- [ ] Adicionar verificação `if (!currentEvent)` antes de carregar
- [ ] Usar `useMemo` para `eventId` e `ticketKind`
- [ ] Logs separados com dependência apenas no `uuid`

### ✅ 3. Componentes que definem evento
- [ ] Usar `useCallback` nos handlers
- [ ] Criar objeto de evento com dados específicos (não passar referência)
- [ ] Converter `price` para número explicitamente

---

## 🔍 COMO TESTAR

Após aplicar as correções:

1. **Limpar o localStorage**:
   ```javascript
   localStorage.clear();
   ```

2. **Recarregar a página** (F5)

3. **Abrir DevTools Console** e verificar:
   - ✅ NÃO deve aparecer mensagens repetidas infinitamente
   - ✅ Deve aparecer apenas UMA mensagem de "Evento atualizado"
   - ✅ NÃO deve aparecer erro de "Maximum update depth exceeded"

4. **Clicar em "Continuar para pagamento"**:
   - ✅ Deve navegar normalmente
   - ✅ NÃO deve travar a página

---

## 🚨 DICA IMPORTANTE

Se ainda tiver problemas, adicione este código temporário para debug:

```typescript
// No CurrentEventContext.tsx, adicione:
useEffect(() => {
  console.log('🔍 [DEBUG] currentEvent mudou:', {
    uuid: currentEvent?.uuid,
    name: currentEvent?.name,
    stackTrace: new Error().stack, // Ver de onde veio a mudança
  });
}, [currentEvent]);
```

Isso vai te mostrar **de onde** está vindo a mudança que causa o loop.

---

## 📞 PRECISA DE AJUDA?

Se após aplicar todas as correções ainda tiver o erro, me mostre:
1. O código completo do `CurrentEventContext.tsx`
2. O código completo da `page.tsx` de reserva
3. Os logs do console

E eu te ajudo a identificar o problema específico! 🚀

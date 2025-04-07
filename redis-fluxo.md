📌 Lógica de Liberação de Ingressos
As 200 primeiras pessoas têm acesso direto à compra.

As demais são colocadas em uma fila de espera (Redis).

Quando uma das 200 libera a vaga (ex: não conclui pagamento em 10 minutos), liberamos 1 pessoas da fila para tentar novamente.


🧠 Exemplo prático:
João entra no sistema, está entre os 200 → pode comprar direto ✅

Maria entra, é a 201ª → entra na fila ❌

João não paga ou sai → sua chave é removida do Redis

O sistema precisa detectar que há uma vaga e liberar 1 pessoas
➡️ Isso acontece com a função agendada, tipo um cron job que roda a cada minuto e faz essa verificação.


## 🚦 Fluxo completo

### 1. 🧾 Buscar os dados do evento
**[GET]** `/events/:id`

Retorna informações do evento: tipo, limites de vaga, se é geral ou por gênero, datas de inscrição etc.

```bash
GET /events/feira2024
Authorization: Bearer <token>
2. 📥 Verificar se há vagas disponíveis
[POST] /events/:id/check-spot

Opcional, permite saber se ainda há vagas antes de tentar reservar.

POST /events/feira2024/check-spot
Authorization: Bearer <token>
3. 🎯 Tentar reservar uma vaga
[POST] /events/:id/reserve-spot

Se houver vaga, cria uma nova Spot e uma reservationHistory no Firestore.
Se não houver, o usuário entra automaticamente na waitingList.

Esse endpoint também cria uma chave no Redis com validade de 10 minutos para impedir múltiplas reservas.


POST /events/feira2024/reserve-spot
Authorization: Bearer <token>
Content-Type: application/json

{
  "ticket_kind": "inteira"
}

´´´
🔄 Resposta:

Se sucesso: retorna spotId, email, eventId

Se esgotado: 400 Bad Request com mensagem Você entrou para lista de espera

4. ⏳ Espera o usuário confirmar em até 10 minutos
Durante os próximos 10 minutos, o usuário precisa fazer o pagamento.
A reserva é válida apenas se a chave Redis existir.

5. 💳 Realizar o pagamento
[POST] /payments

Esse endpoint:

Valida se a reserva ainda está ativa (verifica Redis)

Cria o pagamento via Pagar.me

Se pago: salva o status no Firestore e libera o ingresso

Se falhar ou se expirou: retorna erro


POST /payments
POST /payments/webhook-pagarme
[GET] /events/:id/installments

GET /events/feira2024/installments
Authorization: Bearer <token>
📄 Ver todas as reservas de um evento:
[GET] /events/:id/reservations

GET /events/feira2024/reservations
Authorization: Bearer <token>
📋 Ver lista de espera do evento:
[GET] /events/:id/waiting-list

GET /events/feira2024/waiting-list
Authorization: Bearer <token>

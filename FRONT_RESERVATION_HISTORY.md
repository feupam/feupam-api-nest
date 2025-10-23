# 📋 Requisição Front-End - Reservation History

## 🔥 1. JavaScript/TypeScript com Fetch

```javascript
// Função para buscar todas as reservas
async function getAllReservationHistory(token, options = {}) {
  const { eventId, page = 1, limit = 50 } = options;
  
  // Construir query params
  const params = new URLSearchParams();
  if (eventId) params.append('eventId', eventId);
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  
  const url = `https://us-central1-feupam-api.cloudfunctions.net/api/admin/reservation-history?${params}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Erro: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Erro ao buscar reservationHistory:', error);
    throw error;
  }
}

// ✅ EXEMPLOS DE USO:

// Buscar todas as reservas (página 1, 50 itens)
const allReservations = await getAllReservationHistory(token);

// Buscar reservas de um evento específico
const eventReservations = await getAllReservationHistory(token, {
  eventId: 'evento123',
});

// Buscar com paginação customizada
const page2 = await getAllReservationHistory(token, {
  page: 2,
  limit: 100,
});

// Filtro + paginação
const filteredPage = await getAllReservationHistory(token, {
  eventId: 'evento123',
  page: 1,
  limit: 20,
});
```

---

## ⚛️ 2. React com Axios

```typescript
import axios from 'axios';
import { useState, useEffect } from 'react';

const API_BASE_URL = 'https://us-central1-feupam-api.cloudfunctions.net/api';

interface ReservationHistoryParams {
  eventId?: string;
  page?: number;
  limit?: number;
}

interface ReservationHistoryResponse {
  page: number;
  limit: number;
  totalCount: number;
  count: number;
  eventId: string;
  reservations: any[];
}

// Hook customizado
function useReservationHistory(token: string, params?: ReservationHistoryParams) {
  const [data, setData] = useState<ReservationHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReservations = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          `${API_BASE_URL}/admin/reservation-history`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            params: {
              eventId: params?.eventId,
              page: params?.page || 1,
              limit: params?.limit || 50,
            },
          }
        );
        setData(response.data);
        setError(null);
      } catch (err: any) {
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchReservations();
    }
  }, [token, params?.eventId, params?.page, params?.limit]);

  return { data, loading, error };
}

// ✅ Componente de exemplo
function ReservationHistoryTable() {
  const token = 'SEU_TOKEN_AQUI';
  const [page, setPage] = useState(1);
  const [eventId, setEventId] = useState<string>();
  
  const { data, loading, error } = useReservationHistory(token, {
    eventId,
    page,
    limit: 50,
  });

  if (loading) return <div>Carregando...</div>;
  if (error) return <div>Erro: {error}</div>;

  return (
    <div>
      <h1>Histórico de Reservas</h1>
      <p>Total: {data?.totalCount} | Página: {data?.page}</p>
      
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Nome</th>
            <th>Status</th>
            <th>Data</th>
          </tr>
        </thead>
        <tbody>
          {data?.reservations.map((reservation) => (
            <tr key={reservation.id}>
              <td>{reservation.email}</td>
              <td>{reservation.name}</td>
              <td>{reservation.status}</td>
              <td>{new Date(reservation.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <button onClick={() => setPage(page - 1)} disabled={page === 1}>
        Anterior
      </button>
      <button onClick={() => setPage(page + 1)}>
        Próxima
      </button>
    </div>
  );
}
```

---

## 📦 3. Axios Puro

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://us-central1-feupam-api.cloudfunctions.net/api',
});

// Adicionar token em todas as requisições
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token'); // ou de onde você guarda o token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ✅ Função para buscar reservation history
export async function getReservationHistory(params = {}) {
  try {
    const response = await api.get('/admin/reservation-history', {
      params: {
        eventId: params.eventId,
        page: params.page || 1,
        limit: params.limit || 50,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar reservas:', error);
    throw error;
  }
}

// ✅ EXEMPLOS DE USO:

// Todas as reservas
const all = await getReservationHistory();

// Filtrar por evento
const filtered = await getReservationHistory({ eventId: 'evento123' });

// Com paginação
const page2 = await getReservationHistory({ page: 2, limit: 100 });
```

---

## 🎯 4. Response Exemplo

```json
{
  "page": 1,
  "limit": 50,
  "totalCount": 235,
  "count": 50,
  "eventId": "all",
  "reservations": [
    {
      "id": "abc123",
      "email": "usuario@example.com",
      "name": "João Silva",
      "cpf": "12345678900",
      "eventId": "evento123",
      "status": "Pago",
      "price": 250.00,
      "ticketKind": "FULL",
      "userType": "client",
      "gender": "M",
      "spotId": "spot456",
      "createdAt": "2025-10-23T10:30:00.000Z",
      "updatedAt": "2025-10-23T10:30:00.000Z",
      "charges": [
        {
          "chargeId": "charge789",
          "amount": 250.00,
          "status": "Pago",
          "meio": "CREDIT_CARD"
        }
      ],
      "data_nasc": "1990-01-15",
      "idade": 35,
      "church": "Igreja Exemplo",
      "pastor": "Pastor João",
      "ddd": "35",
      "cellphone": "999999999",
      "cep": "37500000",
      "cidade": "Itajubá",
      "estado": "MG",
      "address": "Rua Exemplo, 123",
      "complemento": "Apto 101",
      "alergia": "Não",
      "medicamento": "Não",
      "info_add": "Nenhuma"
    }
  ]
}
```

---

## 🔐 Observações Importantes

1. **Autenticação**: Sempre enviar o token no header `Authorization: Bearer {token}`
2. **Paginação**: Use `page` e `limit` para controlar a paginação
3. **Filtro**: Use `eventId` para filtrar por evento específico
4. **Total**: O campo `totalCount` retorna o total de registros (antes da paginação)
5. **Count**: O campo `count` retorna quantos registros vieram nessa página

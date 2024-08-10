export enum SpotStatus {
  available = 'available',
  reserved = 'reserved',
  occupied = 'occupied',
}

export enum TicketStatus {
  reserved = 'reserved',
  pago = 'Pago',
  cancelled = 'cancelled',
}

export enum TicketKind {
  FULL = 'full',
  HALF = 'half',
}

export enum SpotType {
  USER = 'user_spot',
  STAFF = 'staff_spot',
}

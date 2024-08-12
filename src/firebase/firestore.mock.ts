export const mockPaymentDoc = {
  exists: true,
  data: jest.fn().mockReturnValue({
    paymentId: 'payment1',
    amount: 100,
    status: 'completed',
    userId: 'user1',
    eventId: 'event1',
  }),
};

export const mockPaymentHistoryDocs = [
  {
    id: 'paymentHistory1',
    data: jest.fn().mockReturnValue({
      paymentId: 'payment1',
      userId: 'user1',
      amount: 100,
    }),
  },
];

export const mockUserDoc = [
  {
    exists: true,
    data: jest.fn().mockReturnValue({
      userId: 'user1',
      email: 'user@example.com',
    }),
  },
];

export const mockFirestore = {
  collection: jest.fn().mockImplementation((collectionName: string) => {
    if (collectionName === 'payments') {
      return {
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue(mockPaymentDoc),
          set: jest.fn().mockResolvedValue(undefined), // Mock para `set()`
        }),
      };
    } else if (collectionName === 'paymentHistory') {
      return {
        where: jest
          .fn()
          .mockImplementation((field: string, operator: string, value: any) => {
            if (
              field === 'paymentId' &&
              operator === '==' &&
              value === 'payment1'
            ) {
              return {
                get: jest.fn().mockResolvedValue({
                  empty: mockPaymentHistoryDocs.length === 0,
                  docs: mockPaymentHistoryDocs,
                }),
              };
            }
            return {
              get: jest.fn().mockResolvedValue({
                empty: true,
                docs: [],
              }),
            };
          }),
      };
    } else if (collectionName === 'users') {
      return {
        where: jest.fn().mockImplementation(() => {
          return {
            get: jest.fn().mockResolvedValue({
              empty: mockUserDoc.length === 0,
              docs: mockUserDoc,
              forEach: (callback: (doc: any) => void) =>
                mockUserDoc.forEach(callback),
            }),
          };
        }),
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue(mockUserDoc),
        }),
      };
    } else if (collectionName === 'reservationHistory') {
      return {
        where: jest.fn().mockImplementation(() => {
          return {
            get: jest.fn().mockResolvedValue({
              empty: mockUserDoc.length === 0,
              docs: mockUserDoc,
              forEach: (callback: (doc: any) => void) =>
                mockUserDoc.forEach(callback),
            }),
          };
        }),
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue(mockUserDoc),
        }),
      };
    }
    return {
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        empty: true,
        docs: [],
      }),
    };
  }),
  batch: jest.fn().mockReturnValue({
    commit: jest.fn().mockResolvedValue(undefined),
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  }),
};

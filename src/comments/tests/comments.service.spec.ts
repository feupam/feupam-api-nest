import { Test, TestingModule } from '@nestjs/testing';
import { CommentsService } from '../comments.service';
import { FirestoreService } from '../../firebase/firebase.service';
import { CreateCommentDto } from '../dto/create-comment.dto';
import { UpdateCommentDto } from '../dto/update-comment.dto';

// Mock do Firestore

const mockCommentsDoc = [
  { id: 'comment1', data: () => ({ content: 'Great post!' }) },
  { id: 'comment2', data: () => ({ content: 'Nice article!' }) },
];

const mockFirestoreCollection = {
  doc: jest.fn().mockReturnThis(),
  where: jest.fn().mockImplementation(() => {
    return {
      get: jest.fn().mockResolvedValue({
        empty: mockCommentsDoc.length === 0,
        docs: mockCommentsDoc,
        forEach: (callback: (doc: any) => void) =>
          mockCommentsDoc.forEach(callback),
      }),
    };
  }),
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

// Mock do Firestore
const mockFirestore = {
  collection: jest.fn().mockReturnValue(mockFirestoreCollection),
};

// Mock do FirestoreService
const mockFirestoreService = {
  firestore: mockFirestore,
  getFirestore: jest.fn().mockReturnValue(mockFirestore),
};

describe('CommentsService', () => {
  let service: CommentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        {
          provide: FirestoreService,
          useValue: mockFirestoreService,
        },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
  });

  it('should create a comment successfully', async () => {
    const dto: CreateCommentDto = {
      comment: 'Great post!',
      emailUser: 'user123',
      hide: false,
    };

    const mockDoc = jest.fn().mockReturnValue({
      set: jest.fn().mockResolvedValue(undefined),
    });

    jest.spyOn(mockFirestore, 'collection').mockReturnValueOnce({
      doc: mockDoc,
    } as any);

    const result = await service.create(dto, '');
    expect(result).toEqual({ id: undefined, ...dto });
  });

  it('should find all comments', async () => {
    // Mock do método 'get' para retornar um conjunto de documentos simulados
    mockFirestoreCollection.get.mockResolvedValueOnce({
      docs: [
        { id: 'comment1', data: () => ({ content: 'Great post!' }) },
        { id: 'comment2', data: () => ({ content: 'Nice article!' }) },
      ],
    } as any);

    const result = await service.findAll();

    expect(result).toEqual([
      { id: 'comment1', content: 'Great post!' },
      { id: 'comment2', content: 'Nice article!' },
    ]);
    expect(mockFirestore.collection).toHaveBeenCalledWith('comments');
    expect(mockFirestoreCollection.get).toHaveBeenCalled();
  });

  it('should find one comment by id', async () => {
    const commentRef = {
      get: jest.fn().mockResolvedValueOnce({
        exists: true,
        data: () => ({ content: 'Great post!' }),
      }),
    };

    mockFirestoreCollection.doc.mockReturnValueOnce(commentRef as any);

    const result = await service.findOne('commentId');

    expect(result).toEqual({ id: undefined, content: 'Great post!' });
  });

  it('should update a comment successfully', async () => {
    const dto: UpdateCommentDto = {
      comment: 'Updated comment',
      hide: false,
    };
    const commentRef = {
      update: jest.fn().mockResolvedValueOnce(undefined),
    };

    mockFirestoreCollection.doc.mockReturnValueOnce(commentRef as any);

    const result = await service.update('commentId', dto);

    expect(result).toEqual({ id: 'commentId', ...dto });
    expect(commentRef.update).toHaveBeenCalledWith(
      expect.objectContaining({
        ...dto,
        updatedAt: expect.any(String),
      }),
    );
  });

  it('should remove a comment successfully', async () => {
    const commentRef = {
      delete: jest.fn().mockResolvedValueOnce(undefined),
    };

    mockFirestoreCollection.doc.mockReturnValueOnce(commentRef as any);

    const result = await service.remove('commentId');

    expect(result).toEqual({ id: 'commentId' });
    expect(commentRef.delete).toHaveBeenCalled();
  });
});

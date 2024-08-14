import { Test, TestingModule } from '@nestjs/testing';
import { CommentsController } from '../comments.controller';
import { CommentsService } from '../comments.service';
import { CreateCommentDto } from '../dto/create-comment.dto';
import { UpdateCommentDto } from '../dto/update-comment.dto';

describe('CommentsController', () => {
  let controller: CommentsController;
  let service: CommentsService;

  const mockCommentsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommentsController],
      providers: [
        {
          provide: CommentsService,
          useValue: mockCommentsService,
        },
      ],
    }).compile();

    controller = module.get<CommentsController>(CommentsController);
    service = module.get<CommentsService>(CommentsService);
  });

  it('should create a comment successfully', async () => {
    const dto: CreateCommentDto = {
      comment: 'Great post!',
      emailUser: 'user123',
      hide: false,
    };

    mockCommentsService.create.mockResolvedValueOnce({
      id: 'newCommentId',
      ...dto,
    });

    const result = await controller.create(dto);
    expect(result).toEqual({ id: 'newCommentId', ...dto });
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('should find all comments', async () => {
    const comments = [
      { id: 'comment1', content: 'Great post!' },
      { id: 'comment2', content: 'Nice article!' },
    ];

    mockCommentsService.findAll.mockResolvedValueOnce(comments);

    const result = await controller.findAll();
    expect(result).toEqual(comments);
    expect(service.findAll).toHaveBeenCalled();
  });

  it('should find one comment by id', async () => {
    const comment = { id: 'comment1', content: 'Great post!' };

    mockCommentsService.findOne.mockResolvedValueOnce(comment);

    const result = await controller.findOne('comment1');
    expect(result).toEqual(comment);
    expect(service.findOne).toHaveBeenCalledWith('comment1');
  });

  it('should update a comment successfully', async () => {
    const mockRequest = {
      headers: {
        authorization: 'Bearer mockToken', // Mocka o header de autenticação
      },
    };
    const dto: UpdateCommentDto = {
      comment: 'Updated comment',
      hide: false,
    };
    const updatedComment = { id: 'comment1', ...dto };

    mockCommentsService.update.mockResolvedValueOnce(updatedComment);

    const result = await controller.update(
      'comment1',
      dto,
      mockRequest.headers.authorization,
    );
    expect(result).toEqual(updatedComment);
    expect(service.update).toHaveBeenCalledWith('comment1', dto);
  });

  it('should remove a comment successfully', async () => {
    mockCommentsService.remove.mockResolvedValueOnce({ id: 'comment1' });

    const result = await controller.remove('comment1');
    expect(result).toEqual({ id: 'comment1' });
    expect(service.remove).toHaveBeenCalledWith('comment1');
  });
});

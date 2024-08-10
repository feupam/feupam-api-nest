import { Injectable, NotFoundException } from '@nestjs/common';
import { FirestoreService } from '../firebase/firebase.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Injectable()
export class CommentsService {
  constructor(private firestoreService: FirestoreService) {}

  async create(createCommentsDto: CreateCommentDto) {
    const commentsRef = this.firestoreService.firestore
      .collection('comments')
      .doc();
    await commentsRef.set({
      ...createCommentsDto,
      createdAt: new Date().toISOString(),
    });

    return { id: commentsRef.id, ...createCommentsDto };
  }

  async findAll() {
    const commentsRef = this.firestoreService.firestore.collection('comments');
    const snapshot = commentsRef.get();
    return (await snapshot).docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async findOne(id: string) {
    const commentsRef = this.firestoreService.firestore
      .collection('comments')
      .doc(id);
    const doc = await commentsRef.get();
    if (!doc.exists) {
      throw new NotFoundException('Comments not found');
    }
    return { id: doc.id, ...doc.data() };
  }

  async update(id: string, updateCommentsDto: UpdateCommentDto) {
    try {
      const commentsRef = this.firestoreService.firestore
        .collection('comments')
        .doc(id);
      await commentsRef.update({
        ...updateCommentsDto,
        updatedAt: new Date().toISOString(),
      });
      return { id, ...updateCommentsDto };
    } catch (err) {
      throw Error(`Unknown error: ${err}`);
    }
  }

  async remove(id: string) {
    const commentsRef = this.firestoreService.firestore
      .collection('comments')
      .doc(id);
    await commentsRef.delete();
    return { id };
  }
}

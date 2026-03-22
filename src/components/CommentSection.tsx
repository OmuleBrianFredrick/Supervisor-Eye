import React, { useState, useEffect } from 'react';
import { Send, User, Clock } from 'lucide-react';
import { Comment, UserProfile } from '../types';
import { addComment, subscribeToComments } from '../services/firebaseService';
import { formatDistanceToNow } from 'date-fns';

interface CommentSectionProps {
  parentId: string;
  user: UserProfile;
}

export default function CommentSection({ parentId, user }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const unsub = subscribeToComments(parentId, (data) => setComments(data));
    return () => unsub();
  }, [parentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || sending) return;

    setSending(true);
    try {
      await addComment(parentId, user.uid, user.displayName, newComment.trim());
      setNewComment('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 mt-8 pt-8 border-t border-slate-100">
      <h3 className="font-bold text-slate-900 flex items-center gap-2">
        Discussion
        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">
          {comments.length}
        </span>
      </h3>

      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {comments.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No comments yet. Start the conversation.</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-slate-500" />
              </div>
              <div className="flex-1">
                <div className="bg-slate-50 p-3 rounded-2xl rounded-tl-none">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-900">{comment.authorName}</span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{comment.text}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="relative">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write a comment..."
          className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 outline-none transition-all text-sm"
        />
        <button
          type="submit"
          disabled={!newComment.trim() || sending}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all disabled:opacity-50"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}

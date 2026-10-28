export type Side = 'pro' | 'kontra';
export type Category = 'Politik' | 'Ekonomi' | 'Sosial' | 'Lingkungan' | 'Hukum';
export type Topic = {
  id: string;
  title: string;
  description: string;
  category: Category;
  illustration: string;
  featured: boolean;
  active: boolean;
  created_at: string;
};
export type Match = {
  id: string;
  topic_id: string;
  pro_user: string;
  kontra_user: string;
  status: 'active' | 'ended';
  created_at: string;
};
export type RoomMessage = {
  id: number;
  match_id: string;
  sender_id: string;
  kind: 'chat' | 'offer' | 'answer' | 'ice';
  payload: Record<string, unknown>;
  created_at: string;
};

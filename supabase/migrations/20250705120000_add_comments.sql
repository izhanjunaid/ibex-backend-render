-- Comments table for assignments and announcements
CREATE TABLE comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  parent_type TEXT NOT NULL CHECK (parent_type IN ('assignment','announcement')),
  parent_id UUID NOT NULL,
  author_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_comments_parent ON comments(parent_type, parent_id); 
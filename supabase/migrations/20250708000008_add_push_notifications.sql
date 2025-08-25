-- Add push notification support
-- Migration: 20250708000008_add_push_notifications.sql

-- Create FCM tokens table to store device tokens for push notifications
CREATE TABLE fcm_tokens (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    device_type VARCHAR(20) DEFAULT 'android', -- 'android', 'ios', 'web'
    device_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, token)
);

-- Create notification history table
CREATE TABLE notification_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    notification_type VARCHAR(50) NOT NULL, -- 'attendance', 'assignment', 'announcement', etc.
    status VARCHAR(20) DEFAULT 'sent', -- 'sent', 'delivered', 'failed'
    fcm_response JSONB,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX idx_fcm_tokens_user_id ON fcm_tokens(user_id);
CREATE INDEX idx_fcm_tokens_active ON fcm_tokens(is_active);
CREATE INDEX idx_notification_history_user_id ON notification_history(user_id);
CREATE INDEX idx_notification_history_type ON notification_history(notification_type);
CREATE INDEX idx_notification_history_sent_at ON notification_history(sent_at);

-- Add RLS policies for FCM tokens
ALTER TABLE fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only see their own FCM tokens
CREATE POLICY "Users can view own FCM tokens" ON fcm_tokens
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own FCM tokens
CREATE POLICY "Users can insert own FCM tokens" ON fcm_tokens
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own FCM tokens
CREATE POLICY "Users can update own FCM tokens" ON fcm_tokens
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own FCM tokens
CREATE POLICY "Users can delete own FCM tokens" ON fcm_tokens
    FOR DELETE USING (auth.uid() = user_id);

-- Add RLS policies for notification history
ALTER TABLE notification_history ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notification history
CREATE POLICY "Users can view own notification history" ON notification_history
    FOR SELECT USING (auth.uid() = user_id);

-- Only service role can insert notification history
CREATE POLICY "Service role can insert notification history" ON notification_history
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Function to get active FCM tokens for a user
CREATE OR REPLACE FUNCTION get_user_fcm_tokens(p_user_id UUID)
RETURNS TABLE (
    token TEXT,
    device_type VARCHAR(20),
    device_name VARCHAR(255)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ft.token,
        ft.device_type,
        ft.device_name
    FROM fcm_tokens ft
    WHERE ft.user_id = p_user_id 
        AND ft.is_active = true
    ORDER BY ft.last_used_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark FCM token as inactive
CREATE OR REPLACE FUNCTION deactivate_fcm_token(p_user_id UUID, p_token TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE fcm_tokens 
    SET is_active = false, updated_at = NOW()
    WHERE user_id = p_user_id AND token = p_token;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log notification
CREATE OR REPLACE FUNCTION log_notification(
    p_user_id UUID,
    p_title VARCHAR(255),
    p_body TEXT,
    p_notification_type VARCHAR(50),
    p_data JSONB DEFAULT '{}'::jsonb,
    p_fcm_response JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    INSERT INTO notification_history (
        user_id, title, body, data, notification_type, 
        status, fcm_response, sent_at
    ) VALUES (
        p_user_id, p_title, p_body, p_data, p_notification_type,
        CASE WHEN p_fcm_response->>'success' = 'true' THEN 'delivered' ELSE 'sent' END,
        p_fcm_response, NOW()
    ) RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

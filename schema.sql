-- ============================================================
-- FreeChat 核心数据库设计 (v1.6 循环引用修复版)
-- ============================================================

-- 1. 注册码系统：管理社区通行证
-- 注意：为了打破与 users 表的循环引用，我们移除了对 users(id) 的物理外键约束
CREATE TABLE IF NOT EXISTS registration_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,                   -- 唯一的邀请码
  note TEXT DEFAULT '',                        -- 备注（如：发给某个博主的）
  
  created_by TEXT,                             -- 谁生成的码 (逻辑关联 users.id)
  
  is_used INTEGER NOT NULL DEFAULT 0,          -- 0=未使用, 1=已使用
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  used_at INTEGER                              -- 使用时间戳
);

-- 2. 用户表：核心账号信息
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                       -- 用户自定义唯一ID
  username TEXT NOT NULL,                    -- 展示昵称
  password TEXT NOT NULL,                    -- 哈希密码
  salt TEXT NOT NULL,                        -- 密码盐值
  avatar_id TEXT DEFAULT '',                 -- 头像关联 fileId
  bio TEXT NOT NULL DEFAULT '',              -- 个人简介
  
  -- 邀请追踪：直接记录注册时使用的邀请码 ID。允许为 NULL（如初始管理员或开放注册期）
  invcode_id INTEGER DEFAULT NULL,                           
  
  is_disabled INTEGER NOT NULL DEFAULT 0,    -- 账号冻结状态
  createdAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updatedAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  deletedAt INTEGER,
  -- 保留此物理外键，因为 registration_codes 表已先于此表创建
  FOREIGN KEY (invcode_id) REFERENCES registration_codes(id)
);

-- 3. 频道/房间表
CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('room', 'pvt')), 
  description TEXT NOT NULL DEFAULT '',
  created_by TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  deletedAt INTEGER,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 4. 房间成员表
CREATE TABLE IF NOT EXISTS channel_members (
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  room_display_name TEXT,
  role INTEGER NOT NULL DEFAULT 1,           -- 1=成员, 2=管理员, 3=创建者
  kicked INTEGER NOT NULL DEFAULT 0,
  joined_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  PRIMARY KEY (channel_id, user_id),
  FOREIGN KEY (channel_id) REFERENCES channels(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 5. 统一文件表 (SHA-256 + Size 去重)
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  storage_key TEXT NOT NULL,
  
  -- 分类：0=chat(聊天附件), 1=avatar(用户头像), 2=post(朋友圈), 3=system(系统资源)
  category INTEGER NOT NULL DEFAULT 0 CHECK (category IN (0, 1, 2, 3)),
  
  -- 策略：0=永久保存, 1=可清理(30天过期附件)
  retention_policy INTEGER NOT NULL DEFAULT 1,
  
  file_hash TEXT,                            -- SHA-256
  uploaded_by TEXT NOT NULL,
  uploaded_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  deletedAt INTEGER,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- 6. 消息表
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  userId TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',          -- 文本或文件 JSON
  type TEXT NOT NULL DEFAULT 'text' 
    CHECK (type IN ('text', 'image', 'file', 'mixed', 'system', 'error')),
  status TEXT NOT NULL DEFAULT 'saved' 
    CHECK (status IN ('pending', 'saved', 'edited', 'revoked')),
  createAt INTEGER NOT NULL,
  editedAt INTEGER,
  FOREIGN KEY (userId) REFERENCES users(id)
);

-- 7. 用户关系表
CREATE TABLE IF NOT EXISTS user_relationships (
  owner_user_id TEXT NOT NULL,
  target_user_id TEXT NOT NULL,
  remark_name TEXT DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  is_blocked INTEGER NOT NULL DEFAULT 0,
  is_muted INTEGER NOT NULL DEFAULT 0,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  createdAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updatedAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  PRIMARY KEY (owner_user_id, target_user_id),
  FOREIGN KEY (owner_user_id) REFERENCES users(id),
  FOREIGN KEY (target_user_id) REFERENCES users(id)
);

-- 8. 用户设置
CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT NOT NULL,
  setting_key TEXT NOT NULL,
  setting_value TEXT NOT NULL DEFAULT '',
  updatedAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  PRIMARY KEY (user_id, setting_key),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 核心索引
CREATE INDEX IF NOT EXISTS idx_messages_query ON messages(channel_id, createAt DESC);
CREATE INDEX IF NOT EXISTS idx_files_dedup ON files(file_hash, size);
CREATE INDEX IF NOT EXISTS idx_files_category ON files(category);
CREATE INDEX IF NOT EXISTS idx_relationships_fast ON user_relationships(owner_user_id, target_user_id);
CREATE INDEX IF NOT EXISTS idx_member_lookup ON channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_reg_code_lookup ON registration_codes(code);